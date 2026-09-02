// Motor de Precios — prueba de concepto SIN backend.
// Todos los valores son imaginarios y se calculan localmente de forma determinista.

export interface VehiculoRegistro {
  marca: string;
  modelo: string;
  version: string;
  anio: number;
  transmision: string;
  combustible: string;
  // Precio de referencia de VENTA (retail) para ese modelo/año con kilometraje "normal"
  referencia: number;
}

/* La ficha completa que devuelve la consulta de patente en el alta: lo que
   traería el registro civil más el último permiso de circulación. Datos del
   vehículo, nunca precios — los precios los sigue poniendo la tasación. */
export interface FichaPatente extends VehiculoRegistro {
  tipoVehiculo: 'Vehículo liviano' | 'Vehículo pesado' | 'Moto';
  anioFabricacion: number;
  vin: string;
  color: string;
  traccion: string;
  puertas: string;
  cilindrada: number;
  kmPermiso: number; // kilometraje declarado en el último permiso de circulación
}

export interface Comparable {
  fuente: string;
  titulo: string;
  km: number;
  precio: number;
}

export interface Tasacion {
  vehiculo: VehiculoRegistro;
  km: number;
  kmEsperado: number;
  ajusteKm: number;
  precioVenta: number;   // a cuánto lo publico
  ofertaMin: number;     // venta - 30%
  ofertaMax: number;     // venta - 25%
  margenMin: number;     // margen si compro al techo
  margenMax: number;     // margen si compro al piso
  confianza: number;     // 0-100
  comparables: Comparable[];
}

const ANIO_ACTUAL = new Date().getFullYear();
const KM_POR_ANIO = 15000;
const PESOS_POR_KM = 14; // cuánto pesa cada km de diferencia contra lo esperado

// Registro ficticio de patentes (simula la consulta al registro civil / base interna)
const REGISTRO: Record<string, FichaPatente> = {
  KDPT45: { marca: 'Kia', modelo: 'Morning', version: '1.2 EX Full', anio: 2019, transmision: 'Manual', combustible: 'Bencina', referencia: 7890000, tipoVehiculo: 'Vehículo liviano', anioFabricacion: 2018, vin: 'KNABX512BKT471902', color: 'Gris Plata', traccion: '4x2', puertas: '5', cilindrada: 1248, kmPermiso: 58400 },
  PLGR88: { marca: 'Suzuki', modelo: 'Swift', version: '1.2 GLX', anio: 2021, transmision: 'Manual', combustible: 'Bencina', referencia: 9490000, tipoVehiculo: 'Vehículo liviano', anioFabricacion: 2020, vin: 'MMSZC53S1MW308114', color: 'Blanco Perla', traccion: '4x2', puertas: '5', cilindrada: 1242, kmPermiso: 33700 },
  JZWY12: { marca: 'Toyota', modelo: 'Yaris', version: '1.5 XLI', anio: 2018, transmision: 'Automático', combustible: 'Bencina', referencia: 8990000, tipoVehiculo: 'Vehículo liviano', anioFabricacion: 2017, vin: 'JTDKB20U693520471', color: 'Negro', traccion: '4x2', puertas: '4', cilindrada: 1496, kmPermiso: 78200 },
  LSCS34: { marca: 'Mazda', modelo: '3', version: '2.0 Sport V', anio: 2020, transmision: 'Automático', combustible: 'Bencina', referencia: 13290000, tipoVehiculo: 'Vehículo liviano', anioFabricacion: 2019, vin: 'JM7BM4271L1620933', color: 'Rojo Soul', traccion: '4x2', puertas: '5', cilindrada: 1998, kmPermiso: 45900 },
  RCVB56: { marca: 'Hyundai', modelo: 'Accent', version: '1.4 GL Value', anio: 2022, transmision: 'Manual', combustible: 'Bencina', referencia: 11190000, tipoVehiculo: 'Vehículo liviano', anioFabricacion: 2021, vin: 'KMHCT41DBNU744285', color: 'Blanco', traccion: '4x2', puertas: '4', cilindrada: 1368, kmPermiso: 21300 },
  HVXP90: { marca: 'Chevrolet', modelo: 'Sail', version: '1.5 LT', anio: 2017, transmision: 'Manual', combustible: 'Bencina', referencia: 6490000, tipoVehiculo: 'Vehículo liviano', anioFabricacion: 2016, vin: 'LSGKB54H2HD215608', color: 'Gris Grafito', traccion: '4x2', puertas: '4', cilindrada: 1485, kmPermiso: 112500 },
  BBTR21: { marca: 'Nissan', modelo: 'Qashqai', version: '2.0 Sense', anio: 2019, transmision: 'Automático', combustible: 'Bencina', referencia: 12490000, tipoVehiculo: 'Vehículo liviano', anioFabricacion: 2019, vin: 'JN1BJ1CV5KW382640', color: 'Azul Marino', traccion: '4x2', puertas: '5', cilindrada: 1997, kmPermiso: 63800 },
  FKLM77: { marca: 'Ford', modelo: 'EcoSport', version: '1.5 Titanium', anio: 2018, transmision: 'Automático', combustible: 'Bencina', referencia: 8990000, tipoVehiculo: 'Vehículo liviano', anioFabricacion: 2017, vin: 'MAJ6S53H0JC419077', color: 'Gris Plata', traccion: '4x2', puertas: '5', cilindrada: 1499, kmPermiso: 89100 },
};

// Patentes de ejemplo que se ofrecen como atajo en la UI
export const PATENTES_DEMO = ['KDPT45', 'LSCS34', 'BBTR21', 'HVXP90'];

/* Atajos de la consulta en el alta: tres que el registro sí tiene y una que no,
   para poder mostrar en la demo qué pasa cuando la patente no aparece. */
export const PATENTES_DEMO_ALTA = ['KDPT45', 'RCVB56', 'HVXP90'];
export const PATENTES_SIN_REGISTRO = ['TRWQ07'];

// Catálogo de respaldo: cualquier patente inventada igual devuelve un auto plausible
type CatalogoItem = Omit<FichaPatente, 'anio' | 'referencia' | 'anioFabricacion' | 'vin' | 'color' | 'kmPermiso'>;
const CATALOGO: CatalogoItem[] = [
  { marca: 'Toyota', modelo: 'Corolla', version: '1.8 XLI', transmision: 'Automático', combustible: 'Bencina', tipoVehiculo: 'Vehículo liviano', traccion: '4x2', puertas: '4', cilindrada: 1798 },
  { marca: 'Kia', modelo: 'Rio', version: '1.4 EX', transmision: 'Manual', combustible: 'Bencina', tipoVehiculo: 'Vehículo liviano', traccion: '4x2', puertas: '5', cilindrada: 1396 },
  { marca: 'Chevrolet', modelo: 'Onix', version: '1.0 Turbo LT', transmision: 'Manual', combustible: 'Bencina', tipoVehiculo: 'Vehículo liviano', traccion: '4x2', puertas: '4', cilindrada: 999 },
  { marca: 'Peugeot', modelo: '208', version: '1.2 Active', transmision: 'Manual', combustible: 'Bencina', tipoVehiculo: 'Vehículo liviano', traccion: '4x2', puertas: '5', cilindrada: 1199 },
  { marca: 'Hyundai', modelo: 'Tucson', version: '2.0 GL', transmision: 'Automático', combustible: 'Diesel', tipoVehiculo: 'Vehículo liviano', traccion: '4x4', puertas: '5', cilindrada: 1995 },
  { marca: 'Suzuki', modelo: 'Vitara', version: '1.6 GLX', transmision: 'Automático', combustible: 'Bencina', tipoVehiculo: 'Vehículo liviano', traccion: 'AWD', puertas: '5', cilindrada: 1586 },
];

const COLORES = ['Gris Plata', 'Blanco', 'Negro', 'Azul Marino', 'Rojo', 'Gris Grafito', 'Blanco Perla', 'Verde Oliva'];
// El VIN no lleva I, O ni Q: se confunden con 1 y 0.
const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';

const VALOR_NUEVO_BASE = 14500000; // valor de referencia "0 km" del catálogo de respaldo

export const normalizarPatente = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

const hash = (txt: string) => {
  let h = 0;
  for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) >>> 0;
  return h;
};

const round10k = (n: number) => Math.round(n / 10000) * 10000;

// Resuelve una patente contra el registro; si no existe, inventa un auto estable para esa patente
export function buscarPatente(patenteRaw: string): VehiculoRegistro | null {
  const patente = normalizarPatente(patenteRaw);
  if (patente.length < 5) return null;
  if (REGISTRO[patente]) return REGISTRO[patente];

  const h = hash(patente);
  const base = CATALOGO[h % CATALOGO.length];
  const anio = 2015 + (h % 10); // 2015 - 2024
  const antiguedad = Math.max(0, ANIO_ACTUAL - anio);
  const referencia = round10k(VALOR_NUEVO_BASE * Math.pow(0.9, antiguedad));
  return { ...base, anio, referencia };
}

/* Lector de patente de la foto — el "OCR con IA" del alta. Acá no hay visión
   artificial de ninguna clase: la lectura sale del identificador de la imagen,
   así que la misma foto siempre devuelve lo mismo y la demo es repetible.
   Una de cada cuatro fotos no se deja leer, que es lo que pasa de verdad
   cuando la patente sale movida, tapada o a contraluz. */
export function leerPatenteEnFoto(fotoUri: string): string | null {
  const h = hash(`foto${fotoUri}`);
  if (h % 4 === 0) return null;
  const patentes = Object.keys(REGISTRO);
  return patentes[(h >>> 3) % patentes.length];
}

/* Consulta de patente del alta. Devuelve la ficha completa del vehículo o null
   si el registro no la tiene: las patentes de PATENTES_SIN_REGISTRO existen
   justamente para mostrar ese caso en la demo. */
export function buscarFichaPatente(patenteRaw: string): FichaPatente | null {
  const patente = normalizarPatente(patenteRaw);
  if (patente.length < 5) return null;
  if (PATENTES_SIN_REGISTRO.includes(patente)) return null;
  if (REGISTRO[patente]) return REGISTRO[patente];

  const h = hash(patente);
  const base = CATALOGO[h % CATALOGO.length];
  const anio = 2015 + (h % 10); // 2015 - 2024
  const antiguedad = Math.max(0, ANIO_ACTUAL - anio);
  const referencia = round10k(VALOR_NUEVO_BASE * Math.pow(0.9, antiguedad));
  // El km del permiso ronda lo esperado por antigüedad, con desviación estable
  const kmPermiso = Math.max(1000, Math.round((antiguedad * KM_POR_ANIO * (0.75 + ((h >>> 4) % 60) / 100)) / 100) * 100);
  return {
    ...base,
    anio,
    anioFabricacion: anio - ((h >>> 7) % 2), // a veces se fabricó el año anterior
    referencia,
    vin: generarVin(patente),
    color: COLORES[(h >>> 9) % COLORES.length],
    kmPermiso,
  };
}

function generarVin(patente: string) {
  const h = hash(`vin${patente}`);
  let vin = '';
  for (let i = 0; i < 17; i++) {
    vin += VIN_CHARS[(((h >>> (i % 12)) ^ (i * 7)) >>> 0) % VIN_CHARS.length];
  }
  return vin;
}

export function tasar(vehiculo: VehiculoRegistro, km: number): Tasacion {
  const antiguedad = Math.max(1, ANIO_ACTUAL - vehiculo.anio);
  const kmEsperado = antiguedad * KM_POR_ANIO;

  // Menos km que lo esperado suma; más km resta. Tope: ±18% del valor de referencia.
  const tope = vehiculo.referencia * 0.18;
  const ajusteKm = Math.max(-tope, Math.min(tope, (kmEsperado - km) * PESOS_POR_KM));

  const precioVenta = round10k(vehiculo.referencia + ajusteKm);
  const ofertaMin = round10k(precioVenta * 0.7); // 30% bajo el precio de venta
  const ofertaMax = round10k(precioVenta * 0.75); // 25% bajo el precio de venta

  const h = hash(`${vehiculo.marca}${vehiculo.modelo}${vehiculo.anio}`);
  const comparables: Comparable[] = [0, 1, 2].map((i) => {
    const varPrecio = ((((h >> (i * 3)) % 13) - 6) / 100) * precioVenta; // ±6%
    const varKm = (((h >> (i * 5)) % 21) - 10) * 1200; // ±12.000 km
    return {
      fuente: ['Portal Web', 'Automotora Rival', 'Publicación Directa'][i],
      titulo: `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`,
      km: Math.max(5000, Math.round((km + varKm) / 1000) * 1000),
      precio: round10k(precioVenta + varPrecio),
    };
  });

  // Confianza: baja si el kilometraje se sale mucho de lo esperado
  const desvio = Math.abs(km - kmEsperado) / Math.max(kmEsperado, 1);
  const confianza = Math.max(62, Math.min(96, Math.round(94 - desvio * 40)));

  return {
    vehiculo,
    km,
    kmEsperado,
    ajusteKm: round10k(ajusteKm),
    precioVenta,
    ofertaMin,
    ofertaMax,
    margenMin: precioVenta - ofertaMax,
    margenMax: precioVenta - ofertaMin,
    confianza,
    comparables,
  };
}

/* ======================= MOTOR DE AUTORED (ronda 3, punto 6) =======================
   Reemplaza a `tasar` en la pantalla. David mostró dos capturas y dijo que las dos
   servían de contexto: "acá tenemos un buscador de precios que estamos migrando,
   este es nuestro nuevo motor de precio pero el diseño es más parecido a este,
   entonces va a necesitar como los dos. Básicamente tú pones una patente y te da
   precios promedio y te muestra publicaciones similares que avalan estos precios".
   Y el nivel: "esta sí la pueden construir, no a nivel de tanto detalle, pero como a
   grandes rasgos, porque es una pura página".

   Los tres precios son la razón de ser del motor de ellos: el de toma es el dato
   exclusivo de Autored, el que le da margen a la compraventa; el de publicación sale
   de scrapear Mercado Libre y Chileautos; el de venta, del registro civil. */

export interface RangoPrecio {
  min: number;
  max: number;
}

export interface PublicacionSimilar {
  titulo: string;
  km: number;
  ubicacion: string;
  precio: number;
}

export interface TasacionAutored {
  vehiculo: VehiculoRegistro;
  patente: string;
  km: number;
  precioToma: number;
  rangoToma: RangoPrecio;
  precioVenta: number;
  rangoVenta: RangoPrecio;
  precioPublicacion: number;
  rangoPublicacion: RangoPrecio;
  /* De 1 a 5 estrellas, derivada de cuántas publicaciones comparables hay: pocas
     publicaciones es un auto que se mueve poco. Es el mismo criterio que hace
     creíble el número y no pide inventar otra serie. */
  comercialidad: number;
  publicaciones: PublicacionSimilar[];
}

/* Las ubicaciones son las que se ven en la tabla real de Autored
   (david-pantallas-3.png), para que las publicaciones no suenen inventadas. */
const UBICACIONES = [
  'Talca, Maule',
  'Concepción, Bío Bío',
  'Rancagua, O’Higgins',
  'Temuco, Araucanía',
  'La Florida, Metropolitana',
  'Colina, Metropolitana',
  'Mejillones, Antofagasta',
  'Puerto Montt, Los Lagos',
  'Valdivia, Los Ríos',
  'Antofagasta, Antofagasta',
  'Viña del Mar, Valparaíso',
  'Ñuñoa, Metropolitana',
];

export const ETIQUETA_COMERCIALIDAD = ['', 'Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta'];

/* Las brechas salen de la captura real: el de toma bastante abajo del de venta
   (10.320.000 contra 12.590.000, un 82%) y el de publicación apenas arriba
   (13.090.000, un 104%). Se hacen variar por patente para que no se note que es una
   fórmula: si alguien prueba tres patentes seguidas en una reunión y las tres tienen
   la misma proporción, la simulación se delata. La variación es determinista, así que
   la demo es repetible. */
export function tasarAutored(vehiculo: VehiculoRegistro, km: number, patenteRaw: string): TasacionAutored {
  const patente = normalizarPatente(patenteRaw);
  const h = hash(`${patente}${vehiculo.marca}${vehiculo.modelo}${vehiculo.anio}`);

  const antiguedad = Math.max(1, ANIO_ACTUAL - vehiculo.anio);
  const kmEsperado = antiguedad * KM_POR_ANIO;
  const tope = vehiculo.referencia * 0.18;
  const ajusteKm = Math.max(-tope, Math.min(tope, (kmEsperado - km) * PESOS_POR_KM));
  const precioVenta = round10k(vehiculo.referencia + ajusteKm);

  /* Toma entre el 77% y el 85% del de venta; publicación entre el 102% y el 107%.
     En pasos de medio punto y no de uno entero: con ocho valores posibles, probar
     cuatro patentes en una reunión ya repetía la misma proporción dos veces. */
  const factorToma = 0.77 + ((h >>> 2) % 17) / 200;
  const factorPublicacion = 1.02 + ((h >>> 6) % 11) / 200;
  const precioToma = round10k(precioVenta * factorToma);
  const precioPublicacion = round10k(precioVenta * factorPublicacion);

  // La amplitud del rango también varía: en la captura va del 8% al 11%.
  const rango = (centro: number, semilla: number): RangoPrecio => {
    const amplitud = 0.08 + ((h >>> semilla) % 7) / 200;
    return { min: round10k(centro * (1 - amplitud)), max: round10k(centro * (1 + amplitud)) };
  };

  /* Entre 2 y 13 publicaciones, que es el orden de magnitud de la captura ("Cantidad
     publicaciones 11", "1-10 de 14 resultados"). De ahí sale la comercialidad. */
  const cantidad = 2 + ((h >>> 10) % 12);
  const publicaciones: PublicacionSimilar[] = Array.from({ length: cantidad }, (_, i) => {
    /* El índice va PRIMERO en la semilla, no al final. Con `${patente}pub${i}` los
       hashes de publicaciones consecutivas se diferenciaban en 1, así que al
       desplazar bits (>>> 5, >>> 11) el km y la ubicación salían idénticos en las
       ocho filas y la lista parecía rota. */
    const g = hash(`${i}|${patente}|pub`);
    const varPrecio = (((g % 19) - 9) / 100) * precioPublicacion; // ±9%
    const varKm = ((g >>> 5) % 61) - 30; // ±30.000 km
    return {
      titulo: `${vehiculo.anio} ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.version}`,
      km: Math.max(5000, Math.round((km + varKm * 1000) / 500) * 500),
      ubicacion: UBICACIONES[(g >>> 11) % UBICACIONES.length],
      precio: round10k(precioPublicacion + varPrecio),
    };
  }).sort((a, b) => b.precio - a.precio);

  const comercialidad = cantidad <= 2 ? 1 : cantidad <= 4 ? 2 : cantidad <= 7 ? 3 : cantidad <= 10 ? 4 : 5;

  return {
    vehiculo,
    patente,
    km,
    precioToma,
    rangoToma: rango(precioToma, 14),
    precioVenta,
    rangoVenta: rango(precioVenta, 18),
    precioPublicacion,
    rangoPublicacion: rango(precioPublicacion, 22),
    comercialidad,
    publicaciones,
  };
}
