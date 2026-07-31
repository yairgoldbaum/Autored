// Pantalla de Inspección de Recepción con IA.
// Flujo: checklist de fotos por zona → análisis con Claude → informe con
// hallazgos clave, recomendación y descarga en PDF.
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { C, W, fmtCLP } from '../theme';
import { Icon, PageOverlay } from '../ui';
import { Car } from '../data';
import {
  CONDICION_LABEL,
  INSPECTION_STEPS,
  InspectionPhoto,
  InspectionReport,
  InspectionStep,
  PhotoAnalysis,
  RECOMENDACION_LABEL,
  SEVERIDAD_LABEL,
} from './types';
import { analizarFoto, generarInforme, mensajeErrorIA } from './ai';
import { normalizarFoto } from './image';
import { descargarInformePdf } from './pdf';
import { apiKeyConfigurada } from './config';

type Fase = 'checklist' | 'analizando' | 'resultado';

const SEV_COLORS = {
  leve: { bg: C.emerald100, text: C.emerald800 },
  moderado: { bg: C.amber100, text: C.amber800 },
  grave: { bg: C.red100, text: C.red700 },
} as const;

const COND_COLORS = {
  bueno: { bg: C.emerald100, text: C.emerald800 },
  regular: { bg: C.amber100, text: C.amber800 },
  malo: { bg: C.red100, text: C.red700 },
} as const;

const REC_COLORS = {
  aprobar: C.emerald600,
  aprobar_con_reparos: C.amber600,
  revision_mecanica: C.red600,
} as const;

export function InspectionScreen({
  car,
  existingReport,
  onClose,
  onSave,
  notify,
}: {
  car: Car;
  existingReport: InspectionReport | null;
  onClose: () => void;
  onSave: (report: InspectionReport) => void;
  notify: (message: string, type?: string) => void;
}) {
  const insets = useSafeAreaInsets();

  const [fase, setFase] = useState<Fase>(existingReport ? 'resultado' : 'checklist');
  const [fotos, setFotos] = useState<Record<string, InspectionPhoto>>({});
  const [report, setReport] = useState<InspectionReport | null>(existingReport);
  const [progreso, setProgreso] = useState('');
  const [exportando, setExportando] = useState(false);

  const fotosCount = Object.keys(fotos).length;

  /* ------------------- Captura de fotos ------------------- */
  // Normaliza la foto (siempre JPEG, lado mayor acotado) antes de guardarla.
  // Sin esto, fotos HEIC/PNG o de resolución completa hacen que la API de
  // Claude falle con 400 "Could not process image".
  const agregarFoto = async (step: InspectionStep, asset: ImagePicker.ImagePickerAsset) => {
    try {
      const foto = await normalizarFoto(asset.uri, asset.width, asset.height);
      setFotos((prev) => ({
        ...prev,
        [step.id]: {
          stepId: step.id,
          uri: foto.uri,
          base64: foto.base64,
          mediaType: 'image/jpeg',
        },
      }));
    } catch (error) {
      notify(
        `No se pudo procesar la foto de ${step.titulo}. Intenta de nuevo.${
          error instanceof Error ? ` (${error.message})` : ''
        }`,
        'warning',
      );
    }
  };

  const tomarFoto = async (step: InspectionStep) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      notify('Permiso de cámara denegado. Actívalo en Ajustes.', 'warning');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
    });
    if (!result.canceled && result.assets?.length) await agregarFoto(step, result.assets[0]);
  };

  const elegirDeGaleria = async (step: InspectionStep) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notify('Permiso de galería denegado. Actívalo en Ajustes.', 'warning');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 1,
    });
    if (!result.canceled && result.assets?.length) await agregarFoto(step, result.assets[0]);
  };

  const quitarFoto = (stepId: string) => {
    setFotos((prev) => {
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
  };

  /* ------------------- Análisis con IA ------------------- */
  const ejecutarAnalisis = async () => {
    const pasosConFoto = INSPECTION_STEPS.filter((s) => fotos[s.id]);
    setFase('analizando');
    try {
      const analisis: PhotoAnalysis[] = [];
      for (let i = 0; i < pasosConFoto.length; i++) {
        const step = pasosConFoto[i];
        setProgreso(`Analizando ${step.titulo} (${i + 1}/${pasosConFoto.length})…`);
        try {
          analisis.push(await analizarFoto(fotos[step.id], step, car));
        } catch (error) {
          // Indica qué zona falló para que el usuario sepa cuál foto repetir.
          throw new Error(`Falló el análisis de "${step.titulo}": ${mensajeErrorIA(error)}`);
        }
      }
      setProgreso('Generando informe ejecutivo…');
      const informe = await generarInforme(analisis, car);
      setReport(informe);
      setFase('resultado');
      notify('Inspección completada con IA.');
    } catch (error) {
      setFase('checklist');
      Alert.alert('Error en el análisis', mensajeErrorIA(error));
    }
  };

  const iniciarAnalisis = () => {
    if (!apiKeyConfigurada()) {
      Alert.alert(
        'Falta tu API key de Claude',
        'Pega una key válida (sk-ant-...) en EXPO_PUBLIC_ANTHROPIC_API_KEY dentro del archivo .env y reinicia el servidor (pnpm start -c). Ver el README.',
      );
      return;
    }
    if (fotosCount === 0) {
      notify('Toma al menos una foto para analizar.', 'warning');
      return;
    }
    const faltantes = INSPECTION_STEPS.filter((s) => s.obligatoria && !fotos[s.id]);
    if (faltantes.length > 0) {
      Alert.alert(
        'Checklist incompleto',
        `Faltan fotos de: ${faltantes.map((f) => f.titulo).join(', ')}. ¿Analizar igual con las ${fotosCount} foto(s) que tienes?`,
        [
          { text: 'Completar checklist', style: 'cancel' },
          { text: 'Analizar igual', onPress: ejecutarAnalisis },
        ],
      );
      return;
    }
    ejecutarAnalisis();
  };

  /* ------------------- Exportar PDF ------------------- */
  const exportarPdf = async () => {
    if (!report || exportando) return;
    setExportando(true);
    try {
      const base64PorStep: Record<string, string | null> = {};
      for (const a of report.analisis) base64PorStep[a.stepId] = fotos[a.stepId]?.base64 ?? null;
      await descargarInformePdf(car, report, base64PorStep);
    } catch (error) {
      Alert.alert('No se pudo generar el PDF', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setExportando(false);
    }
  };

  /* ------------------- Render ------------------- */
  return (
    <PageOverlay>
      <View style={[st.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={onClose} style={st.rowCenter} disabled={fase === 'analizando'}>
          <Icon name="chevron-left" size={14} color={C.slate400} />
          <Text style={st.backText}> Volver</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Inspección IA</Text>
        <View style={st.patentePill}>
          <Text style={st.patenteText}>{car.patente}</Text>
        </View>
      </View>

      {fase === 'checklist' && renderChecklist()}
      {fase === 'analizando' && renderAnalizando()}
      {fase === 'resultado' && report && renderResultado(report)}
    </PageOverlay>
  );

  function renderChecklist() {
    return (
      <>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
          <View>
            <Text style={st.h2}>Recepción del Vehículo</Text>
            <Text style={st.sub}>
              Fotografía cada zona del {car.marca} {car.modelo}. La IA detectará daños, desgaste y
              testigos de falla, y generará el informe de recepción.
            </Text>
          </View>

          <View style={st.progressBox}>
            <Icon name="camera" size={14} color={C.teal700} />
            <Text style={st.progressText}>
              {fotosCount} de {INSPECTION_STEPS.length} zonas fotografiadas
            </Text>
          </View>

          {INSPECTION_STEPS.map((step) => {
            const foto = fotos[step.id];
            return (
              <View key={step.id} style={st.stepCard}>
                <View style={st.rowBetween}>
                  <View style={[st.rowCenter, { flex: 1 }]}>
                    <View style={[st.stepIcon, foto && { backgroundColor: C.teal100 }]}>
                      <Icon name={step.icon as any} size={14} color={foto ? C.teal700 : C.slate500} />
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <View style={st.rowCenter}>
                        <Text style={st.stepTitle}>{step.titulo}</Text>
                        {!step.obligatoria && <Text style={st.optionalTag}> opcional</Text>}
                      </View>
                      <Text style={st.stepDesc}>{step.descripcion}</Text>
                    </View>
                  </View>
                  {foto && <Icon name="circle-check" size={18} color={C.emerald600} />}
                </View>

                {foto ? (
                  <View style={st.fotoRow}>
                    <Image source={{ uri: foto.uri }} style={st.fotoThumb} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <TouchableOpacity onPress={() => tomarFoto(step)} style={st.btnGhost}>
                        <Icon name="rotate" size={11} color={C.slate600} />
                        <Text style={st.btnGhostText}>Repetir foto</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => quitarFoto(step.id)} style={st.btnGhost}>
                        <Icon name="trash-can" size={11} color={C.red600} />
                        <Text style={[st.btnGhostText, { color: C.red600 }]}>Quitar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={st.captureRow}>
                    <TouchableOpacity onPress={() => tomarFoto(step)} style={st.btnCamera}>
                      <Icon name="camera" size={12} color={C.white} />
                      <Text style={st.btnCameraText}>Cámara</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => elegirDeGaleria(step)} style={st.btnGallery}>
                      <Icon name="images" size={12} color={C.slate700} />
                      <Text style={st.btnGalleryText}>Galería</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={[st.footer, { paddingBottom: (insets.bottom || 8) + 16 }]}>
          <TouchableOpacity
            onPress={iniciarAnalisis}
            style={[st.btnPrimary, fotosCount === 0 && { opacity: 0.5 }]}
          >
            <Icon name="wand-magic-sparkles" size={14} color={C.white} />
            <Text style={st.btnPrimaryText}>
              Analizar con IA {fotosCount > 0 ? `(${fotosCount} foto${fotosCount > 1 ? 's' : ''})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderAnalizando() {
    return (
      <View style={st.loadingWrap}>
        <ActivityIndicator size="large" color={C.chileanTeal} />
        <Text style={st.loadingTitle}>Analizando con Claude…</Text>
        <Text style={st.loadingSub}>{progreso}</Text>
        <Text style={st.loadingHint}>
          La IA está revisando carrocería, interior, tablero y motor en busca de hallazgos clave.
        </Text>
      </View>
    );
  }

  function renderResultado(rep: InspectionReport) {
    const recColor = REC_COLORS[rep.recomendacion];
    const yaGuardado = existingReport != null && report === existingReport;
    return (
      <>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }} showsVerticalScrollIndicator={false}>
          <View>
            <Text style={st.h2}>Informe de Recepción</Text>
            <Text style={st.sub}>
              {car.marca} {car.modelo} {car.anio} • {new Date(rep.fecha).toLocaleDateString('es-CL')}
            </Text>
          </View>

          {/* KPIs */}
          <View style={st.kpiRow}>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>Nota Condición</Text>
              <Text style={st.kpiValue}>{rep.notaCondicion}/10</Text>
            </View>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>Costo Reparaciones</Text>
              <Text style={st.kpiValue}>{fmtCLP(rep.costoTotalEstimadoCLP)}</Text>
            </View>
          </View>

          <View style={[st.recBox, { borderColor: recColor }]}>
            <Icon
              name={rep.recomendacion === 'aprobar' ? 'circle-check' : rep.recomendacion === 'aprobar_con_reparos' ? 'triangle-exclamation' : 'wrench'}
              size={16}
              color={recColor}
            />
            <Text style={[st.recText, { color: recColor }]}>{RECOMENDACION_LABEL[rep.recomendacion]}</Text>
          </View>

          {/* Resumen IA */}
          <View style={st.resumenBox}>
            <View style={st.rowCenter}>
              <Icon name="wand-magic-sparkles" size={12} color={C.teal700} />
              <Text style={st.resumenTitle}>  Resumen Ejecutivo (IA)</Text>
            </View>
            <Text style={st.resumenText}>{rep.resumenGeneral}</Text>
          </View>

          {/* Hallazgos por zona */}
          {rep.analisis.map((a) => {
            const cond = COND_COLORS[a.condicion];
            return (
              <View key={a.stepId} style={st.zonaCard}>
                <View style={st.rowBetween}>
                  <View style={[st.rowCenter, { flex: 1 }]}>
                    <Image source={{ uri: a.uri }} style={st.zonaThumb} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={st.stepTitle}>{a.stepTitulo}</Text>
                      <Text style={st.stepDesc} numberOfLines={3}>{a.resumen}</Text>
                    </View>
                  </View>
                  <View style={[st.condChip, { backgroundColor: cond.bg }]}>
                    <Text style={[st.condChipText, { color: cond.text }]}>{CONDICION_LABEL[a.condicion]}</Text>
                  </View>
                </View>

                {a.hallazgos.map((h, idx) => {
                  const sev = SEV_COLORS[h.severidad];
                  return (
                    <View key={idx} style={st.hallazgoRow}>
                      <View style={[st.sevChip, { backgroundColor: sev.bg }]}>
                        <Text style={[st.sevChipText, { color: sev.text }]}>{SEVERIDAD_LABEL[h.severidad]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.hallazgoTitulo}>{h.titulo}</Text>
                        <Text style={st.hallazgoDesc}>{h.descripcion}</Text>
                        <Text style={st.hallazgoAccion}>→ {h.accionSugerida}</Text>
                      </View>
                      {h.costoEstimadoCLP > 0 && <Text style={st.hallazgoCosto}>{fmtCLP(h.costoEstimadoCLP)}</Text>}
                    </View>
                  );
                })}
                {a.hallazgos.length === 0 && (
                  <Text style={st.sinHallazgos}>✓ Sin hallazgos relevantes en esta zona.</Text>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={[st.footer, { paddingBottom: (insets.bottom || 8) + 16, gap: 10 }]}>
          <TouchableOpacity onPress={exportarPdf} style={st.btnPdf} disabled={exportando}>
            {exportando ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <Icon name="file-pdf" size={14} color={C.white} />
            )}
            <Text style={st.btnPrimaryText}>{exportando ? 'Generando PDF…' : 'Descargar Informe PDF'}</Text>
          </TouchableOpacity>
          {!yaGuardado && (
            <TouchableOpacity onPress={() => onSave(rep)} style={st.btnPrimary}>
              <Icon name="floppy-disk" size={14} color={C.white} />
              <Text style={st.btnPrimaryText}>Guardar en Ficha del Auto</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setReport(null);
              setFase('checklist');
            }}
            style={st.btnGhostWide}
          >
            <Icon name="rotate" size={12} color={C.slate600} />
            <Text style={st.btnGhostText}> Nueva inspección</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.slate100,
  },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { fontSize: 14, fontWeight: W.semibold, color: C.slate500 },
  headerTitle: { fontSize: 15, fontWeight: W.extrabold, color: C.slate900 },
  patentePill: { backgroundColor: C.slate900, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  patenteText: { color: C.white, fontSize: 11, fontWeight: W.extrabold, letterSpacing: 1 },

  h2: { fontSize: 19, fontWeight: W.extrabold, color: C.slate900 },
  sub: { fontSize: 13, color: C.slate500, marginTop: 3, lineHeight: 18 },

  progressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.teal50,
    borderWidth: 1,
    borderColor: C.teal200,
    borderRadius: 12,
    padding: 12,
  },
  progressText: { fontSize: 13, fontWeight: W.bold, color: C.teal800 },

  stepCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.slate200,
    padding: 14,
    gap: 12,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { fontSize: 14, fontWeight: W.bold, color: C.slate800 },
  optionalTag: { fontSize: 11, color: C.slate400, fontWeight: W.semibold },
  stepDesc: { fontSize: 12, color: C.slate500, marginTop: 1 },

  captureRow: { flexDirection: 'row', gap: 10 },
  btnCamera: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.chileanTeal,
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnCameraText: { color: C.white, fontSize: 12, fontWeight: W.bold },
  btnGallery: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.slate100,
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnGalleryText: { color: C.slate700, fontSize: 12, fontWeight: W.bold },

  fotoRow: { flexDirection: 'row', gap: 12 },
  fotoThumb: { width: 110, height: 82, borderRadius: 10, backgroundColor: C.slate100 },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 10,
    paddingVertical: 8,
  },
  btnGhostText: { fontSize: 12, fontWeight: W.bold, color: C.slate600 },
  btnGhostWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },

  footer: {
    padding: 16,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.slate100,
    gap: 0,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.chileanTeal,
    borderRadius: 14,
    paddingVertical: 15,
  },
  btnPdf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.slate900,
    borderRadius: 14,
    paddingVertical: 15,
  },
  btnPrimaryText: { color: C.white, fontSize: 14, fontWeight: W.extrabold },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  loadingTitle: { fontSize: 17, fontWeight: W.extrabold, color: C.slate900, marginTop: 8 },
  loadingSub: { fontSize: 14, fontWeight: W.semibold, color: C.teal700 },
  loadingHint: { fontSize: 12, color: C.slate400, textAlign: 'center', lineHeight: 18, marginTop: 8 },

  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  kpiLabel: { fontSize: 10, fontWeight: W.bold, color: C.slate400, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 18, fontWeight: W.black, color: C.slate900, marginTop: 4 },

  recBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    backgroundColor: C.white,
  },
  recText: { fontSize: 14, fontWeight: W.extrabold, flex: 1 },

  resumenBox: {
    backgroundColor: C.teal50,
    borderWidth: 1,
    borderColor: C.teal200,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  resumenTitle: { fontSize: 11, fontWeight: W.extrabold, color: C.teal800, textTransform: 'uppercase', letterSpacing: 0.5 },
  resumenText: { fontSize: 13, color: C.slate700, lineHeight: 20 },

  zonaCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.slate200,
    padding: 14,
    gap: 10,
  },
  zonaThumb: { width: 54, height: 54, borderRadius: 10, backgroundColor: C.slate100 },
  condChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  condChipText: { fontSize: 10, fontWeight: W.extrabold, textTransform: 'uppercase' },

  hallazgoRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: C.slate100,
    paddingTop: 10,
    alignItems: 'flex-start',
  },
  sevChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 1 },
  sevChipText: { fontSize: 9, fontWeight: W.extrabold, textTransform: 'uppercase' },
  hallazgoTitulo: { fontSize: 13, fontWeight: W.bold, color: C.slate800 },
  hallazgoDesc: { fontSize: 12, color: C.slate500, marginTop: 2, lineHeight: 17 },
  hallazgoAccion: { fontSize: 12, color: C.teal700, fontWeight: W.semibold, marginTop: 3 },
  hallazgoCosto: { fontSize: 12, fontWeight: W.extrabold, color: C.slate800 },
  sinHallazgos: {
    fontSize: 12,
    color: C.emerald600,
    fontWeight: W.semibold,
    borderTopWidth: 1,
    borderTopColor: C.slate100,
    paddingTop: 10,
  },
});
