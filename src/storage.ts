// Persistencia local (BDD emulada) sobre AsyncStorage.
// Guarda stock, subastas y clientes para que los cambios sobrevivan al cierre de la app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Car,
  Auction,
  Customer,
  VehicleContact,
  TransferenciaNotarial,
  BusquedaCliente,
  RelacionClienteVehiculo,
  TipoRelacion,
} from './data';

const STORAGE_KEY = 'suramotor:state:v1';

export interface PersistedState {
  stock: Car[];
  auctions: Auction[];
  customers: Customer[];
  relaciones: RelacionClienteVehiculo[];
}

export async function loadState(): Promise<PersistedState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.stock) || !Array.isArray(data.auctions) || !Array.isArray(data.customers)) {
      return null;
    }
    return {
      stock: data.stock.map(normalizeCar),
      auctions: data.auctions.map(normalizeAuction),
      customers: data.customers.map(normalizeCustomer),
      // Tercera colección, nueva. Un estado guardado antes de que existiera no la
      // trae: se arranca vacía y syncStockAndCustomers rearma las que se derivan
      // de los contactos embebidos del auto.
      relaciones: Array.isArray(data.relaciones) ? data.relaciones.flatMap(normalizeRelacion) : [],
    };
  } catch {
    return null;
  }
}

const TIPOS_RELACION: TipoRelacion[] = ['adquisicion', 'venta', 'consignacion', 'oportunidad'];

/** Devuelve [] en vez de null para poder usarlo con flatMap y descartar la basura. */
function normalizeRelacion(rel: unknown): RelacionClienteVehiculo[] {
  if (!rel || typeof rel !== 'object') return [];
  const r = rel as Partial<RelacionClienteVehiculo>;
  if (typeof r.id !== 'number' || typeof r.clienteId !== 'number' || typeof r.vehiculoId !== 'number') return [];
  if (!r.tipo || !TIPOS_RELACION.includes(r.tipo)) return [];
  return [{ id: r.id, clienteId: r.clienteId, vehiculoId: r.vehiculoId, tipo: r.tipo, fecha: r.fecha || '' }];
}

function normalizeAuction(auction: Partial<Auction> & { id: number }): Auction {
  const now = Date.now();
  const startedAt = auction.startedAt || new Date(now - 30 * 60 * 1000).toISOString();
  const endsAt = auction.endsAt || new Date(new Date(startedAt).getTime() + 4 * 60 * 60 * 1000).toISOString();
  const legacyEstado = auction.estado as string | undefined;
  const estado: Auction['estado'] =
    legacyEstado === 'Mis Ofertas' ||
    legacyEstado === 'Mi Subasta' ||
    legacyEstado === 'Adjudicada' ||
    legacyEstado === 'Perdida' ||
    legacyEstado === 'Vendida' ||
    legacyEstado === 'Finalizada' ||
    legacyEstado === 'Cancelada'
      ? legacyEstado
      : 'Disponible';

  const legacyBestOffer = Number((auction as Partial<Auction> & { ultimaOferta?: number }).ultimaOferta || 0);
  return {
    id: auction.id,
    marca: auction.marca || '',
    modelo: auction.modelo || '',
    version: auction.version || '',
    anio: Number(auction.anio || 0),
    origen: auction.origen || 'Subasta',
    costoFinal: Number(auction.costoFinal || auction.miOferta || 0),
    sugeridoVenta: Number(auction.sugeridoVenta || 0),
    patente: auction.patente || '',
    km: Number(auction.km || 0),
    color: auction.color || '',
    transmision: auction.transmision || 'Manual',
    combustible: auction.combustible || 'Bencina',
    imageUrl: auction.imageUrl || '',
    features: normalizeAuctionFeatures(auction.features),
    estado,
    sellerType: auction.sellerType || 'externo',
    stockId: typeof auction.stockId === 'number' ? auction.stockId : null,
    sellerNote: auction.sellerNote || 'Subasta a sobre cerrado. Las ofertas se revelan al finalizar el plazo.',
    startedAt,
    endsAt,
    hiddenBestOffer: Number(auction.hiddenBestOffer || legacyBestOffer || 0),
    receivedOffers: Array.isArray(auction.receivedOffers)
      ? auction.receivedOffers.filter((offer): offer is number => typeof offer === 'number')
      : [],
    miOferta: typeof auction.miOferta === 'number' ? auction.miOferta : undefined,
    winningBid: typeof auction.winningBid === 'number' ? auction.winningBid : undefined,
  };
}

function normalizeAuctionFeatures(features: unknown): Auction['features'] {
  if (!Array.isArray(features)) return [];
  return features
    .filter((feature): feature is { label?: unknown; value?: unknown } => !!feature && typeof feature === 'object')
    .map((feature) => ({
      label: typeof feature.label === 'string' ? feature.label : '',
      value: typeof feature.value === 'string' ? feature.value : '',
    }))
    .filter((feature) => feature.label || feature.value);
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin espacio o storage no disponible: la app sigue funcionando en memoria.
  }
}

export async function clearState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCar(car: Partial<Car> & { id: number }): Car {
  const precioVenta = Number(car.precioVenta || car.precioPublicacionContado || 0);
  const anio = Number(car.anio || 0);
  return {
    id: car.id,
    patente: car.patente || '',
    vin: car.vin || '',
    tipoVehiculo: car.tipoVehiculo || 'Vehículo liviano',
    marca: car.marca || '',
    modelo: car.modelo || '',
    version: car.version || '',
    anio,
    anioFabricacion: Number(car.anioFabricacion || anio || 0),
    sucursal: car.sucursal || 'Mayorista',
    // Los días en stock se calculan desde acá, así que un auto sin fecha empieza
    // a contar hoy en vez de quedarse pegado en cero para siempre.
    fechaIngreso: car.fechaIngreso || hoyISO(),
    km: Number(car.km || 0),
    color: car.color || '',
    transmision: car.transmision || 'Manual',
    combustible: car.combustible || 'Bencina',
    traccion: car.traccion || '4x2',
    cilindrada: Number(car.cilindrada || 0),
    puertas: car.puertas || '',
    equipamiento: Array.isArray(car.equipamiento) ? car.equipamiento : [],
    otros: car.otros || '',
    origen: car.origen || 'Nacional',
    precioVenta,
    precioPublicacionContado: Number(car.precioPublicacionContado || precioVenta || 0),
    precioPublicacionFinanciado: Number(car.precioPublicacionFinanciado || 0),
    precioVentaEstimado: Number(car.precioVentaEstimado || precioVenta || 0),
    costoAdquisicion: Number(car.costoAdquisicion || 0),
    estado: car.estado || 'En preparación',
    // `diasStock` ya no se guarda: se calcula con diasEnStock() desde fechaIngreso.
    // Si un auto viejo no la tiene, se le pone la de hoy y empieza a contar desde acá.
    fotos: Array.isArray(car.fotos) ? car.fotos : [],
    comentario: car.comentario || '',
    documentos: Array.isArray(car.documentos) ? car.documentos : [],
    clienteAdquisicion: normalizeContact(car.clienteAdquisicion),
    comprador: normalizeContact(car.comprador),
    desdeSubastaId: car.desdeSubastaId || null,
    // Autos guardados antes de que existiera la tenencia: se asumen propios, que
    // es lo que eran cuando se cargaron.
    tenencia: car.tenencia === 'Consignado' ? 'Consignado' : 'Propio',
    consignante: normalizeContact(car.consignante),
    precioPisoConsignacion: Number(car.precioPisoConsignacion || 0),
    fechaVenta: car.fechaVenta || null,
    financiado: typeof car.financiado === 'boolean' ? car.financiado : null,
    visitas: Array.isArray(car.visitas) ? car.visitas : [],
    transferencia: normalizeTransferencia(car.transferencia),
    informesEnviados: Array.isArray(car.informesEnviados) ? car.informesEnviados : [],
  };
}

// El informe AutoSave no se persiste: se recalcula desde la patente (src/autosave.ts).
// La transferencia sí, porque tiene estado propio que avanza en el tiempo.
function normalizeTransferencia(t: unknown): TransferenciaNotarial | null {
  if (!t || typeof t !== 'object') return null;
  const tr = t as Partial<TransferenciaNotarial>;
  if (!tr.folio) return null;
  const vendedor = normalizeContact(tr.vendedor);
  const comprador = normalizeContact(tr.comprador);
  if (!vendedor || !comprador) return null;
  return {
    folio: tr.folio,
    estado: tr.estado || 'Solicitada',
    origen: tr.origen || 'Automotora',
    modalidad: tr.modalidad || 'Digital',
    fechaSolicitud: tr.fechaSolicitud || '',
    fechaEstimadaEntrega: tr.fechaEstimadaEntrega || '',
    notaria: tr.notaria || '',
    vendedor,
    comprador,
    precioOperacion: Number(tr.precioOperacion || 0),
    tasacionFiscal: Number(tr.tasacionFiscal || 0),
    baseImponible: Number(tr.baseImponible || 0),
    responsablePago: tr.responsablePago || 'Comprador',
    costos: Array.isArray(tr.costos) ? tr.costos : [],
    total: Number(tr.total || 0),
    hitos: Array.isArray(tr.hitos) ? tr.hitos : [],
    observacion: tr.observacion || '',
  };
}

function normalizeCustomer(customer: Partial<Customer> & { id: number }): Customer {
  return {
    id: customer.id,
    nombre: customer.nombre || '',
    telefono: customer.telefono || '',
    tipo: customer.tipo || 'Particular',
    estado: normalizeEstadoCliente(customer.estado),
    notas: typeof customer.notas === 'string' ? customer.notas : '',
    canal: customer.canal === 'Tasador web' ? 'Tasador web' : 'Carga manual',
    // Los clientes guardados antes de que existiera `busca` traen el viejo `interes`,
    // que era un auto del stock propio. Se rescata como el modelo que buscan.
    busca: normalizeBusqueda(customer),
    archivado: customer.archivado === true,
    // Los ids de autos que el cliente guardaba (vehiculosAdquisicionIds,
    // vehiculosVentaIds, reservadoId) se descartan: esa relación ahora vive en
    // `relaciones`, y syncStockAndCustomers la rearma desde los contactos del auto.
  };
}

/* El estado del trato bajó de siete a tres. Los cuatro que salieron repetían lo que
   ahora dicen las relaciones con autos, así que un cliente guardado con uno de esos
   cae al estado del trato que más se le parece. */
function normalizeEstadoCliente(estado: string | undefined): string {
  switch (estado) {
    case 'Caliente':
    case 'Frecuente':
      return estado;
    case 'Interesado':
    case 'Reserva':
      return 'Caliente';
    default:
      return 'Nuevo';
  }
}

function normalizeBusqueda(customer: Partial<Customer> & { interes?: unknown }): BusquedaCliente | null {
  const busca = customer.busca;
  if (busca && typeof busca === 'object') {
    const modelo = typeof busca.modelo === 'string' ? busca.modelo : '';
    const comentario = typeof busca.comentario === 'string' ? busca.comentario : '';
    return modelo || comentario ? { modelo, comentario } : null;
  }
  const legacy = typeof customer.interes === 'string' ? customer.interes.trim() : '';
  return legacy ? { modelo: legacy, comentario: '' } : null;
}

function normalizeContact(contact: unknown): VehicleContact | null {
  if (!contact || typeof contact !== 'object') return null;
  const c = contact as Partial<VehicleContact>;
  const nombre = c.nombre || '';
  const telefono = c.telefono || '';
  if (!nombre && !telefono) return null;
  return {
    clienteId: typeof c.clienteId === 'number' ? c.clienteId : null,
    nombre,
    telefono,
    notas: typeof c.notas === 'string' ? c.notas : '',
  };
}
