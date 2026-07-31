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
const REGISTRO: Record<string, VehiculoRegistro> = {
  KDPT45: { marca: 'Kia', modelo: 'Morning', version: '1.2 EX Full', anio: 2019, transmision: 'Manual', combustible: 'Bencina', referencia: 7890000 },
  PLGR88: { marca: 'Suzuki', modelo: 'Swift', version: '1.2 GLX', anio: 2021, transmision: 'Manual', combustible: 'Bencina', referencia: 9490000 },
  JZWY12: { marca: 'Toyota', modelo: 'Yaris', version: '1.5 XLI', anio: 2018, transmision: 'Automático', combustible: 'Bencina', referencia: 8990000 },
  LSCS34: { marca: 'Mazda', modelo: '3', version: '2.0 Sport V', anio: 2020, transmision: 'Automático', combustible: 'Bencina', referencia: 13290000 },
  RCVB56: { marca: 'Hyundai', modelo: 'Accent', version: '1.4 GL Value', anio: 2022, transmision: 'Manual', combustible: 'Bencina', referencia: 11190000 },
  HVXP90: { marca: 'Chevrolet', modelo: 'Sail', version: '1.5 LT', anio: 2017, transmision: 'Manual', combustible: 'Bencina', referencia: 6490000 },
  BBTR21: { marca: 'Nissan', modelo: 'Qashqai', version: '2.0 Sense', anio: 2019, transmision: 'Automático', combustible: 'Bencina', referencia: 12490000 },
  FKLM77: { marca: 'Ford', modelo: 'EcoSport', version: '1.5 Titanium', anio: 2018, transmision: 'Automático', combustible: 'Bencina', referencia: 8990000 },
};

// Patentes de ejemplo que se ofrecen como atajo en la UI
export const PATENTES_DEMO = ['KDPT45', 'LSCS34', 'BBTR21', 'HVXP90'];

// Catálogo de respaldo: cualquier patente inventada igual devuelve un auto plausible
const CATALOGO: Omit<VehiculoRegistro, 'anio' | 'referencia'>[] = [
  { marca: 'Toyota', modelo: 'Corolla', version: '1.8 XLI', transmision: 'Automático', combustible: 'Bencina' },
  { marca: 'Kia', modelo: 'Rio', version: '1.4 EX', transmision: 'Manual', combustible: 'Bencina' },
  { marca: 'Chevrolet', modelo: 'Onix', version: '1.0 Turbo LT', transmision: 'Manual', combustible: 'Bencina' },
  { marca: 'Peugeot', modelo: '208', version: '1.2 Active', transmision: 'Manual', combustible: 'Bencina' },
  { marca: 'Hyundai', modelo: 'Tucson', version: '2.0 GL', transmision: 'Automático', combustible: 'Diesel' },
  { marca: 'Suzuki', modelo: 'Vitara', version: '1.6 GLX', transmision: 'Automático', combustible: 'Bencina' },
];

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
