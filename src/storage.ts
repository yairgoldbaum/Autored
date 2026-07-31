// Persistencia local (BDD emulada) sobre AsyncStorage.
// Guarda stock, subastas y clientes para que los cambios sobrevivan al cierre de la app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Car, Auction, Customer, ClienteRol, VehicleContact, TransferenciaNotarial } from './data';

const STORAGE_KEY = 'suramotor:state:v1';

export interface PersistedState {
  stock: Car[];
  auctions: Auction[];
  customers: Customer[];
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
    };
  } catch {
    return null;
  }
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
    fechaIngreso: car.fechaIngreso || '',
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
    diasStock: Number(car.diasStock || 1),
    fotos: Array.isArray(car.fotos) ? car.fotos : [],
    comentario: car.comentario || '',
    documentos: Array.isArray(car.documentos) ? car.documentos : [],
    clienteAdquisicion: normalizeContact(car.clienteAdquisicion),
    comprador: normalizeContact(car.comprador),
    desdeSubastaId: car.desdeSubastaId || null,
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
    estado: customer.estado || 'Nuevo',
    interes: customer.interes || '',
    reservadoId: customer.reservadoId ?? null,
    roles: normalizeRoles(customer.roles),
    vehiculosAdquisicionIds: normalizeIdList(customer.vehiculosAdquisicionIds),
    vehiculosVentaIds: normalizeIdList(customer.vehiculosVentaIds),
  };
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
  };
}

function normalizeRoles(roles: unknown): ClienteRol[] {
  if (!Array.isArray(roles)) return ['Venta'];
  const clean = roles.filter((role): role is ClienteRol => role === 'Adquisición' || role === 'Venta');
  return clean.length ? Array.from(new Set(clean)) : ['Venta'];
}

function normalizeIdList(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is number => typeof id === 'number');
}
