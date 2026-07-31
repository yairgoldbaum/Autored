// Generación y descarga del informe de inspección en PDF.
// Usa expo-print (HTML → PDF) y expo-sharing (guardar/compartir en el celular).
// En iOS el HTML del PDF no soporta URLs locales de assets, por eso las fotos
// van incrustadas como data URIs base64.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import {
  CONDICION_LABEL,
  InspectionReport,
  RECOMENDACION_LABEL,
  SEVERIDAD_LABEL,
  Severidad,
} from './types';

interface CarInfo {
  marca: string;
  modelo: string;
  version: string;
  anio: number;
  km: number;
  color: string;
  patente: string;
}

const fmtCLP = (n: number) =>
  `$${String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const SEV_COLOR: Record<Severidad, string> = {
  leve: '#059669',
  moderado: '#D97706',
  grave: '#DC2626',
};

const REC_COLOR = {
  aprobar: '#059669',
  aprobar_con_reparos: '#D97706',
  revision_mecanica: '#DC2626',
} as const;

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Lee una foto local como data URI. Si la foto ya no existe (cache limpiada
// tras reiniciar la app), devuelve null y el PDF sale sin esa imagen.
async function fotoDataUri(uri: string, base64EnMemoria: string | null): Promise<string | null> {
  if (base64EnMemoria) return `data:image/jpeg;base64,${base64EnMemoria}`;
  try {
    const file = new File(uri);
    if (!file.exists) return null;
    const b64 = await file.base64();
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

export async function generarHtmlInforme(
  car: CarInfo,
  report: InspectionReport,
  base64PorStep: Record<string, string | null>,
): Promise<string> {
  const fecha = new Date(report.fecha);
  const fechaStr = `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;

  const zonas = await Promise.all(
    report.analisis.map(async (a) => {
      const dataUri = await fotoDataUri(a.uri, base64PorStep[a.stepId] ?? null);
      const hallazgosHtml = a.hallazgos.length
        ? a.hallazgos
            .map(
              (h) => `
              <tr>
                <td><span class="sev" style="background:${SEV_COLOR[h.severidad]}">${SEVERIDAD_LABEL[h.severidad]}</span></td>
                <td><b>${esc(h.titulo)}</b><br/><span class="muted">${esc(h.descripcion)}</span><br/><span class="accion">→ ${esc(h.accionSugerida)}</span></td>
                <td class="costo">${fmtCLP(h.costoEstimadoCLP)}</td>
              </tr>`,
            )
            .join('')
        : `<tr><td colspan="3" class="sinHallazgos">Sin hallazgos relevantes.</td></tr>`;

      return `
      <div class="zona">
        <div class="zonaHeader">
          <div>
            <div class="zonaTitulo">${esc(a.stepTitulo)}</div>
            <div class="muted">${esc(a.resumen)}</div>
          </div>
          <span class="cond cond-${a.condicion}">${CONDICION_LABEL[a.condicion]}</span>
        </div>
        <div class="zonaBody">
          ${dataUri ? `<img class="foto" src="${dataUri}" />` : ''}
          <table class="hallazgos">${hallazgosHtml}</table>
        </div>
      </div>`;
    }),
  );

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 24px; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0F172A; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0D9488; padding-bottom: 12px; }
  .brand { font-size: 20px; font-weight: 800; color: #0F172A; }
  .brand span { color: #0D9488; }
  .docTitle { font-size: 11px; letter-spacing: 1px; color: #64748B; font-weight: 700; text-transform: uppercase; }
  .carBox { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 16px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center; }
  .carName { font-size: 16px; font-weight: 800; }
  .patente { background: #0F172A; color: #fff; padding: 4px 10px; border-radius: 6px; font-weight: 800; letter-spacing: 1px; }
  .specs { color: #475569; margin-top: 3px; }
  .kpis { display: flex; gap: 10px; margin-top: 14px; }
  .kpi { flex: 1; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 12px; text-align: center; }
  .kpiLabel { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #64748B; font-weight: 700; }
  .kpiValue { font-size: 16px; font-weight: 800; margin-top: 3px; }
  .resumen { background: #F0FDFA; border: 1px solid #99F6E4; border-radius: 10px; padding: 12px 16px; margin-top: 14px; line-height: 1.5; }
  .resumenTitle { font-weight: 800; color: #0F766E; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  .zona { border: 1px solid #E2E8F0; border-radius: 10px; margin-top: 12px; page-break-inside: avoid; overflow: hidden; }
  .zonaHeader { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
  .zonaTitulo { font-weight: 800; font-size: 13px; }
  .zonaBody { padding: 12px 14px; display: flex; gap: 12px; align-items: flex-start; }
  .foto { width: 150px; height: 112px; object-fit: cover; border-radius: 8px; border: 1px solid #E2E8F0; }
  .hallazgos { flex: 1; border-collapse: collapse; width: 100%; }
  .hallazgos td { padding: 6px 8px; border-bottom: 1px solid #F1F5F9; vertical-align: top; }
  .sev { color: #fff; font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
  .muted { color: #64748B; }
  .accion { color: #0F766E; font-weight: 600; }
  .costo { text-align: right; font-weight: 800; white-space: nowrap; }
  .sinHallazgos { color: #059669; font-weight: 600; }
  .cond { font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; }
  .cond-bueno { background: #D1FAE5; color: #065F46; }
  .cond-regular { background: #FEF3C7; color: #92400E; }
  .cond-malo { background: #FEE2E2; color: #B91C1C; }
  .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #E2E8F0; color: #94A3B8; font-size: 9px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Sura<span>Motor</span></div>
      <div class="docTitle">Informe de Inspección de Recepción</div>
    </div>
    <div style="text-align:right">
      <div class="muted">Fecha de inspección</div>
      <b>${fechaStr}</b>
    </div>
  </div>

  <div class="carBox">
    <div>
      <div class="carName">${esc(car.marca)} ${esc(car.modelo)} ${car.anio}</div>
      <div class="specs">${esc(car.version)} • ${car.km.toLocaleString('es-CL')} km • ${esc(car.color)}</div>
    </div>
    <div class="patente">${esc(car.patente)}</div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpiLabel">Nota Condición</div>
      <div class="kpiValue">${report.notaCondicion}/10</div>
    </div>
    <div class="kpi">
      <div class="kpiLabel">Costo Est. Reparaciones</div>
      <div class="kpiValue">${fmtCLP(report.costoTotalEstimadoCLP)}</div>
    </div>
    <div class="kpi">
      <div class="kpiLabel">Recomendación</div>
      <div class="kpiValue" style="color:${REC_COLOR[report.recomendacion]}; font-size: 12px;">${RECOMENDACION_LABEL[report.recomendacion]}</div>
    </div>
  </div>

  <div class="resumen">
    <div class="resumenTitle">Resumen Ejecutivo (generado con IA)</div>
    ${esc(report.resumenGeneral)}
  </div>

  ${zonas.join('')}

  <div class="footer">
    <span>Generado automáticamente con análisis de imágenes por IA (Claude) • SuraMotor</span>
    <span>Documento referencial, no reemplaza peritaje profesional.</span>
  </div>
</body>
</html>`;
}

// Genera el PDF y abre el diálogo nativo para guardarlo o compartirlo.
export async function descargarInformePdf(
  car: CarInfo,
  report: InspectionReport,
  base64PorStep: Record<string, string | null>,
): Promise<void> {
  const html = await generarHtmlInforme(car, report, base64PorStep);
  const { uri } = await Print.printToFileAsync({ html });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Compartir archivos no está disponible en este dispositivo.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Informe de inspección ${car.patente}`,
  });
}
