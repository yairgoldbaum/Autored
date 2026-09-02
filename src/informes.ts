/* Sección de Informes (ronda 3, punto 4). Nació de Mauro: "podría haber como una
   sección donde yo directamente voy a sacar los informes vehiculares y que me
   pueda meter a ver el historial de todos los informes que he sacado".

   Lo que este archivo resuelve es el puente que faltaba: `generarInformeAutosave`
   recibe un auto completo, no una patente, y acá se saca informe de autos que
   todavía no son tuyos. */
import { Car, EstadoAuto } from './data';
import { buscarFichaPatente, buscarPatente, normalizarPatente } from './pricing';

/* Los tres que muestra la pantalla de Autored (david-pantallas-1.png). No son tres
   informes distintos: son tres recortes del mismo, para que el CAV y el completo de
   una misma patente nunca se contradigan. */
export type TipoInforme = 'Autored Completo' | 'CAV' | 'Multas';

export const TIPOS_INFORME: TipoInforme[] = ['Autored Completo', 'CAV', 'Multas'];

export const ETIQUETA_TIPO_INFORME: Record<TipoInforme, string> = {
  'Autored Completo': 'Informe Autored Completo',
  CAV: 'CAV',
  Multas: 'Certificado de Multas',
};

/** Qué muestra cada tipo. El completo trae todo; los otros dos recortan. */
export const RESUMEN_TIPO_INFORME: Record<TipoInforme, string> = {
  'Autored Completo': 'Siniestros, revisiones, titulares, multas, prenda y encargo',
  CAV: 'Titulares, prendas y encargos, que es lo que certifica un CAV',
  Multas: 'Solo las multas del vehículo',
};

/* Una compra del historial. Esto sí se persiste.

   Guarda lo mínimo: patente, tipo y fecha. El folio, la marca y el modelo NO se
   guardan porque se derivan de la patente y guardarlos sería tener dos verdades
   que se pueden contradecir — el folio sale del hash de la patente, así que un
   valor escrito a mano en las semillas dejaría de coincidir con el informe que
   abre esa misma fila. */
export interface InformeComprado {
  id: number;
  patente: string;
  tipo: TipoInforme;
  fecha: string; // YYYY-MM-DD
}

/* El auto que alimenta al generador del informe.

   Si la patente está en el stock se devuelve ESE auto, para que el semáforo que
   muestra la ficha y el informe sacado desde acá sean el mismo objeto y la demo no
   se contradiga sola. Si no está, se arma uno sintético con la ficha del registro
   —el mismo que usa el alta por patente— y no se persiste en ningún lado. */
export function autoParaPatente(patenteRaw: string, stock: Car[]): Car | null {
  const patente = normalizarPatente(patenteRaw);
  if (patente.length < 6) return null;

  const enStock = stock.find((c) => normalizarPatente(c.patente) === patente);
  if (enStock) return enStock;

  // buscarFichaPatente devuelve null para las patentes que la demo deja sin registro;
  // buscarPatente siempre responde, así que sirve de respaldo y el informe nunca falla.
  const ficha = buscarFichaPatente(patente);
  const base = ficha || buscarPatente(patente);
  if (!base) return null;

  const km = ficha ? ficha.kmPermiso : 0;
  return {
    id: -1, // negativo: no es del stock y nadie lo va a buscar por id
    patente,
    vin: ficha ? ficha.vin : '',
    tipoVehiculo: ficha ? ficha.tipoVehiculo : 'Vehículo liviano',
    marca: base.marca,
    modelo: base.modelo,
    version: base.version,
    anio: base.anio,
    anioFabricacion: ficha ? ficha.anioFabricacion : base.anio,
    sucursal: '',
    fechaIngreso: '',
    km,
    color: ficha ? ficha.color : '',
    transmision: base.transmision,
    combustible: base.combustible,
    traccion: ficha ? ficha.traccion : '',
    cilindrada: ficha ? ficha.cilindrada : 0,
    puertas: ficha ? ficha.puertas : '',
    equipamiento: [],
    otros: '',
    origen: '',
    // El informe usa el precio para la tasación fiscal: se usa la referencia del
    // registro, que es lo único que se sabe de un auto que no es tuyo.
    precioVenta: base.referencia,
    precioPublicacionContado: base.referencia,
    precioPublicacionFinanciado: base.referencia,
    precioVentaEstimado: base.referencia,
    costoAdquisicion: 0,
    estado: 'En venta' as EstadoAuto,
    fotos: [],
    comentario: '',
    documentos: [],
    clienteAdquisicion: null,
    comprador: null,
    tenencia: 'Propio',
    consignante: null,
    precioPisoConsignacion: 0,
    fechaVenta: null,
    financiado: null,
  };
}

/** ¿La patente de este informe es un auto del patio? Decide qué acciones se ofrecen. */
export function estaEnStock(patenteRaw: string, stock: Car[]): boolean {
  const patente = normalizarPatente(patenteRaw);
  return stock.some((c) => normalizarPatente(c.patente) === patente);
}
