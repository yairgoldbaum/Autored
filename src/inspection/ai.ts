// Análisis de fotos de inspección con Claude (Anthropic).
// Cada foto se analiza por separado para obtener hallazgos por zona, y luego
// una segunda pasada consolida todo en un informe con recomendación de recepción.
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, CLAUDE_MODEL } from './config';
import { limpiarBase64 } from './image';
import {
  Hallazgo,
  InspectionPhoto,
  InspectionReport,
  InspectionStep,
  PhotoAnalysis,
  Recomendacion,
} from './types';

interface CarContext {
  id: number;
  marca: string;
  modelo: string;
  version: string;
  anio: number;
  km: number;
  color: string;
  patente: string;
}

const getClient = () =>
  new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
    // La app llama directo desde el dispositivo (sin backend intermedio).
    dangerouslyAllowBrowser: true,
  });

const SYSTEM_INSPECTOR = `Eres un perito inspector de vehículos usados que trabaja para un compra-vendedor (dealer) en Chile.
Tu trabajo es revisar fotos tomadas al momento de RECIBIR un auto recién comprado (en remate o a particular) y detectar todo hallazgo relevante: daños de carrocería (abolladuras, rayones, óxido, mala alineación de paneles, repintados evidentes), estado de neumáticos y llantas, desgaste o daños de interior, testigos de falla encendidos en el tablero, fugas o problemas visibles en el vano motor.
Sé concreto y accionable: el dealer usará tus hallazgos para decidir reparaciones antes de publicar el auto a la venta.
Los costos estimados deben ser en pesos chilenos (CLP), valores realistas de mercado chileno para reparación en taller. Si no hay hallazgos, devuelve la lista vacía.
Responde siempre en español de Chile.`;

// Esquema JSON para el análisis de una foto (structured outputs).
const FOTO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['esFotoValida', 'condicion', 'resumen', 'hallazgos'],
  properties: {
    esFotoValida: {
      type: 'boolean',
      description:
        'true si la foto efectivamente muestra la zona del vehículo indicada; false si no corresponde o no se distingue.',
    },
    condicion: {
      type: 'string',
      enum: ['bueno', 'regular', 'malo'],
      description: 'Condición general de la zona fotografiada.',
    },
    resumen: {
      type: 'string',
      description: 'Resumen de 1 a 2 frases del estado de la zona.',
    },
    hallazgos: {
      type: 'array',
      description: 'Hallazgos relevantes detectados en la foto. Vacío si no hay.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'descripcion', 'severidad', 'costoEstimadoCLP', 'accionSugerida'],
        properties: {
          titulo: { type: 'string', description: 'Título corto del hallazgo, ej: "Abolladura en puerta trasera".' },
          descripcion: { type: 'string', description: 'Descripción del hallazgo y su ubicación exacta.' },
          severidad: { type: 'string', enum: ['leve', 'moderado', 'grave'] },
          costoEstimadoCLP: {
            type: 'integer',
            description: 'Costo estimado de reparación en pesos chilenos. 0 si no requiere reparación.',
          },
          accionSugerida: { type: 'string', description: 'Acción recomendada, ej: "Desabollar y pintar en taller".' },
        },
      },
    },
  },
} as const;

// Esquema JSON del informe consolidado.
const INFORME_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['resumenGeneral', 'recomendacion', 'notaCondicion', 'costoTotalEstimadoCLP'],
  properties: {
    resumenGeneral: {
      type: 'string',
      description:
        'Resumen ejecutivo (3 a 5 frases) del estado general del vehículo y los puntos clave que el dealer debe atender antes de publicarlo.',
    },
    recomendacion: {
      type: 'string',
      enum: ['aprobar', 'aprobar_con_reparos', 'revision_mecanica'],
      description:
        'aprobar: pasar directo a preparación estética. aprobar_con_reparos: requiere reparaciones antes de publicar. revision_mecanica: hay señales que ameritan diagnóstico mecánico profesional.',
    },
    notaCondicion: {
      type: 'integer',
      description: 'Nota de condición general del vehículo de 1 (muy malo) a 10 (impecable).',
    },
    costoTotalEstimadoCLP: {
      type: 'integer',
      description: 'Suma estimada total de reparaciones en pesos chilenos.',
    },
  },
} as const;

const contextoAuto = (car: CarContext) =>
  `Vehículo: ${car.marca} ${car.modelo} ${car.version} año ${car.anio}, ${car.km} km, color ${car.color}, patente ${car.patente}.`;

const extraerJson = <T>(response: Anthropic.Message): T => {
  const block = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  if (!block) throw new Error('La IA no devolvió contenido analizable.');
  return JSON.parse(block.text) as T;
};

interface FotoResult {
  esFotoValida: boolean;
  condicion: PhotoAnalysis['condicion'];
  resumen: string;
  hallazgos: Hallazgo[];
}

export async function analizarFoto(
  photo: InspectionPhoto,
  step: InspectionStep,
  car: CarContext,
): Promise<PhotoAnalysis> {
  if (!photo.base64) throw new Error(`La foto de "${step.titulo}" no tiene datos de imagen.`);
  const client = getClient();

  // Defensa extra: la API rechaza base64 con prefijo data-URI o saltos de línea.
  const base64 = limpiarBase64(photo.base64);

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: SYSTEM_INSPECTOR,
    output_config: { format: { type: 'json_schema', schema: FOTO_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: photo.mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `${contextoAuto(car)}
Zona a inspeccionar en esta foto: ${step.titulo} (${step.descripcion}).
Analiza la foto e identifica los hallazgos clave (key findings) de esta zona.`,
          },
        ],
      },
    ],
  });

  const data = extraerJson<FotoResult>(response);
  return {
    stepId: step.id,
    stepTitulo: step.titulo,
    uri: photo.uri,
    esFotoValida: data.esFotoValida,
    condicion: data.condicion,
    resumen: data.resumen,
    hallazgos: data.hallazgos,
  };
}

interface InformeResult {
  resumenGeneral: string;
  recomendacion: Recomendacion;
  notaCondicion: number;
  costoTotalEstimadoCLP: number;
}

export async function generarInforme(
  analisis: PhotoAnalysis[],
  car: CarContext,
): Promise<InspectionReport> {
  const client = getClient();

  const hallazgosTexto = analisis
    .map(
      (a) =>
        `## ${a.stepTitulo} (condición: ${a.condicion})\n${a.resumen}\n` +
        (a.hallazgos.length
          ? a.hallazgos
              .map(
                (h) =>
                  `- [${h.severidad}] ${h.titulo}: ${h.descripcion}. Acción: ${h.accionSugerida}. Costo est.: $${h.costoEstimadoCLP} CLP`,
              )
              .join('\n')
          : '- Sin hallazgos.'),
    )
    .join('\n\n');

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_INSPECTOR,
    output_config: { format: { type: 'json_schema', schema: INFORME_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `${contextoAuto(car)}
Estos son los hallazgos por zona detectados durante la inspección de recepción:

${hallazgosTexto}

Consolida un informe ejecutivo de recepción para el dealer.`,
      },
    ],
  });

  const data = extraerJson<InformeResult>(response);
  return {
    carId: car.id,
    fecha: new Date().toISOString(),
    modelo: `${car.marca} ${car.modelo} ${car.anio}`,
    analisis,
    resumenGeneral: data.resumenGeneral,
    recomendacion: data.recomendacion,
    notaCondicion: data.notaCondicion,
    costoTotalEstimadoCLP: data.costoTotalEstimadoCLP,
  };
}

// Traduce errores del SDK a mensajes accionables para el usuario.
export function mensajeErrorIA(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'API key inválida. Revisa tu key en src/inspection/config.ts.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Límite de uso de la API alcanzado. Espera un momento y reintenta.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Sin conexión con la API de Claude. Revisa tu internet.';
  }
  if (error instanceof Anthropic.APIError) {
    return `Error de la API de Claude (${error.status}): ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Error desconocido al analizar.';
}
