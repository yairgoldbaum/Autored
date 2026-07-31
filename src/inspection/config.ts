// Configuración del análisis de imágenes con IA (Claude / Anthropic).
//
// La API key se lee desde el archivo `.env` (variable EXPO_PUBLIC_ANTHROPIC_API_KEY).
// Ver el README, sección "Configurar la API key de Claude".
//
// ⚠️ Ojo: las variables EXPO_PUBLIC_* quedan embebidas en texto plano dentro del
// bundle de la app, así que cualquiera con el binario puede extraerla. Para
// producción, mueve la llamada a un backend propio y deja la key en el servidor.
export const ANTHROPIC_API_KEY =
  process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

// Claude Sonnet: mejor balance velocidad/inteligencia para análisis de fotos.
export const CLAUDE_MODEL = 'claude-sonnet-4-6';

export const apiKeyConfigurada = () =>
  ANTHROPIC_API_KEY.startsWith('sk-ant-');
