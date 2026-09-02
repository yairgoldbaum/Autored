/* Módulo de Transferencias (ronda 3, punto 5), con el alcance que recortó el propio
   David en la reunión del 21-08: "no creo que sea exigente que ustedes armen todo el
   módulo de transferencia en la app, porque tenemos un equipo detrás que ya tiene
   todo ese know-how de los distintos casos". Y concreto: "que pongan esa vista de
   tabla, que vean el ejemplo que tiene todas sus transferencias, que pueda crear una
   transferencia y que lo lleve a la pantalla inicial donde selecciona el tipo. Hasta
   ahí es suficiente".

   No confundir con el trámite notarial de src/autosave.ts, que salió de la ficha con
   el punto 7 y quedó desconectado. Esto es la lista de solicitudes de Autored. */

/* Los cuatro de david-pantallas-2.png, con la descripción textual de esa pantalla. */
export type TipoTransferencia =
  | 'Automotora Vende'
  | 'Automotora Compra'
  | 'Contrato Abierto'
  | 'Automotora Gestiona';

export const TIPOS_TRANSFERENCIA: TipoTransferencia[] = [
  'Automotora Vende',
  'Automotora Compra',
  'Contrato Abierto',
  'Automotora Gestiona',
];

/* La sigla es lo que la tabla de ellos muestra en la columna TIPO ("AG - Automotora
   Gestiona"). En el teléfono va sola, que es lo que cabe. */
export const SIGLA_TRANSFERENCIA: Record<TipoTransferencia, string> = {
  'Automotora Vende': 'AV',
  'Automotora Compra': 'AC',
  'Contrato Abierto': 'CA',
  'Automotora Gestiona': 'AG',
};

export const DESCRIPCION_TRANSFERENCIA: Record<TipoTransferencia, string> = {
  'Automotora Vende': 'La automotora realiza la venta de un vehículo de su propiedad.',
  'Automotora Compra': 'La automotora realiza la transferencia de un vehículo de propiedad de un tercero a su nombre.',
  'Contrato Abierto':
    'El contrato de compraventa queda abierto a través de un mandato y se completa una vez que el vehículo es vendido a un nuevo comprador.',
  'Automotora Gestiona': 'La automotora gestiona el proceso de transferencia de un vehículo entre dos o más participantes.',
};

export const ICONO_TRANSFERENCIA: Record<TipoTransferencia, string> = {
  'Automotora Vende': 'cart-shopping',
  'Automotora Compra': 'car',
  'Contrato Abierto': 'file-lines',
  'Automotora Gestiona': 'handshake',
};

/* Los estados son los del sistema de Autored, no un vocabulario nuestro: salen de los
   cuatro contadores de andres-transferencias-2.png más el que se ve en la tabla. Los
   pasos internos que explicó Andrés —documentos, formulario, firma, impuestos— no
   entran: son el flujo que ellos van a construir, no lo que el compraventero necesita
   leer de un vistazo. */
export type EstadoTransferencia =
  | 'Pendiente'
  | 'AutoSafe transfiere'
  | 'En registro civil'
  | 'Finalizada'
  | 'Rechazada';

export const ESTADOS_TRANSFERENCIA: EstadoTransferencia[] = [
  'Pendiente',
  'AutoSafe transfiere',
  'En registro civil',
  'Finalizada',
  'Rechazada',
];

/* Los cuatro filtros que el plan mandaba dejar detrás de un botón, igual que hace el
   Stock. Los dos visibles —patente y estado— viven aparte, en la pantalla.

   Las fechas van por MES y no por día: la captura de Autored es de escritorio y tiene
   dos selectores de calendario, que en un teléfono piden un componente entero. El mes
   alcanza para lo que se busca acá ("las de julio para atrás") y reusa el vocabulario
   que los KPIs ya usan. Formato 'AAAA-MM', o '' para no filtrar. */
export interface FiltrosTransferencia {
  desde: string;
  hasta: string;
  marca: string;
  modelo: string;
}

export function emptyFiltrosTransferencia(): FiltrosTransferencia {
  return { desde: '', hasta: '', marca: '', modelo: '' };
}

export function hayFiltrosTransferencia(f: FiltrosTransferencia): boolean {
  return !!(f.desde || f.hasta || f.marca || f.modelo);
}

/* Una fila de la tabla. Igual que el historial de informes, guarda lo mínimo: la
   marca, el modelo y el año se derivan de la patente, para no tener dos verdades. */
export interface SolicitudTransferencia {
  id: number;
  solicitud: number; // el número que Autored muestra en la columna SOLICITUD
  patente: string;
  tipo: TipoTransferencia;
  estado: EstadoTransferencia;
  fecha: string; // YYYY-MM-DD, la creación
}
