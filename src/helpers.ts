/* Helpers, tipos y constantes que antes vivían dentro de App.tsx y comparten
   varias pantallas. Lógica pura: acá no hay componentes ni estado. */
import { C } from './theme';
import { FichaPatente } from './pricing';
import {
  Auction,
  BusquedaCliente,
  Car,
  Customer,
  EnvioInforme,
  EstadoAuto,
  InformeAutosave,
  RelacionClienteVehiculo,
  TipoRelacion,
  VehicleContact,
  VeredictoAutosave,
  INITIAL_AUCTIONS,
  diasEnStock,
  esClienteDeAdquisicion,
  esClienteDeVenta,
} from './data';

/* El orden que pidió David: primero Stock, luego Clientes y al final los KPIs.
   Transferencias entra a la barra solo si Autored decide que la transferencia
   digital es parte del alcance (punto 48). 'inicio' ya no existe como pestaña:
   la app abre en la bandeja del stock y el Motor de Precios se entra desde el
   header. 'subastas' tampoco vive en la barra, pero la pantalla sigue (también
   desde el header) mientras Autored resuelve si sale de la app (punto 46). */
export type TabKey = 'stock' | 'clientes' | 'subastas' | 'kpis';

/* Tramo de antigüedad. Es a la vez un filtro del panel del Stock y el destino de
   las barras del gráfico de KPIs (cruce 1 con P2): tocar una barra deja la
   bandeja mostrando ese tramo. */
export type FiltroDias = null | '0-30' | '31-60' | '+60';
/* Estado del trato: describe la relación comercial y nada más. Eran siete y cuatro
   de ellos (Interesado, Adquisición, Reserva, Comprador) repetían lo que ahora dicen
   las relaciones con autos. "Adquisición" además aparecía a la vez acá y como rol
   comercial, así que se elegía lo mismo dos veces. */
export const ESTADO_CLIENTE_OPTIONS = [
  { label: 'Nuevo', value: 'Nuevo' },
  { label: 'Contactado', value: 'Contactado' },
  { label: 'Interesado', value: 'Interesado' },
  { label: 'Negociando', value: 'Negociando' },
  { label: 'Cliente', value: 'Cliente' },
  { label: 'Perdido', value: 'Perdido' },
];

export const ESTADOS_CLIENTE = ESTADO_CLIENTE_OPTIONS.map((o) => o.value);

/* Los filtros de la lista son los estados del cliente, no categorías aparte.
   Antes eran "Intereses" y "Oportunidades", que describían la relación con un
   auto y no en qué va el trato: había que aprenderse dos vocabularios. */
export type ClienteFiltro = string;
export const CLIENTE_FILTROS: ClienteFiltro[] = [
  'Todos',
  ...ESTADO_CLIENTE_OPTIONS.map((o) => o.value),
  'Archivados',
];
export type SubastaTabKey = 'disponibles' | 'ofertas' | 'mis_subastas' | 'finalizadas';

export const AUCTION_DURATION_MS = 4 * 60 * 60 * 1000;

export interface WizardData extends Omit<Car, 'id'> {
  id: number | null;
  desdeSubastaId: number | null;
}

/* Consulta de patente del paso 1 del alta. 'sin_registro' no es un error: es el
   caso real de una patente que la base no tiene, y de ahí se sigue a mano. */
export interface BusquedaPatente {
  estado: 'idle' | 'buscando' | 'ok' | 'sin_registro';
  patente: string;
  ficha: FichaPatente | null;
}

export function makeBusquedaPatente(): BusquedaPatente {
  return { estado: 'idle', patente: '', ficha: null };
}

/* Lectura de la patente desde una foto. Vive aparte de la búsqueda porque son
   dos cosas distintas: una saca la patente de la imagen, la otra la va a
   consultar al registro. La foto se guarda para mostrar cuál se leyó. */
export interface LecturaPatente {
  estado: 'idle' | 'leyendo' | 'propuesta' | 'sin_lectura';
  patente: string;
  foto: string;
}

export function makeLecturaPatente(): LecturaPatente {
  return { estado: 'idle', patente: '', foto: '' };
}

export interface NewClientData {
  id: number | null;
  nombre: string;
  telefono: string;
  tipo: 'Particular' | 'Empresa';
  estado: string;
  notas: string;
  buscaModelo: string;
  buscaComentario: string;
  buscaVehiculoId: number | null;
}

export const TIPO_VEHICULO_OPTIONS = ['Vehículo liviano', 'Vehículo pesado', 'Moto'];
export const MARCA_OPTIONS = [
  'Audi',
  'BMW',
  'BYD',
  'Changan',
  'Chevrolet',
  'Citroen',
  'Fiat',
  'Ford',
  'Great Wall',
  'Honda',
  'Hyundai',
  'JAC',
  'Kia',
  'Mazda',
  'Mercedes-Benz',
  'MG',
  'Mitsubishi',
  'Nissan',
  'Peugeot',
  'Renault',
  'Subaru',
  'Suzuki',
  'Toyota',
  'Volkswagen',
  'Volvo',
];
export const SUCURSAL_OPTIONS = ['Mayorista', 'Vitacura', 'Las Condes', 'La Dehesa'];
export const TRANSMISION_OPTIONS = ['Manual', 'Automático', 'Automatizado'];
export const COMBUSTIBLE_OPTIONS = ['Bencina', 'Diesel', 'Hibrido', 'Eléctrico'];
export const TRACCION_OPTIONS = ['4x2', '4x4', 'AWD'];
export const PUERTAS_OPTIONS = ['2', '3', '4', '5'];
export const EQUIPAMIENTO_OPTIONS = [
  'Aire acondicionado',
  'Climatizador',
  'Airbags',
  'Frenos ABS',
  'Control estabilidad',
  'Cámara retroceso',
  'Sensores estacionamiento',
  'Bluetooth',
  'Pantalla táctil',
  'Cierre centralizado',
  'Alzavidrios eléctricos',
  'Control crucero',
];
export const DOCUMENTO_OPTIONS = ['Permiso de circulación', 'Revisión técnica', 'SOAP', 'Padrón', 'Certificado multas', 'Otro'];

/* Tres pasos, el corte de David: fotos, información del vehículo, y precios más
   estado más cliente. Eran cinco. */
export const WIZARD_PASOS = 3;

/* El panel de filtros del Stock (puntos 17 a 20). El año y el precio son rangos
   desde-hasta, no un valor suelto; string vacío o null significa "sin límite",
   así que por defecto ningún filtro esconde autos. */
export interface StockFilters {
  marca: string;
  modelo: string; // punto 17
  anioDesde: string; // punto 18: rango, no un año exacto
  anioHasta: string;
  precioDesde: string; // punto 19: rango, no solo un tope
  precioHasta: string;
  sucursal: string; // punto 20: el campo existía en el modelo y no se usaba
  tenencia: string; // '' = todas, o 'Propio' | 'Consignado' (punto 11)
  dias: FiltroDias; // el tramo de antigüedad que llega desde las barras de KPIs
}

export function emptyStockFilters(): StockFilters {
  return {
    marca: '',
    modelo: '',
    anioDesde: '',
    anioHasta: '',
    precioDesde: '',
    precioHasta: '',
    sucursal: '',
    tenencia: '',
    dias: null,
  };
}

/* Cómo se ordena la bandeja (punto 22). Antes el orden era fijo (los autos según
   se cargaban); ahora el usuario lo elige desde el panel de filtros. */
export type OrdenStock = 'ingreso' | 'dias' | 'leads' | 'precio-asc' | 'precio-desc';

export const ORDEN_STOCK_OPTIONS: { label: string; value: OrdenStock }[] = [
  { label: 'Ingreso reciente', value: 'ingreso' },
  { label: 'Más días en stock', value: 'dias' },
  { label: 'Más leads', value: 'leads' },
  { label: 'Precio menor', value: 'precio-asc' },
  { label: 'Precio mayor', value: 'precio-desc' },
];


// Color del badge según el estado del trato
export function badgeForEstadoCliente(estado: string) {
  switch (estado) {
    case 'Contactado':
      return { bg: C.slate100, color: C.slate600 };
    case 'Interesado':
      return { bg: C.amber50, color: C.amber700 };
    case 'Negociando':
      return { bg: C.red50, color: C.red700 };
    case 'Cliente':
      return { bg: C.emerald50, color: C.emerald700 };
    case 'Perdido':
      return { bg: C.slate100, color: C.slate400 };
    case 'Nuevo':
    default:
      return { bg: C.blue50, color: C.blue700 };
  }
}

export const TIPO_CLIENTE_OPTIONS = [
  { label: 'Particular', value: 'Particular' },
  { label: 'Empresa', value: 'Empresa' },
];

export function emptyContact(): VehicleContact {
  return { clienteId: null, nombre: '', telefono: '', notas: '' };
}

export function hasContactData(contact: VehicleContact | null | undefined) {
  return !!contact && (!!contact.nombre.trim() || !!contact.telefono.trim());
}

export function cleanVehicleContact(contact: VehicleContact | null | undefined): VehicleContact | null {
  if (!contact) return null;
  const clean = {
    clienteId: typeof contact.clienteId === 'number' ? contact.clienteId : null,
    nombre: contact.nombre.trim(),
    telefono: contact.telefono.trim(),
    notas: contact.notas?.trim() || '',
  };
  return hasContactData(clean) ? clean : null;
}

export function requiresBuyer(estado: EstadoAuto | string) {
  return estado === 'Reservado' || estado === 'Vendido';
}

export function emptyNewClient(): NewClientData {
  return {
    id: null,
    nombre: '',
    telefono: '',
    tipo: 'Particular',
    estado: 'Nuevo',
    notas: '',
    buscaModelo: '',
    buscaComentario: '',
    buscaVehiculoId: null,
  };
}

/** Qué busca el cliente, en una línea. '—' cuando no anotó nada. */
export function textoBusqueda(busca: BusquedaCliente | null): string {
  if (!busca) return '—';
  if (busca.modelo && busca.comentario) return `${busca.modelo} · ${busca.comentario}`;
  return busca.modelo || busca.comentario || '—';
}

/** Lo que el formulario escribió, listo para guardar: null cuando no dijo nada. */
export function busquedaFromForm(form: NewClientData): BusquedaCliente | null {
  const modelo = form.buscaModelo.trim();
  const comentario = form.buscaComentario.trim();
  return modelo || comentario || form.buscaVehiculoId
    ? { modelo, comentario, vehiculoId: form.buscaVehiculoId }
    : null;
}

/* El rol comercial ya no se elige ni se guarda: sale de las relaciones del cliente.
   Antes se pedía en el formulario y quedaba desalineado con los autos que el cliente
   realmente tenía asociados. */
/* Cada chip es una condición sobre el cliente y sus relaciones, no un estado que
   alguien tiene que mantener al día. */
export function cumpleFiltroCliente(
  cliente: Customer,
  rels: RelacionClienteVehiculo[],
  filtro: ClienteFiltro,
): boolean {
  switch (filtro) {
    case 'Todos':
      return true;
    case 'Archivados':
      return cliente.archivado;
    default:
      return cliente.estado === filtro;
  }
}

/* Cuántos leads tiene un auto (cruce 3 con P2). Hoy el único lead que el modelo
   sabe representar es la relación de tipo 'oportunidad': alguien se interesó en
   ese auto puntual y quedó en seguimiento. Cuando los leads entrantes por canal
   existan como entidad propia (paso 8 de P2), este conteo crece acá y ninguna
   tarjeta se toca. Sin datos devuelve 0 y no rompe nada. */
export function leadsDeVehiculo(relaciones: RelacionClienteVehiculo[], vehiculoId: number): number {
  return relaciones.filter((r) => r.vehiculoId === vehiculoId && r.tipo === 'oportunidad').length;
}

export function cumpleFiltroDias(car: Car, filtro: FiltroDias): boolean {
  if (!filtro) return true;
  const d = diasEnStock(car);
  if (filtro === '0-30') return d <= 30;
  if (filtro === '31-60') return d > 30 && d <= 60;
  return d > 60;
}

/* Los meses que se pueden mirar en los KPIs: el actual y los anteriores en los que
   efectivamente hubo alguna venta. No se listan meses vacíos. */
export function periodosConVentas(stock: Car[]): string[] {
  const hoy = new Date();
  const actual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const meses = new Set<string>([actual]);
  stock.forEach((c) => {
    if (c.fechaVenta) meses.add(c.fechaVenta.slice(0, 7));
  });
  return Array.from(meses).sort().reverse();
}

export const NOMBRE_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function etiquetaPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  return `${NOMBRE_MES[Number(mes) - 1]} ${anio}`;
}


export function normalizePhone(telefono: string) {
  return (telefono || '').replace(/\D/g, '');
}

export function getCarLabel(car: Pick<Car, 'marca' | 'modelo' | 'anio'>) {
  return `${car.marca} ${car.modelo}${car.anio ? ` ${car.anio}` : ''}`.trim();
}

export function contactDisplayName(contact: VehicleContact | null | undefined) {
  if (!contact || !hasContactData(contact)) return 'Sin registrar';
  return contact.telefono ? `${contact.nombre || 'Sin nombre'} · ${contact.telefono}` : contact.nombre;
}

export const PREFIJO_RELACION: Record<TipoRelacion, string> = {
  adquisicion: 'Adq.',
  venta: 'Venta',
  consignacion: 'Consig.',
  oportunidad: 'Oport.',
};

/* Cuando un cliente tiene varias relaciones, cuál manda en la tarjeta: lo más
   avanzado primero, porque es lo que describe mejor la relación comercial. */
export const ORDEN_RELACION: TipoRelacion[] = ['venta', 'consignacion', 'adquisicion', 'oportunidad'];

export const ETIQUETA_RELACION: Record<TipoRelacion, string> = {
  venta: 'Se llevó',
  consignacion: 'Te dejó en consignación',
  adquisicion: 'Le compraste',
  oportunidad: 'Le interesa',
};

export interface LineaCliente {
  etiqueta: string;
  valor: string;
  vehiculo: Car | null;
}

/* La línea que va en la tarjeta, según lo que esa persona es. Antes todas mostraban
   la misma ("Relación Stock"), que no decía nada del interesado ni del consignante. */
export function lineaCliente(
  cliente: Customer,
  rels: RelacionClienteVehiculo[],
  stockById: Map<number, Car>,
): LineaCliente {
  const conAuto = rels.filter((r) => stockById.has(r.vehiculoId));
  if (conAuto.length) {
    const principal = [...conAuto].sort(
      (a, b) => ORDEN_RELACION.indexOf(a.tipo) - ORDEN_RELACION.indexOf(b.tipo),
    )[0];
    const car = stockById.get(principal.vehiculoId) as Car;
    // La reserva no es un tipo propio: es una venta a un auto todavía reservado.
    const reservado = principal.tipo === 'venta' && car.estado === 'Reservado';
    const otras = conAuto.length - 1;
    return {
      etiqueta: reservado ? 'Tiene reservado' : ETIQUETA_RELACION[principal.tipo],
      valor: `${getCarLabel(car)}${otras > 0 ? ` · +${otras}` : ''}`,
      vehiculo: car,
    };
  }
  if (cliente.busca) return { etiqueta: 'Busca', valor: textoBusqueda(cliente.busca), vehiculo: null };
  return { etiqueta: 'Relación', valor: '—', vehiculo: null };
}

export function getCustomerVehicleLabels(rels: RelacionClienteVehiculo[], stockById: Map<number, Car>) {
  return rels.flatMap((rel) => {
    const car = stockById.get(rel.vehiculoId);
    if (!car) return [];
    // La reserva no es un tipo de relación: es una venta a un auto todavía reservado.
    const prefijo = rel.tipo === 'venta' && car.estado === 'Reservado' ? 'Reserva' : PREFIJO_RELACION[rel.tipo];
    return [`${prefijo} ${getCarLabel(car)}`];
  });
}

export function updateCarContactForCustomer(car: Car, customer: Customer): Car {
  return {
    ...car,
    clienteAdquisicion:
      car.clienteAdquisicion?.clienteId === customer.id
        ? { ...car.clienteAdquisicion, nombre: customer.nombre, telefono: customer.telefono }
        : car.clienteAdquisicion,
    comprador:
      car.comprador?.clienteId === customer.id
        ? { ...car.comprador, nombre: customer.nombre, telefono: customer.telefono }
        : car.comprador,
  };
}

export interface SyncedState {
  stock: Car[];
  customers: Customer[];
  relaciones: RelacionClienteVehiculo[];
}

/* Deja cuadrados los tres lados del modelo:
   - crea el cliente que falta cuando un auto trae un contacto que no está en la lista,
   - copia el nombre y el teléfono del cliente al contacto embebido del auto,
   - y rearma las relaciones que se derivan de esos contactos (adquisición, venta y
     consignación), conservando el id y la fecha de la relación que ya existía.

   Las de tipo 'oportunidad' no cuelgan de ningún contacto del auto, se cargan a mano:
   acá solo se conservan, descartando las que apuntan a un auto o a un cliente que
   ya no existe.

   Antes esta función además mantenía a mano los ids de autos guardados dentro del
   cliente, en la dirección contraria. Eso ya no existe. */
export function syncStockAndCustomers(
  stock: Car[],
  customers: Customer[],
  relaciones: RelacionClienteVehiculo[],
): SyncedState {
  let nextCustomerId = Math.max(0, ...customers.map((c) => c.id)) + 1;
  const nextCustomers: Customer[] = customers.map((customer) => ({ ...customer }));

  const findCustomerIndex = (contact: VehicleContact) => {
    if (typeof contact.clienteId === 'number') {
      const byId = nextCustomers.findIndex((c) => c.id === contact.clienteId);
      if (byId >= 0) return byId;
    }
    const phone = normalizePhone(contact.telefono);
    if (phone) {
      const byPhone = nextCustomers.findIndex((c) => normalizePhone(c.telefono) === phone);
      if (byPhone >= 0) return byPhone;
    }
    const name = contact.nombre.trim().toLowerCase();
    if (name) return nextCustomers.findIndex((c) => c.nombre.trim().toLowerCase() === name);
    return -1;
  };

  /* El cliente que hay detrás del contacto: el que ya estaba, o uno nuevo. Ya no
     toca el estado del trato, que es de la relación comercial y lo maneja el
     usuario, ni los roles, que ahora se deducen de las relaciones. */
  const upsertCustomer = (contact: VehicleContact): { contact: VehicleContact; clienteId: number } => {
    const idx = findCustomerIndex(contact);
    if (idx < 0) {
      const created: Customer = {
        id: nextCustomerId++,
        nombre: contact.nombre || 'Cliente sin nombre',
        telefono: contact.telefono,
        tipo: 'Particular',
        estado: 'Nuevo',
        notas: contact.notas?.trim() || '',
        // Nace desde el auto, no desde el tasador web, y no busca nada: ya tiene
        // este auto asociado. `busca` es para el que quiere algo que no tienes.
        canal: 'Carga manual',
        busca: null,
        archivado: false,
      };
      nextCustomers.push(created);
      return { contact: { ...contact, clienteId: created.id }, clienteId: created.id };
    }

    const existing = nextCustomers[idx];
    nextCustomers[idx] = {
      ...existing,
      nombre: contact.nombre || existing.nombre,
      telefono: contact.telefono || existing.telefono,
      notas: contact.notas?.trim() || existing.notas,
    };
    return { contact: { ...contact, clienteId: existing.id }, clienteId: existing.id };
  };

  let nextRelacionId = Math.max(0, ...relaciones.map((r) => r.id)) + 1;
  const derivadas: RelacionClienteVehiculo[] = [];
  const registrarRelacion = (
    clienteId: number,
    vehiculoId: number,
    tipo: TipoRelacion,
    fecha: string,
  ) => {
    const yaEsta = (r: RelacionClienteVehiculo) =>
      r.clienteId === clienteId && r.vehiculoId === vehiculoId && r.tipo === tipo;
    if (derivadas.some(yaEsta)) return;
    const previa = relaciones.find(yaEsta);
    // Se conserva la relación previa entera: su id y, sobre todo, su fecha, que es
    // cuándo pasó de verdad y no se puede reconstruir desde el auto.
    derivadas.push(previa ? { ...previa } : { id: nextRelacionId++, clienteId, vehiculoId, tipo, fecha });
  };

  const nextStock = stock.map((car) => {
    const clienteAdquisicion = cleanVehicleContact(car.clienteAdquisicion);
    const comprador = cleanVehicleContact(car.comprador);
    const consignante = cleanVehicleContact(car.consignante);
    const nextCar: Car = { ...car, clienteAdquisicion, comprador, consignante };
    if (clienteAdquisicion) {
      const res = upsertCustomer(clienteAdquisicion);
      nextCar.clienteAdquisicion = res.contact;
      registrarRelacion(res.clienteId, car.id, 'adquisicion', car.fechaIngreso);
    }
    if (car.tenencia === 'Consignado' && consignante) {
      const res = upsertCustomer(consignante);
      nextCar.consignante = res.contact;
      registrarRelacion(res.clienteId, car.id, 'consignacion', car.fechaIngreso);
    }
    if (requiresBuyer(nextCar.estado) && comprador) {
      const res = upsertCustomer(comprador);
      nextCar.comprador = res.contact;
      registrarRelacion(res.clienteId, car.id, 'venta', car.fechaVenta || car.fechaIngreso);
    }
    return nextCar;
  });

  const idsAutos = new Set(nextStock.map((c) => c.id));
  const idsClientes = new Set(nextCustomers.map((c) => c.id));
  const oportunidades = relaciones.filter(
    (r) => r.tipo === 'oportunidad' && idsAutos.has(r.vehiculoId) && idsClientes.has(r.clienteId),
  );

  return { stock: nextStock, customers: nextCustomers, relaciones: [...derivadas, ...oportunidades] };
}

export function makeEmptyWizard(): WizardData {
  return {
    id: null,
    patente: '',
    vin: '',
    tipoVehiculo: 'Vehículo liviano',
    marca: '',
    modelo: '',
    version: '',
    anio: 0,
    anioFabricacion: 0,
    sucursal: 'Mayorista',
    fechaIngreso: todayIsoDate(),
    km: 0,
    color: '',
    transmision: 'Manual',
    combustible: 'Bencina',
    traccion: '4x2',
    cilindrada: 0,
    puertas: '',
    equipamiento: [],
    otros: '',
    origen: 'Nacional',
    precioVenta: 0,
    precioPublicacionContado: 0,
    precioPublicacionFinanciado: 0,
    precioVentaEstimado: 0,
    costoAdquisicion: 0,
    estado: 'En preparación',
    fotos: [],
    comentario: '',
    documentos: [],
    clienteAdquisicion: null,
    comprador: null,
    desdeSubastaId: null,
    tenencia: 'Propio',
    consignante: null,
    precioPisoConsignacion: 0,
    fechaVenta: null,
    financiado: null,
  };
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function optionsWithCurrent(current: string, base: string[]) {
  const options = base.map((value) => ({ label: value, value }));
  if (current && !base.includes(current)) {
    return [{ label: current, value: current }, ...options];
  }
  return options;
}

export function badgeForEstado(estado: EstadoAuto) {
  switch (estado) {
    case 'En venta':
      return { bg: C.emerald50, color: C.emerald700, border: C.emerald200 };
    case 'En preparación':
    case 'Pre-stock':
      return { bg: C.amber50, color: C.amber700, border: C.amber200 };
    case 'Reservado':
      return { bg: C.blue50, color: C.blue700, border: C.blue100 };
    case 'Consignado':
      return { bg: C.purple50, color: C.purple700, border: C.purple100 };
    case 'Vendido':
      return { bg: C.slate100, color: C.slate500, border: C.slate200 };
    default:
      return { bg: C.slate100, color: C.slate700, border: C.slate200 };
  }
}

export function isAuctionFinal(auction: Auction) {
  return ['Adjudicada', 'Perdida', 'Vendida', 'Finalizada', 'Cancelada'].includes(auction.estado);
}

export function getAuctionMsLeft(auction: Auction, nowTs: number) {
  const endsAt = new Date(auction.endsAt).getTime();
  if (!Number.isFinite(endsAt)) return 0;
  return Math.max(0, endsAt - nowTs);
}

export function getAuctionProgressPct(auction: Auction, nowTs: number) {
  const startedAt = new Date(auction.startedAt).getTime();
  const endsAt = new Date(auction.endsAt).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endsAt) || endsAt <= startedAt) return 100;
  const elapsed = Math.min(Math.max(nowTs - startedAt, 0), endsAt - startedAt);
  return Math.round((elapsed / (endsAt - startedAt)) * 100);
}

export function formatAuctionRemaining(msLeft: number) {
  if (msLeft <= 0) return 'Finalizada';
  const totalSeconds = Math.floor(msLeft / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function pad2(value: number) {
  return String(value).padStart(2, '0');
}

export function mergeAuctionsWithInitial(savedAuctions: Auction[]) {
  const initialById = new Map(INITIAL_AUCTIONS.map((auction) => [auction.id, auction]));
  const savedIds = new Set(savedAuctions.map((auction) => auction.id));
  const hydratedSaved = savedAuctions.map((auction) => {
    const initial = initialById.get(auction.id);
    if (!initial) return auction;
    return {
      ...initial,
      ...auction,
      imageUrl: auction.imageUrl || initial.imageUrl,
      features: auction.features?.length ? auction.features : initial.features,
      sellerNote: auction.sellerNote || initial.sellerNote,
      startedAt: auction.startedAt || initial.startedAt,
      endsAt: auction.endsAt || initial.endsAt,
    };
  });
  const missingInitial = INITIAL_AUCTIONS.filter((auction) => !savedIds.has(auction.id));
  return [...hydratedSaved, ...missingInitial];
}

export function getAuctionImageUrl(auction: Auction, stockCar?: Car | null) {
  return (
    stockCar?.fotos?.[0] ||
    auction.imageUrl ||
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80'
  );
}

export function getAuctionFeatures(auction: Auction) {
  if (auction.features?.length) return auction.features;
  return [
    { label: 'Documentos', value: 'Revisión documental pendiente de comprador' },
    { label: 'Estado exterior', value: auction.color ? `Color ${auction.color}, detalles normales de uso` : 'Detalles normales de uso' },
    { label: 'Uso declarado', value: auction.km > 120000 ? 'Alto kilometraje, revisar mecánica' : 'Uso particular o flota liviana' },
    { label: 'Entrega', value: 'Coordinación posterior a adjudicación' },
  ];
}

export function closeAuction(auction: Auction): Auction {
  if (auction.sellerType === 'propio') {
    const bestOffer = Math.max(0, ...(auction.receivedOffers || []));
    if (bestOffer <= 0) {
      return { ...auction, estado: 'Finalizada', winningBid: 0 };
    }
    return { ...auction, estado: 'Vendida', winningBid: bestOffer, costoFinal: bestOffer };
  }

  if (!auction.miOferta) return { ...auction, estado: 'Finalizada' };
  const competingBid = auction.hiddenBestOffer || 0;
  if (!competingBid || auction.miOferta >= competingBid) {
    return { ...auction, estado: 'Adjudicada', costoFinal: auction.miOferta, winningBid: auction.miOferta };
  }
  return { ...auction, estado: 'Perdida', winningBid: competingBid };
}

export function suggestSealedBid(auction: Auction) {
  const reference = auction.costoFinal || auction.sugeridoVenta * 0.78 || 0;
  return Math.max(100000, Math.round(reference / 100000) * 100000);
}

export function getAuctionStatusCopy(auction: Auction, active: boolean) {
  if (active && auction.sellerType === 'propio') return { label: 'Mi subasta', bg: C.teal50, color: C.teal700 };
  if (active && auction.miOferta) return { label: 'Ofertada', bg: C.amber50, color: C.amber700 };
  if (active) return { label: 'Abierta', bg: C.emerald50, color: C.emerald700 };
  switch (auction.estado) {
    case 'Adjudicada':
      return { label: 'Ganada', bg: C.emerald50, color: C.emerald700 };
    case 'Perdida':
      return { label: 'Perdida', bg: C.red50, color: C.red700 };
    case 'Vendida':
      return { label: 'Vendida', bg: C.emerald50, color: C.emerald700 };
    case 'Cancelada':
      return { label: 'Cancelada', bg: C.red50, color: C.red700 };
    default:
      return { label: 'Finalizada', bg: C.slate100, color: C.slate600 };
  }
}

/* ---------------------- AutoSafe ---------------------- */
// El color solo comunica semántica (veredictos y bloqueos), nunca decora.
export function veredictoColor(v: VeredictoAutosave) {
  switch (v) {
    case 'critico':
      return { bg: C.red50, color: C.red600, text: C.red700 };
    case 'atencion':
      return { bg: C.amber50, color: C.amber600, text: C.amber800 };
    default:
      return { bg: C.emerald50, color: C.emerald600, text: C.emerald800 };
  }
}

export function totalAntecedentes(informe: InformeAutosave) {
  return (
    informe.siniestros.length +
    informe.revisiones.length +
    informe.titulares.length +
    informe.multas.length +
    (informe.prenda?.vigente ? 1 : 0) +
    (informe.encargo.vigente ? 1 : 0)
  );
}

export function contactoParaDestinatario(car: Car, destino: EnvioInforme['destinatario']): VehicleContact {
  if (destino === 'Comprador' && car.comprador) return { ...car.comprador };
  if (destino === 'Vendedor' && car.clienteAdquisicion) return { ...car.clienteAdquisicion };
  return emptyContact();
}
