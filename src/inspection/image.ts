// Normalización de fotos antes de enviarlas a la API de Claude.
//
// ¿Por qué? En iOS la cámara/galería puede entregar HEIC, PNG o JPEG de
// resolución completa. Si los bytes no coinciden con el media_type declarado
// (ej: HEIC etiquetado como image/jpeg) o la imagen excede los límites de la
// API (8000px por lado / ~5MB), Claude responde 400 "Could not process image".
// Aquí re-codificamos SIEMPRE a JPEG y limitamos el lado mayor, lo que además
// baja el consumo de tokens sin perder calidad de análisis.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// 1568px es la resolución máxima que la API de Claude aprovecha por defecto;
// más grande solo suma peso y tokens.
const LADO_MAYOR_MAX = 1568;
const CALIDAD_JPEG = 0.7;

export interface FotoNormalizada {
  uri: string;
  base64: string;
}

export async function normalizarFoto(
  uri: string,
  width?: number,
  height?: number,
): Promise<FotoNormalizada> {
  const context = ImageManipulator.manipulate(uri);

  // Reducimos solo si conocemos las dimensiones y exceden el máximo;
  // si no las conocemos, igual re-codificamos a JPEG (el fix principal).
  if (width && height && Math.max(width, height) > LADO_MAYOR_MAX) {
    if (width >= height) context.resize({ width: LADO_MAYOR_MAX, height: null });
    else context.resize({ width: null, height: LADO_MAYOR_MAX });
  }

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: CALIDAD_JPEG,
    base64: true,
  });

  if (!result.base64) {
    throw new Error('No se pudo codificar la foto para el análisis.');
  }
  return { uri: result.uri, base64: limpiarBase64(result.base64) };
}

// La API exige base64 "puro": sin prefijo data URI y sin saltos de línea.
export function limpiarBase64(b64: string): string {
  return b64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
}
