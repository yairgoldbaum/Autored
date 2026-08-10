// Datos iniciales — réplica exacta del HTML (INITIAL_STOCK_DATA / AUCTIONS / CUSTOMERS)
import type { InspectionReport } from './inspection/types';

export type EstadoAuto =
  | 'Pre-stock'
  | 'En preparación'
  | 'En venta'
  | 'Reservado'
  | 'Vendido';

/* Tenencia: de quién es el auto que está en el patio. Un consignado no se compró,
   sigue siendo del cliente que lo dejó, y por eso ni el capital ni el margen se
   calculan igual que en uno propio. */
export type TenenciaVehiculo = 'Propio' | 'Consignado';

/* Una visita al auto. Sin vendedor asociado: ese concepto todavía no existe en la
   app y cuando existan roles se le cuelga sin tocar lo ya cargado. El cliente es
   opcional porque muchas visitas no dejan datos. */
export interface VisitaVehiculo {
  id: number;
  fecha: string; // YYYY-MM-DD
  clienteId: number | null;
  nombre: string; // '' cuando la visita no se identificó
}

export interface Car {
  id: number;
  patente: string;
  vin: string;
  tipoVehiculo: 'Vehículo liviano' | 'Vehículo pesado' | 'Moto';
  marca: string;
  modelo: string;
  version: string;
  anio: number;
  anioFabricacion: number;
  sucursal: string;
  fechaIngreso: string;
  km: number;
  color: string;
  transmision: string;
  combustible: string;
  traccion: string;
  cilindrada: number;
  puertas: string;
  equipamiento: string[];
  otros: string;
  origen: string;
  precioVenta: number;
  precioPublicacionContado: number;
  precioPublicacionFinanciado: number;
  precioVentaEstimado: number;
  costoAdquisicion: number; // 0 en consignación: no hubo compra
  estado: EstadoAuto;
  fotos: string[];
  comentario: string;
  documentos: VehicleDocument[];
  clienteAdquisicion: VehicleContact | null;
  comprador: VehicleContact | null;
  desdeSubastaId?: number | null;
  // Tenencia (paso 1)
  tenencia: TenenciaVehiculo;
  consignante: VehicleContact | null; // el dueño, solo cuando está consignado
  precioPisoConsignacion: number; // lo pactado con el dueño; 0 si el auto es propio
  // Venta (paso 2) — sin fechaVenta no existe ningún KPI del mes
  fechaVenta: string | null; // YYYY-MM-DD
  financiado: boolean | null; // null mientras el auto no se haya vendido
  // Visitas (paso 3)
  visitas: VisitaVehiculo[];
  // AutoSave (opcionales: el wizard construye autos sin ellos)
  transferencia?: TransferenciaNotarial | null;
  informesEnviados?: EnvioInforme[];
  // Informe de inspección de recepción generado con IA (módulo inspection)
  inspeccion?: InspectionReport | null;
}

export interface VehicleContact {
  clienteId: number | null;
  nombre: string;
  telefono: string;
}

export interface VehicleDocument {
  id: number;
  tipo: string;
  nombre: string;
  fechaVencimiento: string;
  archivoNombre: string;
}

/* Lo que el auto tiene que rendir antes de que exista ganancia: en uno propio es lo
   que se pagó por él, y en uno consignado lo que hay que entregarle al dueño. Existe
   como función única porque el margen se muestra en tres pantallas y antes cada una
   restaba `costoAdquisicion`, que en consignación es 0 y devolvía el precio completo
   del auto como si fuera utilidad.

   PENDIENTE CON AUTORED: todavía no definen cómo se calcula la comisión de una
   consignación. Acá se asume precio piso pactado (la compraventa se queda con lo que
   pase de ese monto). Si resulta ser un porcentaje o un monto fijo por auto, se
   cambia esta función y no las pantallas. */
export function costoBase(car: Car): number {
  return car.tenencia === 'Consignado' ? car.precioPisoConsignacion : car.costoAdquisicion;
}

/* Días que el auto lleva en el patio, calculados desde fechaIngreso.

   Antes era un número guardado (`diasStock`) que se escribía una vez al crear el auto
   y nunca más se movía, así que el distintivo "+60 DÍAS", el promedio de días y el
   gráfico de antigüedad empezaban a mentir a la semana de uso real. */
export function diasEnStock(car: Pick<Car, 'fechaIngreso'>, hoy: Date = new Date()): number {
  if (!car.fechaIngreso) return 0;
  const ingreso = new Date(car.fechaIngreso + 'T00:00:00');
  const ms = hoy.getTime() - ingreso.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/* ===================== AUTOSAVE — INFORME DEL VEHÍCULO =====================
   El informe es un DERIVADO determinista del auto (ver src/autosave.ts), no se
   persiste: la automotora siempre lo tiene disponible. Lo que sí se guarda es el
   registro de las copias certificadas que se le venden al cliente (EnvioInforme). */

export type VeredictoAutosave = 'ok' | 'atencion' | 'critico';

export interface SiniestroRegistro {
  fecha: string;
  tipo: 'Colisión' | 'Choque múltiple' | 'Volcamiento' | 'Daño estético' | 'Evento climático';
  gravedad: 'Leve' | 'Moderado' | 'Grave' | 'Pérdida total';
  compania: string;
  montoReparacion: number;
  piezasAfectadas: string[];
  taller: string;
}

export interface RevisionTecnicaRegistro {
  fecha: string;
  planta: string;
  km: number;
  resultado: 'Aprobada' | 'Rechazada';
  observacion: string;
  // El odómetro de esta revisión contradice al kilometraje actual del vehículo.
  inconsistente: boolean;
}

export interface TitularRegistro {
  desde: string;
  hasta: string | null; // null = titular actual
  titular: string;
  tipo: 'Particular' | 'Empresa' | 'Rent a car' | 'Automotora' | 'Leasing';
  region: string;
  patente: string;
}

export interface MultaRegistro {
  fecha: string;
  juzgado: string;
  motivo: string;
  monto: number;
  pagada: boolean;
}

export interface PrendaRegistro {
  tipo: 'Prenda sin desplazamiento' | 'Leasing';
  acreedor: string;
  fechaConstitucion: string;
  saldoInsoluto: number;
  vigente: boolean;
}

export interface EncargoRegistro {
  vigente: boolean;
  fecha: string;
  juzgado: string;
  detalle: string;
}

export interface VeredictosInforme {
  encargo: VeredictoAutosave;
  siniestros: VeredictoAutosave;
  odometro: VeredictoAutosave;
  legal: VeredictoAutosave; // prenda + multas impagas
}

export interface InformeAutosave {
  folio: string;
  fechaConsulta: string;
  patente: string;
  vin: string;
  veredictoGeneral: VeredictoAutosave;
  veredictos: VeredictosInforme;
  resumen: string;
  encargo: EncargoRegistro;
  alertaOdometro: boolean;
  kmDeclaradoActual: number;
  kmUltimaRevision: number;
  importadora: string;
  fechaPrimeraInscripcion: string;
  // Tasación fiscal del SII: base del impuesto de transferencia junto al precio de operación.
  tasacionFiscal: number;
  prenda: PrendaRegistro | null;
  siniestros: SiniestroRegistro[];
  revisiones: RevisionTecnicaRegistro[];
  titulares: TitularRegistro[];
  multas: MultaRegistro[];
}

/** Copia certificada del informe vendida a un cliente. Esto sí se persiste. */
export interface EnvioInforme {
  id: number;
  folio: string;
  fecha: string;
  destinatario: 'Comprador' | 'Vendedor' | 'Otro';
  nombre: string;
  telefono: string;
  monto: number;
}

/* ================= AUTOSAVE — TRANSFERENCIA NOTARIAL ================= */

export type EstadoTransferencia =
  | 'Solicitada'
  | 'Documentos en revisión'
  | 'Firma de las partes'
  | 'Inscripción en Registro Civil'
  | 'Inscrita';

export type ModalidadTransferencia = 'Digital' | 'Presencial';
/** Directo: el dueño anterior transfiere al comprador. Automotora: el auto pasa por la automotora. */
export type TraspasoOrigen = 'Directo' | 'Automotora';
export type ResponsablePago = 'Comprador' | 'Vendedor' | 'Compartido';

export interface HitoTransferencia {
  estado: EstadoTransferencia;
  fecha: string | null; // null = pendiente
  detalle: string;
}

export interface CostoTransferencia {
  concepto: string;
  monto: number; // negativo = descuento
  nota: string;
}

export interface TransferenciaNotarial {
  folio: string;
  estado: EstadoTransferencia;
  origen: TraspasoOrigen;
  modalidad: ModalidadTransferencia;
  fechaSolicitud: string;
  fechaEstimadaEntrega: string;
  notaria: string;
  vendedor: VehicleContact;
  comprador: VehicleContact;
  precioOperacion: number;
  tasacionFiscal: number;
  baseImponible: number;
  responsablePago: ResponsablePago;
  costos: CostoTransferencia[];
  total: number;
  hitos: HitoTransferencia[];
  observacion: string;
}

export interface AuctionFeature {
  label: string;
  value: string;
}

export interface Auction {
  id: number;
  marca: string;
  modelo: string;
  version: string;
  anio: number;
  origen: string;
  costoFinal: number;
  sugeridoVenta: number;
  patente: string;
  km: number;
  color: string;
  transmision: string;
  combustible: string;
  imageUrl?: string;
  features?: AuctionFeature[];
  estado: 'Disponible' | 'Mis Ofertas' | 'Mi Subasta' | 'Adjudicada' | 'Perdida' | 'Vendida' | 'Finalizada' | 'Cancelada';
  sellerType: 'externo' | 'propio';
  stockId?: number | null;
  sellerNote: string;
  startedAt: string;
  endsAt: string;
  hiddenBestOffer?: number;
  receivedOffers?: number[];
  miOferta?: number;
  winningBid?: number;
}

/* Por dónde entró el cliente. Hoy todo se carga a mano; los leads del tasador web
   de Autored caen solos cuando abran la integración, y el campo existe desde ahora
   para recibirlos sin volver a tocar el modelo. */
export type CanalCliente = 'Carga manual' | 'Tasador web';

/* Qué anda buscando el cliente. El modelo NO sale del stock propio a propósito: el
   punto entero es poder registrar interés en un auto que todavía no tienes, que es
   justo el caso que la app no sabía representar. */
export interface BusquedaCliente {
  modelo: string;
  comentario: string;
}

export interface Customer {
  id: number;
  nombre: string;
  telefono: string;
  tipo: 'Particular' | 'Empresa';
  estado: string;
  canal: CanalCliente;
  busca: BusquedaCliente | null;
  archivado: boolean;
}

/* Qué une a un cliente con un auto.

   Antes esto vivía partido en tres campos del cliente (vehiculosAdquisicionIds,
   vehiculosVentaIds, reservadoId) más los contactos embebidos en el auto, y había
   que mantener las dos direcciones cuadradas a mano. Ahora es una lista sola.

   `reservadoId` no era un tipo de relación y por eso no está acá: la reserva se
   deriva de un cliente con relación de venta a un auto en estado Reservado.

   Los contactos embebidos del auto (clienteAdquisicion, comprador, consignante) se
   quedan donde estaban: sirven para mostrar el nombre sin ir a buscarlo a otra
   lista. Lo que se elimina es la duplicación en la dirección contraria. */
export type TipoRelacion = 'adquisicion' | 'venta' | 'consignacion' | 'oportunidad';

export interface RelacionClienteVehiculo {
  id: number;
  clienteId: number;
  vehiculoId: number;
  tipo: TipoRelacion;
  fecha: string; // YYYY-MM-DD
}

export function relacionesDeCliente(
  relaciones: RelacionClienteVehiculo[],
  clienteId: number,
): RelacionClienteVehiculo[] {
  return relaciones.filter((r) => r.clienteId === clienteId);
}

export function relacionesDeVehiculo(
  relaciones: RelacionClienteVehiculo[],
  vehiculoId: number,
): RelacionClienteVehiculo[] {
  return relaciones.filter((r) => r.vehiculoId === vehiculoId);
}

/* El rol comercial ya no se guarda, se deduce: quien tiene una relación de
   adquisición o de consignación es un cliente de adquisición, y quien tiene una de
   venta es un cliente de venta. Antes se elegía a mano en el formulario y quedaba
   desalineado con los autos que el cliente realmente tenía. */
export function esClienteDeAdquisicion(relaciones: RelacionClienteVehiculo[]): boolean {
  return relaciones.some((r) => r.tipo === 'adquisicion' || r.tipo === 'consignacion');
}

export function esClienteDeVenta(relaciones: RelacionClienteVehiculo[]): boolean {
  return relaciones.some((r) => r.tipo === 'venta');
}

/* Modelos frecuentes del mercado chileno, para sugerir mientras se escribe qué busca
   el cliente. Es una ayuda, no una restricción: el campo acepta cualquier texto. */
export const MODELOS_BUSCADOS: string[] = [
  'BYD Dolphin',
  'Changan CS35',
  'Chery Tiggo',
  'Chevrolet Groove',
  'Chevrolet Onix',
  'Chevrolet Sail',
  'Ford EcoSport',
  'Ford Ranger',
  'Great Wall Poer',
  'Honda Fit',
  'Hyundai Accent',
  'Hyundai Grand i10',
  'Hyundai Tucson',
  'JAC S2',
  'Kia Morning',
  'Kia Rio',
  'Kia Sportage',
  'Mazda 3',
  'Mazda CX-5',
  'MG ZS',
  'Mitsubishi L200',
  'Nissan Qashqai',
  'Nissan Versa',
  'Peugeot 208',
  'Renault Kwid',
  'Subaru XV',
  'Suzuki Baleno',
  'Suzuki Swift',
  'Suzuki Vitara',
  'Toyota Corolla',
  'Toyota Hilux',
  'Toyota RAV4',
  'Toyota Yaris',
  'Volkswagen Gol',
  'Volkswagen Polo',
];

export const INITIAL_STOCK_DATA: Car[] = [
  {
    id: 1,
    patente: 'KD-PT-45',
    vin: '',
    tipoVehiculo: 'Vehículo liviano',
    marca: 'Kia',
    modelo: 'Morning',
    version: '1.2 EX Full',
    anio: 2019,
    anioFabricacion: 2019,
    sucursal: 'Mayorista',
    fechaIngreso: '2026-07-01',
    km: 58000,
    color: 'Gris Plata',
    transmision: 'Manual',
    combustible: 'Bencina',
    traccion: '4x2',
    cilindrada: 1200,
    puertas: '5',
    equipamiento: ['Aire acondicionado', 'Airbags', 'Bluetooth'],
    otros: '',
    origen: 'Nacional',
    precioVenta: 7890000,
    precioPublicacionContado: 7890000,
    precioPublicacionFinanciado: 8190000,
    precioVentaEstimado: 7800000,
    costoAdquisicion: 5900000,
    estado: 'En venta',
    fotos: [
      'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
    ],
    comentario: 'Súper económico, único dueño, mantenciones al día.',
    documentos: [],
    clienteAdquisicion: {
      clienteId: null,
      nombre: 'Dueño anterior',
      telefono: '',
    },
    comprador: null,
    tenencia: 'Propio',
    consignante: null,
    precioPisoConsignacion: 0,
    fechaVenta: null,
    financiado: null,
    visitas: [
      { id: 1, fecha: '2026-08-06', clienteId: 3, nombre: 'Carolina Soto' },
    ],
  },
  {
    id: 2,
    patente: 'PL-GR-88',
    vin: '',
    tipoVehiculo: 'Vehículo liviano',
    marca: 'Suzuki',
    modelo: 'Swift',
    version: '1.2 GLX Smt',
    anio: 2021,
    anioFabricacion: 2021,
    sucursal: 'Mayorista',
    fechaIngreso: '2026-07-07',
    km: 32000,
    color: 'Azul Eléctrico',
    transmision: 'Manual',
    combustible: 'Bencina',
    traccion: '4x2',
    cilindrada: 1200,
    puertas: '5',
    equipamiento: ['Aire acondicionado', 'Cierre centralizado', 'Pantalla táctil'],
    otros: 'En proceso de preparación estética.',
    origen: 'Nacional',
    precioVenta: 9490000,
    precioPublicacionContado: 9490000,
    precioPublicacionFinanciado: 9790000,
    precioVentaEstimado: 9300000,
    costoAdquisicion: 7200000,
    estado: 'En preparación',
    fotos: [
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=600&q=80',
    ],
    comentario: 'Detalle menor en tapabarro derecho. En pulido.',
    documentos: [],
    clienteAdquisicion: null,
    comprador: null,
    tenencia: 'Propio',
    consignante: null,
    precioPisoConsignacion: 0,
    fechaVenta: null,
    financiado: null,
    visitas: [],
  },
  {
    id: 3,
    patente: 'JZ-WY-12',
    vin: '',
    tipoVehiculo: 'Vehículo liviano',
    marca: 'Toyota',
    modelo: 'Yaris',
    version: '1.5 XLI',
    anio: 2018,
    anioFabricacion: 2018,
    sucursal: 'Mayorista',
    fechaIngreso: '2026-05-08',
    km: 105000,
    color: 'Blanco',
    transmision: 'Automático',
    combustible: 'Bencina',
    traccion: '4x2',
    cilindrada: 1500,
    puertas: '4',
    equipamiento: ['Airbags', 'Frenos ABS', 'Bluetooth'],
    otros: '',
    origen: 'Nacional',
    precioVenta: 8990000,
    precioPublicacionContado: 8990000,
    precioPublicacionFinanciado: 9290000,
    precioVentaEstimado: 8800000,
    costoAdquisicion: 0, // consignado: no se compró
    estado: 'En venta',
    fotos: [
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
    ],
    comentario:
      'Consignado por Automotora Melipilla. Lleva más de 60 días. Requiere revisión de precio o promo.',
    documentos: [],
    clienteAdquisicion: null,
    comprador: null,
    tenencia: 'Consignado',
    consignante: {
      clienteId: 2,
      nombre: 'Automotora Melipilla SpA',
      telefono: '+56 9 7123 9988',
    },
    precioPisoConsignacion: 7500000,
    fechaVenta: null,
    financiado: null,
    visitas: [
      { id: 1, fecha: '2026-07-28', clienteId: null, nombre: '' },
      { id: 2, fecha: '2026-08-05', clienteId: null, nombre: '' },
    ],
  },
  {
    id: 4,
    patente: 'LS-CS-34',
    vin: '',
    tipoVehiculo: 'Vehículo liviano',
    marca: 'Mazda',
    modelo: '3',
    version: '2.0 Sport V',
    anio: 2020,
    anioFabricacion: 2020,
    sucursal: 'Mayorista',
    fechaIngreso: '2026-06-20',
    km: 45000,
    color: 'Rojo Cristal',
    transmision: 'Automático',
    combustible: 'Bencina',
    traccion: '4x2',
    cilindrada: 2000,
    puertas: '4',
    equipamiento: ['Climatizador', 'Cámara retroceso', 'Control crucero'],
    otros: '',
    origen: 'Nacional',
    precioVenta: 13290000,
    precioPublicacionContado: 13290000,
    precioPublicacionFinanciado: 13690000,
    precioVentaEstimado: 12990000,
    costoAdquisicion: 10800000,
    estado: 'Reservado',
    fotos: [
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=600&q=80',
    ],
    comentario:
      'Reserva de palabra de Marcelo Aravena. Esperando aprobación de crédito.',
    documentos: [],
    clienteAdquisicion: null,
    comprador: {
      clienteId: 1,
      nombre: 'Marcelo Aravena',
      telefono: '+56 9 8456 1234',
    },
    tenencia: 'Propio',
    consignante: null,
    precioPisoConsignacion: 0,
    fechaVenta: null, // reservado, todavía no vendido
    financiado: null,
    visitas: [
      { id: 1, fecha: '2026-07-30', clienteId: 1, nombre: 'Marcelo Aravena' },
    ],
  },
  {
    id: 5,
    patente: 'RC-VB-56',
    vin: '',
    tipoVehiculo: 'Vehículo liviano',
    marca: 'Hyundai',
    modelo: 'Accent',
    version: '1.4 GL Value',
    anio: 2022,
    anioFabricacion: 2022,
    sucursal: 'Mayorista',
    fechaIngreso: '2026-05-28',
    km: 28000,
    color: 'Gris Oscuro',
    transmision: 'Manual',
    combustible: 'Bencina',
    traccion: '4x2',
    cilindrada: 1400,
    puertas: '4',
    equipamiento: ['Aire acondicionado', 'Airbags', 'Cierre centralizado'],
    otros: '',
    origen: 'Nacional',
    precioVenta: 11190000,
    precioPublicacionContado: 11190000,
    precioPublicacionFinanciado: 11490000,
    precioVentaEstimado: 10990000,
    costoAdquisicion: 8900000,
    estado: 'Vendido',
    fotos: [
      'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=600&q=80',
    ],
    comentario: 'Vendido al contado el 04 de Agosto.',
    documentos: [],
    clienteAdquisicion: null,
    comprador: {
      clienteId: null,
      nombre: 'Rodrigo Fuentes',
      telefono: '+56 9 6677 1122',
    },
    tenencia: 'Propio',
    consignante: null,
    precioPisoConsignacion: 0,
    fechaVenta: '2026-08-04',
    financiado: false, // se pagó al contado
    visitas: [
      { id: 1, fecha: '2026-07-22', clienteId: null, nombre: 'Rodrigo Fuentes' },
    ],
    // Transferencia notarial ya en curso: es el auto que muestra el seguimiento de AutoSave
    // sin tener que generarla primero. Los montos coinciden con cotizarTransferencia().
    transferencia: {
      folio: 'TR-2026-13438',
      estado: 'Firma de las partes',
      origen: 'Automotora',
      modalidad: 'Digital',
      fechaSolicitud: '2026-07-08',
      fechaEstimadaEntrega: '2026-07-15',
      notaria: 'AutoSave Digital (firma electrónica avanzada)',
      vendedor: { clienteId: null, nombre: 'Automotora AutoRed SpA', telefono: '+56 2 2345 6789' },
      comprador: { clienteId: null, nombre: 'Rodrigo Fuentes', telefono: '+56 9 6677 1122' },
      precioOperacion: 11190000,
      tasacionFiscal: 8060000,
      baseImponible: 11190000,
      responsablePago: 'Comprador',
      costos: [
        {
          concepto: 'Impuesto de transferencia (1,5%)',
          monto: 167850,
          nota: 'Se calcula sobre el precio de la operación.',
        },
        { concepto: 'Firma electrónica avanzada', monto: 12900, nota: '' },
        { concepto: 'Inscripción en Registro Civil', monto: 12900, nota: '' },
        { concepto: 'Gestión AutoSave', monto: 24900, nota: '' },
        {
          concepto: 'Copia certificada del informe AutoSave',
          monto: 0,
          nota: 'Incluida en la transferencia.',
        },
      ],
      total: 218550,
      hitos: [
        { estado: 'Solicitada', fecha: '2026-07-08', detalle: 'AutoSave recibió la solicitud y asignó folio.' },
        {
          estado: 'Documentos en revisión',
          fecha: '2026-07-09',
          detalle: 'Se validan padrón, permiso de circulación y multas.',
        },
        {
          estado: 'Firma de las partes',
          fecha: '2026-07-10',
          detalle: 'Comprador y vendedor firman la escritura de compraventa.',
        },
        {
          estado: 'Inscripción en Registro Civil',
          fecha: null,
          detalle: 'Ingreso al Registro de Vehículos Motorizados.',
        },
        { estado: 'Inscrita', fecha: null, detalle: 'Transferencia inscrita. Padrón emitido a nombre del comprador.' },
      ],
      observacion: '',
    },
    informesEnviados: [],
  },
  {
    id: 6,
    patente: 'HV-XP-90',
    vin: '',
    tipoVehiculo: 'Vehículo liviano',
    marca: 'Chevrolet',
    modelo: 'Sail',
    version: '1.5 LT',
    anio: 2017,
    anioFabricacion: 2017,
    sucursal: 'Mayorista',
    fechaIngreso: '2026-07-10',
    km: 98000,
    color: 'Azul Metálico',
    transmision: 'Manual',
    combustible: 'Bencina',
    traccion: '4x2',
    cilindrada: 1500,
    puertas: '4',
    equipamiento: ['Aire acondicionado', 'Frenos ABS'],
    otros: '',
    origen: 'Nacional',
    precioVenta: 6490000,
    precioPublicacionContado: 6490000,
    precioPublicacionFinanciado: 6790000,
    precioVentaEstimado: 6300000,
    costoAdquisicion: 4800000,
    estado: 'Pre-stock',
    fotos: [
      'https://images.unsplash.com/photo-1532581291347-9c39cf10a73c?auto=format&fit=crop&w=600&q=80',
    ],
    comentario: 'Comprado a particular, esperando retiro.',
    documentos: [],
    clienteAdquisicion: {
      clienteId: null,
      nombre: 'Particular por contactar',
      telefono: '',
    },
    comprador: null,
    tenencia: 'Propio',
    consignante: null,
    precioPisoConsignacion: 0,
    fechaVenta: null,
    financiado: null,
    visitas: [],
  },
];

const AUCTION_HOUR_MS = 60 * 60 * 1000;
const auctionTimestamp = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

export const INITIAL_AUCTIONS: Auction[] = [
  {
    id: 101,
    marca: 'Suzuki',
    modelo: 'Baleno',
    version: '1.4 GLS MT',
    anio: 2021,
    origen: 'Remate Macal',
    costoFinal: 8500000,
    sugeridoVenta: 10490000,
    patente: 'PL-SD-19',
    km: 38000,
    color: 'Gris Grafito',
    transmision: 'Manual',
    combustible: 'Bencina',
    imageUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80',
    features: [
      { label: 'Documentos', value: 'Transferencia lista' },
      { label: 'Inspección', value: 'Mantenciones respaldadas' },
      { label: 'Neumáticos', value: '70% vida útil' },
      { label: 'Observación', value: 'Tope trasero con detalle menor' },
    ],
    estado: 'Adjudicada',
    sellerType: 'externo',
    sellerNote: 'Unidad institucional con mantenciones documentadas. Detalle menor en parachoques trasero.',
    startedAt: auctionTimestamp(-6 * AUCTION_HOUR_MS),
    endsAt: auctionTimestamp(-2 * AUCTION_HOUR_MS),
    miOferta: 8500000,
    hiddenBestOffer: 8400000,
    winningBid: 8500000,
  },
  {
    id: 102,
    marca: 'Ford',
    modelo: 'EcoSport',
    version: '1.5 Titanium',
    anio: 2018,
    origen: 'Subasta Tattersall',
    costoFinal: 7200000,
    sugeridoVenta: 8990000,
    patente: 'JY-HH-52',
    km: 84000,
    color: 'Plata',
    transmision: 'Automático',
    combustible: 'Bencina',
    imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=80',
    features: [
      { label: 'Documentos', value: 'Revisión técnica vigente' },
      { label: 'Carrocería', value: 'Detalles de uso normales' },
      { label: 'Interior', value: 'Limpio, sin roturas visibles' },
      { label: 'Entrega', value: 'Disponible en 48 horas' },
    ],
    estado: 'Disponible',
    sellerType: 'externo',
    sellerNote: 'Subasta a sobre cerrado. Vehículo operativo, documentación al día y revisión visual disponible.',
    startedAt: auctionTimestamp(-35 * 60 * 1000),
    endsAt: auctionTimestamp(3 * AUCTION_HOUR_MS + 25 * 60 * 1000),
    hiddenBestOffer: 6900000,
  },
  {
    id: 201,
    marca: 'Toyota',
    modelo: 'Yaris',
    version: '1.5 XLI CVT',
    anio: 2020,
    origen: 'Autored Subastas',
    costoFinal: 7800000,
    sugeridoVenta: 9790000,
    patente: 'HRRZ95',
    km: 64000,
    color: 'Blanco',
    transmision: 'Automático',
    combustible: 'Bencina',
    imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=900&q=80',
    features: [
      { label: 'Documentos', value: 'SOAP y permiso al día' },
      { label: 'Uso', value: 'Ciudad, bajo desgaste interior' },
      { label: 'Llaves', value: '2 llaves declaradas' },
      { label: 'Observación', value: 'Ideal para rotación rápida' },
    ],
    estado: 'Disponible',
    sellerType: 'externo',
    sellerNote: 'Unidad urbana, interior limpio, documentación lista para revisión. Subasta a sobre cerrado.',
    startedAt: auctionTimestamp(-20 * 60 * 1000),
    endsAt: auctionTimestamp(3 * AUCTION_HOUR_MS + 40 * 60 * 1000),
    hiddenBestOffer: 7600000,
  },
  {
    id: 202,
    marca: 'Chevrolet',
    modelo: 'Onix',
    version: '1.0 Turbo RS MT',
    anio: 2022,
    origen: 'Flota Empresas',
    costoFinal: 8600000,
    sugeridoVenta: 10890000,
    patente: 'RVRY98',
    km: 65000,
    color: 'Azul',
    transmision: 'Manual',
    combustible: 'Bencina',
    imageUrl: 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=900&q=80',
    features: [
      { label: 'Documentos', value: 'Historial de flota disponible' },
      { label: 'Mecánica', value: 'Funcionamiento normal declarado' },
      { label: 'Exterior', value: 'Rayas menores en puertas' },
      { label: 'Entrega', value: 'Retiro desde patio central' },
    ],
    estado: 'Disponible',
    sellerType: 'externo',
    sellerNote: 'Vehículo de flota con historial ordenado. Detalles estéticos menores propios del uso.',
    startedAt: auctionTimestamp(-70 * 60 * 1000),
    endsAt: auctionTimestamp(2 * AUCTION_HOUR_MS + 50 * 60 * 1000),
    hiddenBestOffer: 8450000,
  },
  {
    id: 203,
    marca: 'Volkswagen',
    modelo: 'Golf',
    version: '1.4 TSI Comfortline',
    anio: 2018,
    origen: 'Concesionario Bilbao',
    costoFinal: 9500000,
    sugeridoVenta: 11990000,
    patente: 'KHDH75',
    km: 62300,
    color: 'Gris',
    transmision: 'Automático',
    combustible: 'Bencina',
    imageUrl: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=900&q=80',
    features: [
      { label: 'Documentos', value: 'Sin prenda informada' },
      { label: 'Equipamiento', value: 'Climatizador, cámara, sensores' },
      { label: 'Interior', value: 'Tapiz en buen estado' },
      { label: 'Observación', value: 'Buena unidad para sala' },
    ],
    estado: 'Disponible',
    sellerType: 'externo',
    sellerNote: 'Buen estado general, neumáticos buenos y mantenciones respaldadas. Se vende visto y aprobado.',
    startedAt: auctionTimestamp(-95 * 60 * 1000),
    endsAt: auctionTimestamp(2 * AUCTION_HOUR_MS + 25 * 60 * 1000),
    hiddenBestOffer: 9300000,
  },
  {
    id: 204,
    marca: 'Ford',
    modelo: 'F-150',
    version: '5.0 Lariat Luxury AT 4x4',
    anio: 2018,
    origen: 'Remate Norte',
    costoFinal: 19500000,
    sugeridoVenta: 23900000,
    patente: 'KDLS49',
    km: 183000,
    color: 'Negro',
    transmision: 'Automático',
    combustible: 'Bencina',
    imageUrl: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=900&q=80',
    features: [
      { label: 'Documentos', value: 'Transferible con revisión previa' },
      { label: 'Tracción', value: '4x4 declarada operativa' },
      { label: 'Uso', value: 'Trabajo liviano y carretera' },
      { label: 'Observación', value: 'Requiere revisión estética' },
    ],
    estado: 'Disponible',
    sellerType: 'externo',
    sellerNote: 'Camioneta 4x4 con alto kilometraje, motor operativo y revisión documental disponible.',
    startedAt: auctionTimestamp(-45 * 60 * 1000),
    endsAt: auctionTimestamp(3 * AUCTION_HOUR_MS + 15 * 60 * 1000),
    hiddenBestOffer: 19100000,
  },
  {
    id: 103,
    marca: 'Nissan',
    modelo: 'Qashqai',
    version: '2.0 Sense',
    anio: 2019,
    origen: 'Remate Santander',
    costoFinal: 10100000,
    sugeridoVenta: 12490000,
    patente: 'KW-PL-10',
    km: 72000,
    color: 'Blanco Perla',
    transmision: 'Manual',
    combustible: 'Bencina',
    imageUrl: 'https://images.unsplash.com/photo-1494905998402-395d579af36f?auto=format&fit=crop&w=900&q=80',
    features: [
      { label: 'Documentos', value: 'Listos para transferencia' },
      { label: 'Seguridad', value: 'Airbags y ABS declarados' },
      { label: 'Interior', value: 'Uso particular cuidado' },
      { label: 'Observación', value: 'Neumáticos delanteros a revisar' },
    ],
    estado: 'Mis Ofertas',
    sellerType: 'externo',
    sellerNote: 'Unidad con uso particular, neumáticos buenos y documentación lista para transferencia.',
    startedAt: auctionTimestamp(-2 * AUCTION_HOUR_MS - 45 * 60 * 1000),
    endsAt: auctionTimestamp(75 * 60 * 1000),
    hiddenBestOffer: 9900000,
    miOferta: 9800000,
  },
  {
    id: 104,
    marca: 'Kia',
    modelo: 'Morning',
    version: '1.2 EX Full',
    anio: 2019,
    origen: 'Mi stock',
    costoFinal: 5900000,
    sugeridoVenta: 7890000,
    patente: 'KD-PT-45',
    km: 58000,
    color: 'Gris Plata',
    transmision: 'Manual',
    combustible: 'Bencina',
    imageUrl: 'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=900&q=80',
    estado: 'Mi Subasta',
    sellerType: 'propio',
    stockId: 1,
    sellerNote: 'Disponible para mayoristas. Económico, mantenciones al día y entrega inmediata.',
    startedAt: auctionTimestamp(-50 * 60 * 1000),
    endsAt: auctionTimestamp(3 * AUCTION_HOUR_MS + 10 * 60 * 1000),
    receivedOffers: [5750000, 6100000],
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 1,
    nombre: 'Marcelo Aravena',
    telefono: '+56 9 8456 1234',
    tipo: 'Particular',
    estado: 'Caliente',
    canal: 'Carga manual',
    busca: null, // ya encontró lo suyo: tiene el Mazda 3 reservado
    archivado: false,
  },
  {
    id: 2,
    nombre: 'Automotora Melipilla SpA',
    telefono: '+56 9 7123 9988',
    tipo: 'Empresa',
    estado: 'Frecuente',
    canal: 'Carga manual',
    busca: { modelo: '', comentario: 'Revendedor: compra varios, sin modelo fijo.' },
    archivado: false,
  },
  {
    id: 3,
    nombre: 'Carolina Soto',
    telefono: '+56 9 5544 3322',
    tipo: 'Particular',
    estado: 'Interesado',
    canal: 'Tasador web', // lead que cayó solo, el caso que Autored quiere alimentar
    busca: { modelo: 'Kia Morning', comentario: 'Automático, tope 7 millones.' },
    archivado: false,
  },
];

/* Las relaciones que antes estaban implícitas en los ids que guardaba cada cliente.
   Las derivables desde los contactos embebidos del auto las vuelve a armar
   syncStockAndCustomers en cada carga; las de tipo 'oportunidad' viven solo acá,
   porque no cuelgan de ningún contacto del auto. */
export const INITIAL_RELACIONES: RelacionClienteVehiculo[] = [
  // Marcelo Aravena tiene el Mazda 3 reservado.
  { id: 1, clienteId: 1, vehiculoId: 4, tipo: 'venta', fecha: '2026-08-02' },
  // Automotora Melipilla dejó el Toyota Yaris en consignación.
  { id: 2, clienteId: 2, vehiculoId: 3, tipo: 'consignacion', fecha: '2026-05-08' },
];

export const ESTADOS: EstadoAuto[] = [
  'Pre-stock',
  'En preparación',
  'En venta',
  'Reservado',
  'Vendido',
];
