// AutoSave — informe de historial del vehículo y transferencia notarial.
// Prueba de concepto SIN backend: igual que el Motor de Precios, todo se calcula
// localmente y de forma determinista a partir de la patente, así una misma patente
// devuelve siempre el mismo informe.
//
// El informe es de acceso libre para la automotora (es su propia unidad). Lo que se
// cobra es la COPIA CERTIFICADA que la automotora le ofrece al comprador o al vendedor.

import type {
  Car,
  CostoTransferencia,
  EncargoRegistro,
  InformeAutosave,
  ModalidadTransferencia,
  MultaRegistro,
  PrendaRegistro,
  ResponsablePago,
  RevisionTecnicaRegistro,
  SiniestroRegistro,
  TitularRegistro,
  TransferenciaNotarial,
  TraspasoOrigen,
  VehicleContact,
  VeredictoAutosave,
} from './data';
import { normalizarPatente } from './pricing';

/* ============================ TARIFAS Y PLAZOS ============================ */
// Todo el dinero del producto vive acá: es lo único que hay que tocar para ajustarlo.

export const PRECIO_COPIA_INFORME = 9990; // lo que la automotora le cobra al cliente
export const TASA_IMPUESTO_TRANSFERENCIA = 0.015; // 1,5% sobre la base imponible
export const ARANCEL_NOTARIAL_DIGITAL = 12900;
export const ARANCEL_NOTARIAL_PRESENCIAL = 18500;
export const ARANCEL_INSCRIPCION_RC = 12900;
export const GESTION_AUTOSAVE = 24900;

const PLAZO_HABILES: Record<ModalidadTransferencia, [number, number]> = {
  Digital: [3, 5],
  Presencial: [7, 10],
};

/** La automotora como parte vendedora cuando el auto se transfiere desde el stock. */
export const AUTOMOTORA: VehicleContact & { rut: string } = {
  clienteId: null,
  nombre: 'Automotora AutoRed SpA',
  telefono: '+56 2 2345 6789',
  rut: '76.543.210-9',
};

/** Qué le ofrece la automotora al cliente. Es el guion de venta de la tarjeta. */
export const PITCH_TRANSFERENCIA = [
  'Escritura de compraventa y firma ante notaría',
  'Pago del impuesto de transferencia (1,5%)',
  'Inscripción en el Registro de Vehículos Motorizados',
  'Nuevo padrón a nombre del comprador',
  'Copia certificada del informe AutoSave, incluida',
  'Seguimiento en línea con folio',
];

/* ============================ CATÁLOGOS ============================ */

export const NOTARIAS = [
  'AutoSave Digital (firma electrónica avanzada)',
  '1ª Notaría de Providencia',
  '18ª Notaría de Santiago',
  '10ª Notaría de Santiago',
  '3ª Notaría de Las Condes',
  '2ª Notaría de Maipú',
  '1ª Notaría de Ñuñoa',
  '1ª Notaría de Puente Alto',
];

const PLANTAS_RT = [
  'PRT Maipú (Av. Pajaritos)',
  'PRT Quilicura (Panamericana Norte)',
  'PRT Estación Central (Av. Las Rejas)',
  'PRT La Florida (Vicuña Mackenna Ote.)',
  'PRT Ñuñoa (Av. Grecia)',
  'PRT San Bernardo (Av. Colón)',
  'PRT Puente Alto (Concha y Toro)',
  'PRT Independencia (Fermín Vivaceta)',
];

const IMPORTADORAS: Record<string, string> = {
  Toyota: 'Toyota Chile S.A.',
  Chevrolet: 'General Motors Chile S.A.',
  Suzuki: 'Derco S.A.',
  Hyundai: 'Automotores Gildemeister S.A.',
  Kia: 'Kia Chile S.A.',
  Mazda: 'Mazda Motor de Chile S.A.',
  Nissan: 'Nissan Chile S.A.',
  Ford: 'Ford Motor Company Chile',
  Peugeot: 'Astara Chile',
  Volkswagen: 'Porsche Chile S.A.',
};
const IMPORTADORAS_FALLBACK = ['SKBergé Chile S.A.', 'Inchcape Chile', 'Kaufmann S.A.', 'Salinas y Fabres S.A.'];

const ASEGURADORAS = ['HDI Seguros', 'BCI Seguros', 'Consorcio', 'Mapfre', 'Zurich', 'SURA'];
const TALLERES = ['Taller Autofix Ñuñoa', 'Servicio Técnico Maipú', 'Carrocerías Providencia', 'Taller Sur Motors'];
const JUZGADOS = [
  '1er Juzgado de Policía Local de Maipú',
  '2º Juzgado de Policía Local de Santiago',
  '1er Juzgado de Policía Local de Ñuñoa',
  'Juzgado de Policía Local de Puente Alto',
  '1er Juzgado de Policía Local de Providencia',
];
const MOTIVOS_MULTA = [
  'No respetar luz roja',
  'Exceso de velocidad',
  'Estacionar en zona prohibida',
  'Conducir sin revisión técnica vigente',
  'No respetar señal PARE',
];
const BANCOS = ['Banco de Chile', 'Banco Santander', 'Banco Estado', 'Scotiabank', 'Tanner Servicios Financieros'];
const REGIONES = ['Región Metropolitana', 'Valparaíso', "O'Higgins", 'Biobío', 'Maule'];
// El tipo va pegado al nombre: si se sortean por separado, sale "Claudia Ríos · Rent a car".
const TITULARES_POSIBLES: { nombre: string; tipo: TitularRegistro['tipo'] }[] = [
  { nombre: 'Patricio Vergara', tipo: 'Particular' },
  { nombre: 'Claudia Ríos', tipo: 'Particular' },
  { nombre: 'Rent a Car Sur SpA', tipo: 'Rent a car' },
  { nombre: 'Ingeniería Andes Ltda.', tipo: 'Empresa' },
  { nombre: 'Fernando Bustos', tipo: 'Particular' },
  { nombre: 'Marcela Tapia', tipo: 'Particular' },
  { nombre: 'Leasing Nacional S.A.', tipo: 'Leasing' },
];
const PIEZAS = [
  ['Puerta delantera izquierda', 'Pilar B', 'Foco delantero'],
  ['Tapabarro trasero derecho'],
  ['Parachoques delantero', 'Capó', 'Radiador'],
  ['Puerta trasera derecha', 'Espejo lateral'],
  ['Techo', 'Parabrisas'],
];

/* ============================ PERFILES DE LA DEMO ============================ */
// Las 6 patentes del stock inicial tienen un caso asignado para que la demo cuente
// una historia. Cualquier otra patente cae al generador por hash.

interface Perfil {
  encargo: boolean;
  prenda: boolean;
  odometroAdulterado: boolean;
  siniestros: number;
  gravedadMax: SiniestroRegistro['gravedad'];
  multasImpagas: number;
  titulares: number;
  rtRechazada: boolean;
  cambioPatente: boolean;
}

const PERFIL_LIMPIO: Perfil = {
  encargo: false,
  prenda: false,
  odometroAdulterado: false,
  siniestros: 0,
  gravedadMax: 'Leve',
  multasImpagas: 0,
  titulares: 1,
  rtRechazada: false,
  cambioPatente: false,
};

const PERFILES_DEMO: Record<string, Perfil> = {
  // Kia Morning — el caso feliz.
  KDPT45: { ...PERFIL_LIMPIO },
  // Suzuki Swift — el informe confirma el detalle estético que la automotora ya conocía.
  PLGR88: { ...PERFIL_LIMPIO, siniestros: 1, gravedadMax: 'Leve' },
  // Toyota Yaris — odómetro adulterado. Explica por qué lleva 65 días sin venderse.
  JZWY12: {
    ...PERFIL_LIMPIO,
    odometroAdulterado: true,
    siniestros: 2,
    gravedadMax: 'Moderado',
    multasImpagas: 1,
    titulares: 3,
    cambioPatente: true,
  },
  // Mazda 3 — prenda vigente: bloquea la inscripción de la transferencia.
  LSCS34: { ...PERFIL_LIMPIO, prenda: true, titulares: 2 },
  // Hyundai Accent — limpio; es el auto vendido con la transferencia en curso.
  RCVB56: { ...PERFIL_LIMPIO, titulares: 1 },
  // Chevrolet Sail — encargo por robo. Está en Pre-stock: el informe evita la compra.
  HVXP90: {
    ...PERFIL_LIMPIO,
    encargo: true,
    multasImpagas: 2,
    titulares: 2,
    rtRechazada: true,
  },
};

/* ============================ UTILIDADES ============================ */

const ANIO_ACTUAL = new Date().getFullYear();

const hash = (txt: string) => {
  let h = 0;
  for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) >>> 0;
  return h;
};

const round10k = (n: number) => Math.round(n / 10000) * 10000;
const pick = <T,>(arr: T[], n: number): T => arr[Math.abs(Math.trunc(n)) % arr.length];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Toma bits del hash de forma SIN SIGNO. Con `>>` el hash (que supera 2^31) daría
 *  negativos y se colarían meses y días inválidos en las fechas. */
const bits = (h: number, desplazamiento: number) => h >>> (Math.abs(desplazamiento) % 31);

const pad = (n: number) => String(n).padStart(2, '0');

/** Arma una fecha ISO que nunca cae en el futuro: un siniestro o una multa con fecha
 *  posterior a hoy delata al toque que los datos son inventados. */
function fechaPasada(anio: number, mes: number, dia: number): string {
  const hoy = new Date();
  const d = new Date(anio, mes - 1, dia);
  while (d > hoy) d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** dd-mm-aaaa para mostrar (las fechas se guardan en ISO). */
export function fmtFecha(isoDate: string) {
  if (!isoDate) return '—';
  const [a, m, d] = isoDate.split('-');
  return d && m && a ? `${d}-${m}-${a}` : isoDate;
}

/** Suma días hábiles saltándose sábados y domingos. */
function sumarHabiles(desde: Date, dias: number) {
  const d = new Date(desde);
  let restantes = dias;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) restantes--;
  }
  return d;
}

/** Perfil plausible para cualquier patente fuera de la demo: 70% limpio / 20% atención / 10% crítico. */
function perfilPorHash(h: number): Perfil {
  const dado = h % 100;
  if (dado < 70) return { ...PERFIL_LIMPIO, titulares: 1 + (h % 2) };
  if (dado < 90) {
    return {
      ...PERFIL_LIMPIO,
      siniestros: 1 + (h % 2),
      gravedadMax: 'Moderado',
      multasImpagas: h % 2,
      titulares: 2,
    };
  }
  const conPrenda = h % 2 === 0;
  return {
    ...PERFIL_LIMPIO,
    prenda: conPrenda,
    encargo: !conPrenda,
    odometroAdulterado: !conPrenda,
    siniestros: 2,
    gravedadMax: 'Grave',
    multasImpagas: 1,
    titulares: 3,
    cambioPatente: true,
  };
}

/* ============================ GENERADOR DEL INFORME ============================ */

export function generarInformeAutosave(car: Car): InformeAutosave {
  const patente = normalizarPatente(car.patente) || 'SINPAT';
  const h = hash(`${patente}${car.vin || ''}`);
  const perfil = PERFILES_DEMO[patente] || perfilPorHash(h);

  const hoy = new Date();
  const antiguedad = Math.max(1, ANIO_ACTUAL - (car.anio || ANIO_ACTUAL));
  const kmActual = Math.max(0, car.km || 0);

  const revisiones = generarRevisiones(car, perfil, h, antiguedad, kmActual);
  const siniestros = generarSiniestros(car, perfil, h, antiguedad);
  const titulares = generarTitulares(car, perfil, h, antiguedad);
  const multas = generarMultas(perfil, h);
  const prenda = generarPrenda(car, perfil, h);
  const encargo = generarEncargo(perfil, h);

  const kmUltimaRevision = revisiones.length ? revisiones[0].km : 0;
  const alertaOdometro = revisiones.some((r) => r.inconsistente);
  const multasImpagas = multas.filter((m) => !m.pagada);
  const montoMultas = multasImpagas.reduce((sum, m) => sum + m.monto, 0);

  // Tasación fiscal del SII: 72%–80% del precio de venta, estable por patente.
  const tasacionFiscal = round10k((car.precioVenta || car.precioPublicacionContado || 0) * (0.72 + (h % 9) / 100));

  const veredictos = {
    encargo: encargo.vigente ? ('critico' as const) : ('ok' as const),
    siniestros: veredictoSiniestros(siniestros),
    odometro: alertaOdometro ? ('critico' as const) : ('ok' as const),
    legal: prenda?.vigente ? ('critico' as const) : multasImpagas.length ? ('atencion' as const) : ('ok' as const),
  };

  const orden: VeredictoAutosave[] = ['ok', 'atencion', 'critico'];
  const veredictoGeneral = Object.values(veredictos).reduce<VeredictoAutosave>(
    (peor, v) => (orden.indexOf(v) > orden.indexOf(peor) ? v : peor),
    'ok',
  );

  return {
    folio: `AS-${ANIO_ACTUAL}-${String((h % 90000) + 10000)}`,
    fechaConsulta: iso(hoy),
    patente: car.patente,
    vin: car.vin || `9BR${String(h).padStart(9, '0').slice(0, 9)}${patente.slice(0, 5)}`,
    veredictoGeneral,
    veredictos,
    resumen: generarResumen(veredictos, siniestros.length, kmUltimaRevision - kmActual, prenda, montoMultas),
    encargo,
    alertaOdometro,
    kmDeclaradoActual: kmActual,
    kmUltimaRevision,
    importadora: IMPORTADORAS[car.marca] || pick(IMPORTADORAS_FALLBACK, h),
    fechaPrimeraInscripcion: fechaPasada(car.anio || ANIO_ACTUAL, 1 + (h % 12), 1 + (h % 27)),
    tasacionFiscal,
    prenda,
    siniestros,
    revisiones,
    titulares,
    multas,
  };
}

function veredictoSiniestros(siniestros: SiniestroRegistro[]): VeredictoAutosave {
  if (!siniestros.length) return 'ok';
  const grave = siniestros.some((sn) => sn.gravedad === 'Grave' || sn.gravedad === 'Pérdida total');
  return grave ? 'critico' : 'atencion';
}

/** El historial de revisiones se ancla al odómetro REAL del auto, no a un número inventado.
 *  Si el odómetro está adulterado, la escalera se construye sobre el kilometraje REAL
 *  (el declarado hoy + el retroceso), de modo que la revisión más reciente quede por encima
 *  de lo que declara la ficha: así el fraude es verificable y no una contradicción suelta. */
function generarRevisiones(
  car: Car,
  perfil: Perfil,
  h: number,
  antiguedad: number,
  kmActual: number,
): RevisionTecnicaRegistro[] {
  if (kmActual === 0) return [];

  // En Chile la revisión técnica empieza a los 4 años del vehículo, y luego es anual.
  const primerAnioRT = (car.anio || ANIO_ACTUAL) + 4;
  const anios: number[] = [];
  for (let a = ANIO_ACTUAL - 1; a >= primerAnioRT && anios.length < 4; a--) anios.push(a);
  if (!anios.length) return [];

  const retroceso = perfil.odometroAdulterado ? 12000 + (h % 9) * 600 : 0;
  const kmReal = kmActual + retroceso;
  const kmPorAnio = Math.max(4000, Math.round(kmReal / antiguedad));

  return anios.map((anio) => {
    const atras = ANIO_ACTUAL - anio; // 1 = la revisión del año pasado
    const variacion = (bits(h, atras * 3) % 11) - 5; // ±5%
    const km =
      perfil.odometroAdulterado && atras === 1
        ? kmReal // la lectura que delata el retroceso
        : Math.max(1000, Math.round((kmReal - kmPorAnio * (atras - 0.35)) * (1 + variacion / 200)));

    const rechazada = perfil.rtRechazada && atras === 1;
    return {
      fecha: `${anio}-${pad(2 + (bits(h, atras) % 9))}-${pad(3 + (bits(h, atras + 2) % 25))}`,
      planta: pick(PLANTAS_RT, h + atras * 3),
      km,
      resultado: rechazada ? ('Rechazada' as const) : ('Aprobada' as const),
      observacion: rechazada ? 'Emisiones fuera de norma. Rechazada en primera instancia.' : '',
      inconsistente: km > kmActual,
    };
  }); // más reciente primero
}

function generarSiniestros(car: Car, perfil: Perfil, h: number, antiguedad: number): SiniestroRegistro[] {
  if (!perfil.siniestros) return [];
  const tipos: SiniestroRegistro['tipo'][] = ['Colisión', 'Daño estético', 'Choque múltiple', 'Volcamiento'];
  const out: SiniestroRegistro[] = [];

  for (let i = 0; i < perfil.siniestros; i++) {
    const gravedad: SiniestroRegistro['gravedad'] = i === 0 ? perfil.gravedadMax : 'Leve';
    const esLeve = gravedad === 'Leve';
    const anio = Math.max(car.anio || ANIO_ACTUAL, ANIO_ACTUAL - 2 - i * (1 + (h % 2)));
    const base = esLeve ? 240000 : 1200000;
    out.push({
      fecha: fechaPasada(anio, 1 + (bits(h, i + 1) % 12), 2 + (bits(h, i + 4) % 26)),
      tipo: esLeve ? 'Daño estético' : pick(tipos, h + i),
      gravedad,
      compania: pick(ASEGURADORAS, h + i * 2),
      montoReparacion: round10k(base + (bits(h, i * 2) % 12) * (esLeve ? 20000 : 90000)),
      piezasAfectadas: esLeve ? PIEZAS[1] : pick(PIEZAS, h + i),
      taller: pick(TALLERES, h + i),
    });
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function generarTitulares(car: Car, perfil: Perfil, h: number, antiguedad: number): TitularRegistro[] {
  const out: TitularRegistro[] = [];
  const anioBase = car.anio || ANIO_ACTUAL;
  const cantidad = Math.max(1, perfil.titulares);
  const tramo = Math.max(1, Math.floor(antiguedad / cantidad));

  // La patente anterior solo aparece si el perfil declara un cambio de patente.
  const patenteVieja = `${String.fromCharCode(66 + (h % 20))}${String.fromCharCode(
    68 + (bits(h, 3) % 20),
  )}-${String.fromCharCode(72 + (bits(h, 5) % 15))}${String.fromCharCode(75 + (bits(h, 7) % 12))}-${pad(bits(h, 9) % 90)}`;

  for (let i = 0; i < cantidad; i++) {
    // El titular actual es la automotora, salvo que el auto aún no se haya adquirido.
    const esAutomotora = i === 0 && car.estado !== 'Pre-stock';
    const anterior = pick(TITULARES_POSIBLES, h + i * 5);
    const esUltimo = i === cantidad - 1;

    out.push({
      desde: fechaPasada(
        Math.max(anioBase, ANIO_ACTUAL - tramo * (i + 1)),
        1 + (bits(h, i) % 12),
        1 + (bits(h, i + 1) % 27),
      ),
      hasta: i === 0 ? null : fechaPasada(ANIO_ACTUAL - tramo * i, 1 + (bits(h, i + 2) % 12), 1 + (bits(h, i + 3) % 27)),
      titular: esAutomotora ? AUTOMOTORA.nombre : anterior.nombre,
      tipo: esAutomotora ? 'Automotora' : anterior.tipo,
      region: esAutomotora ? 'Región Metropolitana' : pick(REGIONES, h + i),
      patente: perfil.cambioPatente && esUltimo && cantidad > 1 ? patenteVieja : car.patente,
    });
  }
  return out;
}

function generarMultas(perfil: Perfil, h: number): MultaRegistro[] {
  const out: MultaRegistro[] = [];
  for (let i = 0; i < perfil.multasImpagas; i++) {
    out.push({
      fecha: fechaPasada(ANIO_ACTUAL - (i % 2), 1 + (bits(h, i + 2) % 12), 1 + (bits(h, i + 5) % 27)),
      juzgado: pick(JUZGADOS, h + i),
      motivo: pick(MOTIVOS_MULTA, h + i * 2),
      monto: 34590 + (bits(h, i * 3) % 14) * 5510,
      pagada: false,
    });
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function generarPrenda(car: Car, perfil: Perfil, h: number): PrendaRegistro | null {
  if (!perfil.prenda) return null;
  return {
    tipo: 'Prenda sin desplazamiento',
    acreedor: pick(BANCOS, h),
    fechaConstitucion: fechaPasada(
      Math.max(car.anio || ANIO_ACTUAL, ANIO_ACTUAL - 5),
      1 + (h % 12),
      1 + (bits(h, 4) % 27),
    ),
    saldoInsoluto: round10k(2400000 + (h % 12) * 180000),
    vigente: true,
  };
}

function generarEncargo(perfil: Perfil, h: number): EncargoRegistro {
  if (!perfil.encargo) return { vigente: false, fecha: '', juzgado: '', detalle: '' };
  return {
    vigente: true,
    fecha: fechaPasada(ANIO_ACTUAL - 1, 1 + (h % 12), 1 + (bits(h, 3) % 27)),
    juzgado: pick(JUZGADOS, h + 1),
    detalle: 'Encargo por robo vigente. El vehículo no puede circular ni transferirse mientras no se alce.',
  };
}

function generarResumen(
  veredictos: InformeAutosave['veredictos'],
  cantSiniestros: number,
  retroceso: number,
  prenda: PrendaRegistro | null,
  montoMultas: number,
): string {
  if (veredictos.encargo === 'critico') {
    return 'Este vehículo tiene un encargo por robo vigente. No lo adquieras ni lo publiques hasta que se alce.';
  }
  if (veredictos.odometro === 'critico') {
    return `El odómetro retrocedió ${new Intl.NumberFormat('es-CL').format(
      Math.max(0, retroceso),
    )} km respecto de la última revisión técnica. Verifica el kilometraje antes de publicar.`;
  }
  if (prenda?.vigente) {
    return `El vehículo tiene una prenda vigente con ${prenda.acreedor}. Debe alzarse antes de poder transferirlo.`;
  }
  if (cantSiniestros > 0 || montoMultas > 0) {
    const partes: string[] = [];
    if (cantSiniestros > 0) partes.push(`${cantSiniestros} siniestro${cantSiniestros > 1 ? 's' : ''} registrado${cantSiniestros > 1 ? 's' : ''}`);
    if (montoMultas > 0) partes.push('multas impagas');
    return `Sin impedimentos para transferir, pero con ${partes.join(' y ')}. Conviene declararlo al comprador.`;
  }
  return 'Sin siniestros, sin encargos y con el kilometraje coherente. Vehículo apto para publicar y transferir.';
}

/* ============================ DERIVADOS PARA LA UI ============================ */

export interface ChipVeredicto {
  clave: 'encargo' | 'siniestros' | 'odometro' | 'legal';
  label: string;
  valor: string;
  veredicto: VeredictoAutosave;
  icono: string;
}

/** Los 4 chips del semáforo de la ficha. Siempre devuelve 4. */
export function resumenVeredictos(informe: InformeAutosave): ChipVeredicto[] {
  const impagas = informe.multas.filter((m) => !m.pagada).length;
  const retroceso = Math.max(0, informe.kmUltimaRevision - informe.kmDeclaradoActual);

  return [
    {
      clave: 'encargo',
      label: 'Encargo',
      valor: informe.encargo.vigente ? 'Encargo vigente' : 'Sin encargo',
      veredicto: informe.veredictos.encargo,
      icono: informe.encargo.vigente ? 'triangle-exclamation' : 'circle-check',
    },
    {
      clave: 'siniestros',
      label: 'Siniestros',
      valor: informe.siniestros.length
        ? `${informe.siniestros.length} registro${informe.siniestros.length > 1 ? 's' : ''}`
        : 'Sin registros',
      veredicto: informe.veredictos.siniestros,
      icono: informe.siniestros.length ? 'car-burst' : 'circle-check',
    },
    {
      clave: 'odometro',
      label: 'Odómetro',
      valor: informe.alertaOdometro ? `Retroceso ${fmtKm(retroceso)}` : 'Coherente',
      veredicto: informe.veredictos.odometro,
      icono: informe.alertaOdometro ? 'gauge-high' : 'circle-check',
    },
    {
      clave: 'legal',
      label: 'Legal',
      valor: informe.prenda?.vigente ? 'Prenda vigente' : impagas ? `${impagas} multa${impagas > 1 ? 's' : ''}` : 'Sin gravámenes',
      veredicto: informe.veredictos.legal,
      icono: informe.prenda?.vigente || impagas ? 'file-circle-exclamation' : 'circle-check',
    },
  ];
}

const fmtKm = (n: number) => `${new Intl.NumberFormat('es-CL').format(n)} km`;

/** El hallazgo que la automotora tiene que ver sí o sí. null = auto limpio. */
export function alertaPrincipal(
  informe: InformeAutosave,
): { titulo: string; detalle: string; veredicto: VeredictoAutosave } | null {
  if (informe.encargo.vigente) {
    return {
      titulo: 'Encargo por robo vigente',
      detalle: `Registrado el ${fmtFecha(informe.encargo.fecha)} en el ${informe.encargo.juzgado}. El vehículo no puede transferirse.`,
      veredicto: 'critico',
    };
  }
  if (informe.alertaOdometro) {
    const rt = informe.revisiones.find((r) => r.inconsistente);
    const retroceso = Math.max(0, informe.kmUltimaRevision - informe.kmDeclaradoActual);
    return {
      titulo: `Odómetro con retroceso de ${fmtKm(retroceso)}`,
      detalle: rt
        ? `La revisión de ${fmtFecha(rt.fecha)} registró ${fmtKm(rt.km)} y hoy el auto declara ${fmtKm(
            informe.kmDeclaradoActual,
          )}.`
        : 'El kilometraje declarado es menor al de la última revisión técnica.',
      veredicto: 'critico',
    };
  }
  if (informe.prenda?.vigente) {
    return {
      titulo: 'Prenda vigente sobre el vehículo',
      detalle: `${informe.prenda.acreedor} · saldo insoluto ${fmtCLPLocal(
        informe.prenda.saldoInsoluto,
      )}. Debe alzarse antes de transferir.`,
      veredicto: 'critico',
    };
  }
  const impagas = informe.multas.filter((m) => !m.pagada);
  if (impagas.length) {
    const total = impagas.reduce((sum, m) => sum + m.monto, 0);
    return {
      titulo: `${impagas.length} multa${impagas.length > 1 ? 's' : ''} impaga${impagas.length > 1 ? 's' : ''}`,
      detalle: `${fmtCLPLocal(total)} pendientes. El Registro Civil no inscribe la transferencia con multas impagas.`,
      veredicto: 'atencion',
    };
  }
  if (informe.siniestros.length) {
    const sn = informe.siniestros[0];
    return {
      titulo: `${informe.siniestros.length} siniestro${informe.siniestros.length > 1 ? 's' : ''} en el historial`,
      detalle: `El más reciente: ${sn.tipo.toLowerCase()} ${sn.gravedad.toLowerCase()} el ${fmtFecha(sn.fecha)}. Conviene declararlo al comprador.`,
      veredicto: 'atencion',
    };
  }
  return null;
}

const fmtCLPLocal = (n: number) => `$${new Intl.NumberFormat('es-CL').format(Math.round(n))}`;

/** Impedimentos legales para inscribir en el Registro Civil. Vacío = se puede transferir.
 *  Esto es lo que conecta los dos productos de AutoSave: sin informe limpio, no hay transferencia. */
export function bloqueosTransferencia(informe: InformeAutosave | null | undefined): string[] {
  if (!informe) return [];
  const bloqueos: string[] = [];

  if (informe.encargo.vigente) {
    bloqueos.push(`Encargo por robo vigente (${informe.encargo.juzgado}). Debe alzarse en el tribunal.`);
  }
  if (informe.prenda?.vigente) {
    bloqueos.push(
      `Prenda vigente con ${informe.prenda.acreedor} por ${fmtCLPLocal(
        informe.prenda.saldoInsoluto,
      )}. Debe alzarse antes de transferir.`,
    );
  }
  const impagas = informe.multas.filter((m) => !m.pagada);
  if (impagas.length) {
    const total = impagas.reduce((sum, m) => sum + m.monto, 0);
    bloqueos.push(
      `${impagas.length} multa${impagas.length > 1 ? 's' : ''} impaga${impagas.length > 1 ? 's' : ''} por ${fmtCLPLocal(
        total,
      )}. El Registro Civil no inscribe con multas pendientes.`,
    );
  }
  return bloqueos;
}

/* ============================ TRANSFERENCIA NOTARIAL ============================ */

export interface CotizacionTransferencia {
  baseImponible: number;
  costos: CostoTransferencia[];
  total: number;
  plazoTexto: string;
  fechaEstimadaEntrega: string;
}

/** El impuesto es 1,5% sobre el MAYOR entre el precio de la operación y la tasación fiscal
 *  del SII, no sobre el precio declarado. Es la regla real y hay que mostrarla. */
export function cotizarTransferencia(params: {
  precioOperacion: number;
  tasacionFiscal: number;
  modalidad: ModalidadTransferencia;
  copiaInformeYaPagada: boolean;
}): CotizacionTransferencia {
  const { precioOperacion, tasacionFiscal, modalidad, copiaInformeYaPagada } = params;
  const baseImponible = Math.max(precioOperacion || 0, tasacionFiscal || 0);
  const arancelNotarial = modalidad === 'Digital' ? ARANCEL_NOTARIAL_DIGITAL : ARANCEL_NOTARIAL_PRESENCIAL;

  const costos: CostoTransferencia[] = [
    {
      concepto: 'Impuesto de transferencia (1,5%)',
      monto: Math.round(baseImponible * TASA_IMPUESTO_TRANSFERENCIA),
      nota:
        tasacionFiscal > precioOperacion
          ? 'Se calcula sobre la tasación fiscal del SII, que es mayor al precio de la operación.'
          : 'Se calcula sobre el precio de la operación.',
    },
    {
      concepto: modalidad === 'Digital' ? 'Firma electrónica avanzada' : 'Arancel notarial (firma presencial)',
      monto: arancelNotarial,
      nota: '',
    },
    { concepto: 'Inscripción en Registro Civil', monto: ARANCEL_INSCRIPCION_RC, nota: '' },
    { concepto: 'Gestión AutoSave', monto: GESTION_AUTOSAVE, nota: '' },
  ];

  if (copiaInformeYaPagada) {
    costos.push({
      concepto: 'Copia certificada del informe AutoSave',
      monto: -PRECIO_COPIA_INFORME,
      nota: 'Ya pagada por el cliente: se abona a la transferencia.',
    });
  } else {
    costos.push({
      concepto: 'Copia certificada del informe AutoSave',
      monto: 0,
      nota: 'Incluida en la transferencia.',
    });
  }

  const [min, max] = PLAZO_HABILES[modalidad];
  return {
    baseImponible,
    costos,
    total: costos.reduce((sum, c) => sum + c.monto, 0),
    plazoTexto: `${min} a ${max} días hábiles`,
    fechaEstimadaEntrega: iso(sumarHabiles(new Date(), max)),
  };
}

const SECUENCIA_HITOS: TransferenciaNotarial['estado'][] = [
  'Solicitada',
  'Documentos en revisión',
  'Firma de las partes',
  'Inscripción en Registro Civil',
  'Inscrita',
];

const DETALLE_HITOS: Record<TransferenciaNotarial['estado'], string> = {
  Solicitada: 'AutoSave recibió la solicitud y asignó folio.',
  'Documentos en revisión': 'Se validan padrón, permiso de circulación y multas.',
  'Firma de las partes': 'Comprador y vendedor firman la escritura de compraventa.',
  'Inscripción en Registro Civil': 'Ingreso al Registro de Vehículos Motorizados.',
  Inscrita: 'Transferencia inscrita. Padrón emitido a nombre del comprador.',
};

export function crearTransferencia(params: {
  car: Car;
  informe: InformeAutosave;
  vendedor: VehicleContact;
  comprador: VehicleContact;
  origen: TraspasoOrigen;
  modalidad: ModalidadTransferencia;
  notaria: string;
  responsablePago: ResponsablePago;
  copiaInformeYaPagada: boolean;
}): TransferenciaNotarial {
  const { car, informe, vendedor, comprador, origen, modalidad, notaria, responsablePago } = params;
  const hoy = iso(new Date());
  const cotizacion = cotizarTransferencia({
    precioOperacion: car.precioVenta,
    tasacionFiscal: informe.tasacionFiscal,
    modalidad,
    copiaInformeYaPagada: params.copiaInformeYaPagada,
  });
  const h = hash(`${car.patente}${hoy}`);

  return {
    folio: `TR-${ANIO_ACTUAL}-${String((h % 90000) + 10000)}`,
    estado: 'Solicitada',
    origen,
    modalidad,
    fechaSolicitud: hoy,
    fechaEstimadaEntrega: cotizacion.fechaEstimadaEntrega,
    notaria,
    vendedor,
    comprador,
    precioOperacion: car.precioVenta,
    tasacionFiscal: informe.tasacionFiscal,
    baseImponible: cotizacion.baseImponible,
    responsablePago,
    costos: cotizacion.costos,
    total: cotizacion.total,
    hitos: SECUENCIA_HITOS.map((estado, i) => ({
      estado,
      fecha: i === 0 ? hoy : null,
      detalle: DETALLE_HITOS[estado],
    })),
    observacion: '',
  };
}

/** Simula el avance del trámite en AutoSave (no hay backend). Idempotente en 'Inscrita'. */
export function avanzarTransferencia(t: TransferenciaNotarial): TransferenciaNotarial {
  const idx = SECUENCIA_HITOS.indexOf(t.estado);
  if (idx < 0 || idx >= SECUENCIA_HITOS.length - 1) return t;
  const siguiente = SECUENCIA_HITOS[idx + 1];
  const hoy = iso(new Date());
  return {
    ...t,
    estado: siguiente,
    hitos: t.hitos.map((hito) => (hito.estado === siguiente ? { ...hito, fecha: hoy } : hito)),
  };
}

export function progresoTransferencia(t: TransferenciaNotarial) {
  const idx = SECUENCIA_HITOS.indexOf(t.estado);
  return { paso: idx + 1, total: SECUENCIA_HITOS.length };
}

/* ============================ MENSAJES AL CLIENTE ============================ */

export function textoWhatsappInforme(car: Car, informe: InformeAutosave): string {
  const veredicto =
    informe.veredictoGeneral === 'ok'
      ? 'Sin observaciones'
      : informe.veredictoGeneral === 'atencion'
        ? 'Con observaciones menores'
        : 'Con hallazgos importantes';

  return [
    `Informe AutoSave · ${car.marca} ${car.modelo} ${car.anio}`,
    `Patente ${car.patente} · Folio ${informe.folio}`,
    '',
    `Resultado: ${veredicto}.`,
    `Siniestros registrados: ${informe.siniestros.length}`,
    `Revisiones técnicas: ${informe.revisiones.length}`,
    `Encargo por robo: ${informe.encargo.vigente ? 'VIGENTE' : 'sin encargos'}`,
    `Kilometraje: ${informe.alertaOdometro ? 'con inconsistencias' : 'coherente'}`,
    '',
    informe.resumen,
    '',
    'Te envío la copia certificada del informe completo.',
  ].join('\n');
}

export function textoWhatsappTransferencia(car: Car, t: TransferenciaNotarial): string {
  const { paso, total } = progresoTransferencia(t);
  return [
    `Transferencia notarial AutoSave · ${car.marca} ${car.modelo}`,
    `Patente ${car.patente} · Folio ${t.folio}`,
    '',
    `Estado: ${t.estado} (paso ${paso} de ${total})`,
    `Notaría: ${t.notaria}`,
    `Modalidad: ${t.modalidad}`,
    `Entrega estimada: ${fmtFecha(t.fechaEstimadaEntrega)}`,
    `Total del trámite: ${fmtCLPLocal(t.total)} (paga ${t.responsablePago.toLowerCase()})`,
    '',
    'Cualquier duda me avisas y lo vemos.',
  ].join('\n');
}
