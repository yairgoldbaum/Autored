import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, fmtCLP, fmtMiles } from '../src/theme';
import { Dropdown, Icon, PageOverlay, Sheet, Spinner } from '../src/ui';
import { s } from '../src/styles';
import {
  Car,
  EnvioInforme,
  InformeAutosave,
  ModalidadTransferencia,
  ResponsablePago,
  TraspasoOrigen,
  VehicleContact,
} from '../src/data';
import { AUTOMOTORA, NOTARIAS, PRECIO_COPIA_INFORME, cotizarTransferencia, fmtFecha } from '../src/autosave';
import { hasContactData, veredictoColor } from '../src/helpers';
import { Field, PartyRow, ReportRow, SegBtn, TechItem } from '../components/shared';

interface InformeAutosaveOverlayProps {
  activeCar: Car | null;
  activeInforme: InformeAutosave | null;
  activeBloqueos: string[];
  isAutosaveReportOpen: boolean;
  setIsAutosaveReportOpen: (open: boolean) => void;
  handleAbrirEnvioInforme: (car: Car) => void;
  handleAbrirTransferencia: (car: Car) => void;
}

/* ======================= AUTOSAVE: VENTANA DEL INFORME ======================= */
export function InformeAutosaveOverlay({
  activeCar,
  activeInforme,
  activeBloqueos,
  isAutosaveReportOpen,
  setIsAutosaveReportOpen,
  handleAbrirEnvioInforme,
  handleAbrirTransferencia,
}: InformeAutosaveOverlayProps) {
  const insets = useSafeAreaInsets();
  if (!activeCar || !activeInforme || !isAutosaveReportOpen) return null;
  const car = activeCar;
  const informe = activeInforme;
  const impagas = informe.multas.filter((m) => !m.pagada);
  const totalImpagas = impagas.reduce((sum, m) => sum + m.monto, 0);
  const general = veredictoColor(informe.veredictoGeneral);
  const kmMax = Math.max(informe.kmDeclaradoActual, ...informe.revisiones.map((r) => r.km), 1);

  return (
    <PageOverlay>
      <View style={[s.overlayHeader, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => setIsAutosaveReportOpen(false)} style={s.rowCenter}>
          <Icon name="chevron-left" size={14} color={C.slate400} />
          <Text style={s.cancelText}> Volver</Text>
        </TouchableOpacity>
        <Text style={s.overlayTitle}>Informe AutoSave</Text>
        <View style={s.stepPill}>
          <Text style={s.stepPillText}>{informe.folio}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16, gap: 16 }}>
          {/* Encabezado del documento */}
          <View style={s.asReportHero}>
            <Text style={s.asReportHeroTitle}>
              {car.marca} {car.modelo} {car.version}
            </Text>
            <Text style={s.asReportHeroSub}>
              {car.patente} · {car.anio} · VIN {informe.vin}
            </Text>
            <Text style={s.asReportHeroSub}>Consultado el {fmtFecha(informe.fechaConsulta)} · vigencia 30 días</Text>
            <View style={[s.asReportBanner, { backgroundColor: general.color }]}>
              <Text style={s.asReportBannerText}>
                {informe.veredictoGeneral === 'ok'
                  ? 'Sin observaciones'
                  : informe.veredictoGeneral === 'atencion'
                    ? 'Con observaciones'
                    : 'No recomendado sin resolver los hallazgos'}
              </Text>
            </View>
            <Text style={s.asReportResumen}>{informe.resumen}</Text>
          </View>

          {/* Resumen */}
          <View style={s.detailTechCard}>
            <Text style={s.detailTechTitle}>Resumen</Text>
            <ReportRow
              label="Encargo por robo"
              value={informe.encargo.vigente ? 'Encargo vigente' : 'Sin encargos vigentes'}
              veredicto={informe.veredictos.encargo}
            />
            <ReportRow
              label="Siniestros"
              value={informe.siniestros.length ? `${informe.siniestros.length} registrados` : 'Sin registros'}
              veredicto={informe.veredictos.siniestros}
            />
            <ReportRow
              label="Odómetro"
              value={
                informe.alertaOdometro
                  ? `Retroceso de ${fmtMiles(informe.kmUltimaRevision - informe.kmDeclaradoActual)} km`
                  : 'Coherente con las revisiones'
              }
              veredicto={informe.veredictos.odometro}
            />
            <ReportRow
              label="Multas"
              value={
                impagas.length
                  ? `${impagas.length} impaga${impagas.length > 1 ? 's' : ''} · ${fmtCLP(totalImpagas)}`
                  : 'Sin multas impagas'
              }
              veredicto={impagas.length ? 'atencion' : 'ok'}
            />
            <ReportRow
              label="Prenda / limitaciones"
              value={informe.prenda?.vigente ? `${informe.prenda.tipo} vigente` : 'Sin prenda vigente'}
              veredicto={informe.prenda?.vigente ? 'critico' : 'ok'}
              last
            />
          </View>

          {/* Encargo */}
          {informe.encargo.vigente ? (
            <View style={[s.detailTechCard, { borderColor: C.red100, backgroundColor: C.red50 }]}>
              <Text style={[s.detailTechTitle, { color: C.red700 }]}>Encargo por robo</Text>
              <Text style={s.asEventTitle}>Vigente desde el {fmtFecha(informe.encargo.fecha)}</Text>
              <Text style={s.asEventMeta}>{informe.encargo.juzgado}</Text>
              <Text style={[s.asAlertText, { marginTop: 6 }]}>{informe.encargo.detalle}</Text>
            </View>
          ) : null}

          {/* Identificación y origen */}
          <View style={s.detailTechCard}>
            <Text style={s.detailTechTitle}>Identificación y origen</Text>
            <View style={s.detailTechGrid}>
              <TechItem label="Importadora" value={informe.importadora} />
              <TechItem label="Primera inscripción" value={fmtFecha(informe.fechaPrimeraInscripcion)} />
              <TechItem label="Tasación fiscal (SII)" value={fmtCLP(informe.tasacionFiscal)} />
              <TechItem label="Titulares registrados" value={String(informe.titulares.length)} />
            </View>
          </View>

          {/* Siniestros */}
          <View style={s.detailTechCard}>
            <Text style={s.detailTechTitle}>Siniestros ({informe.siniestros.length})</Text>
            {informe.siniestros.length ? (
              <View style={{ gap: 10 }}>
                {informe.siniestros.map((sn, i) => {
                  const grave = sn.gravedad === 'Grave' || sn.gravedad === 'Pérdida total';
                  const col = grave ? C.red600 : sn.gravedad === 'Moderado' ? C.amber600 : C.slate300;
                  return (
                    <View key={`${sn.fecha}-${i}`} style={[s.asEventCard, { borderLeftColor: col }]}>
                      <View style={s.detailMoneyRow}>
                        <Text style={s.asEventTitle}>{sn.tipo}</Text>
                        <Text style={[s.asEventTag, { color: col }]}>{sn.gravedad.toUpperCase()}</Text>
                      </View>
                      <Text style={s.asEventMeta}>
                        {fmtFecha(sn.fecha)} · {sn.compania} · {fmtCLP(sn.montoReparacion)}
                      </Text>
                      <Text style={s.asEventMeta}>{sn.piezasAfectadas.join(', ')}</Text>
                      {sn.taller ? <Text style={s.asEventMeta}>Reparado en {sn.taller}</Text> : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={s.emptySectionText}>Sin siniestros registrados en compañías de seguro.</Text>
            )}
          </View>

          {/* Historial de odómetro */}
          <View style={s.detailTechCard}>
            <Text style={s.detailTechTitle}>Historial de odómetro</Text>
            {informe.revisiones.length ? (
              <View style={{ gap: 12 }}>
                {informe.revisiones.map((rt, i) => (
                  <View key={`${rt.fecha}-${i}`}>
                    <View style={s.detailMoneyRow}>
                      <Text style={s.asKmFecha}>{fmtFecha(rt.fecha)}</Text>
                      <Text style={[s.asKmValue, rt.inconsistente && { color: C.red600 }]}>
                        {fmtMiles(rt.km)} km
                      </Text>
                    </View>
                    <View style={s.asKmTrack}>
                      <View
                        style={[
                          s.asKmFill,
                          {
                            width: `${Math.max(6, Math.round((rt.km / kmMax) * 100))}%`,
                            backgroundColor: rt.inconsistente ? C.red600 : C.slate700,
                          },
                        ]}
                      />
                    </View>
                    <Text style={s.asEventMeta}>
                      {rt.planta} · {rt.resultado}
                    </Text>
                    {rt.observacion ? <Text style={s.asEventMeta}>Obs: {rt.observacion}</Text> : null}
                    {rt.inconsistente ? (
                      <View style={[s.asAlertStrip, { backgroundColor: C.red50, borderLeftColor: C.red600, marginTop: 8 }]}>
                        <Text style={s.asAlertText}>
                          Hoy el vehículo declara {fmtMiles(informe.kmDeclaradoActual)} km: retroceso de{' '}
                          {fmtMiles(rt.km - informe.kmDeclaradoActual)} km respecto de esta revisión.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
                <View style={s.asKmActual}>
                  <Text style={s.asKmFecha}>Odómetro declarado hoy</Text>
                  <Text style={s.asKmValue}>{fmtMiles(informe.kmDeclaradoActual)} km</Text>
                </View>
              </View>
            ) : (
              <Text style={s.emptySectionText}>El vehículo aún no registra revisiones técnicas.</Text>
            )}
          </View>

          {/* Titulares */}
          <View style={s.detailTechCard}>
            <Text style={s.detailTechTitle}>Titulares y patentes ({informe.titulares.length})</Text>
            <View style={{ gap: 10 }}>
              {informe.titulares.map((tit, i) => (
                <View key={`${tit.desde}-${i}`} style={s.asEventCard}>
                  <View style={s.detailMoneyRow}>
                    <Text style={s.asEventTitle}>{tit.titular}</Text>
                    <Text style={s.asEventTag}>{tit.patente}</Text>
                  </View>
                  <Text style={s.asEventMeta}>
                    {tit.desde.slice(0, 4)} – {tit.hasta ? tit.hasta.slice(0, 4) : 'hoy'} · {tit.tipo} · {tit.region}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Multas */}
          <View style={s.detailTechCard}>
            <Text style={s.detailTechTitle}>Multas ({informe.multas.length})</Text>
            {informe.multas.length ? (
              <View style={{ gap: 10 }}>
                {informe.multas.map((m, i) => (
                  <View key={`${m.fecha}-${i}`} style={[s.asEventCard, { borderLeftColor: m.pagada ? C.slate300 : C.red600 }]}>
                    <View style={s.detailMoneyRow}>
                      <Text style={s.asEventTitle}>{m.motivo}</Text>
                      <Text style={[s.asEventTag, !m.pagada && { color: C.red600 }]}>
                        {m.pagada ? 'PAGADA' : 'IMPAGA'}
                      </Text>
                    </View>
                    <Text style={s.asEventMeta}>
                      {fmtFecha(m.fecha)} · {m.juzgado} · {fmtCLP(m.monto)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={s.emptySectionText}>Sin multas registradas.</Text>
            )}
          </View>

          {/* Prenda */}
          <View style={s.detailTechCard}>
            <Text style={s.detailTechTitle}>Prenda y limitaciones al dominio</Text>
            {informe.prenda?.vigente ? (
              <View style={[s.asEventCard, { borderLeftColor: C.red600 }]}>
                <Text style={s.asEventTitle}>{informe.prenda.tipo}</Text>
                <Text style={s.asEventMeta}>
                  {informe.prenda.acreedor} · constituida el {fmtFecha(informe.prenda.fechaConstitucion)}
                </Text>
                <Text style={s.asEventMeta}>Saldo insoluto {fmtCLP(informe.prenda.saldoInsoluto)}</Text>
              </View>
            ) : (
              <Text style={s.emptySectionText}>Sin prenda ni limitaciones vigentes.</Text>
            )}
          </View>

          <Text style={s.asDisclaimer}>
            Informe generado localmente para demostración. Los datos no provienen de registros reales.
          </Text>
        </View>
      </ScrollView>

      <View style={[s.detailFooter, { paddingBottom: (insets.bottom || 8) + 16 }]}>
        <View style={s.detailFooterActions}>
          <TouchableOpacity
            onPress={() => {
              setIsAutosaveReportOpen(false);
              handleAbrirEnvioInforme(car);
            }}
            style={s.detailActionGray}
          >
            <Icon name="paper-plane" size={12} color={C.slate700} />
            <Text style={s.detailActionGrayText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              Enviar al cliente
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={car.estado !== 'Vendido' || activeBloqueos.length > 0 || !!car.transferencia}
            onPress={() => {
              setIsAutosaveReportOpen(false);
              handleAbrirTransferencia(car);
            }}
            style={[
              s.detailActionGray,
              { backgroundColor: C.chileanNavy },
              (car.estado !== 'Vendido' || activeBloqueos.length > 0 || !!car.transferencia) && s.asCtaDisabled,
            ]}
          >
            <Icon
              name="file-signature"
              size={12}
              color={car.estado !== 'Vendido' || activeBloqueos.length > 0 || !!car.transferencia ? C.slate400 : C.white}
            />
            <Text
              style={[
                s.detailActionGrayText,
                { color: car.estado !== 'Vendido' || activeBloqueos.length > 0 || !!car.transferencia ? C.slate400 : C.white },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              Transferencia
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </PageOverlay>
  );
}

interface EnvioInformeSheetProps {
  activeCar: Car | null;
  activeInforme: InformeAutosave | null;
  isEnvioInformeSheetOpen: boolean;
  setIsEnvioInformeSheetOpen: (open: boolean) => void;
  envioDestinatario: EnvioInforme['destinatario'];
  envioContacto: VehicleContact;
  setEnvioContacto: React.Dispatch<React.SetStateAction<VehicleContact>>;
  handleCambiarDestinatario: (destino: EnvioInforme['destinatario']) => void;
  handleEnviarInforme: () => void;
}

/* ======================= SHEET: ENVIAR INFORME AL CLIENTE ======================= */
export function EnvioInformeSheet({
  activeCar,
  activeInforme,
  isEnvioInformeSheetOpen,
  setIsEnvioInformeSheetOpen,
  envioDestinatario,
  envioContacto,
  setEnvioContacto,
  handleCambiarDestinatario,
  handleEnviarInforme,
}: EnvioInformeSheetProps) {
  const insets = useSafeAreaInsets();
  if (!activeCar || !activeInforme) return null;
  const car = activeCar;
  const opciones: { key: EnvioInforme['destinatario']; label: string; disponible: boolean }[] = [
    { key: 'Comprador', label: 'Comprador', disponible: hasContactData(car.comprador) },
    { key: 'Vendedor', label: 'Vendedor', disponible: hasContactData(car.clienteAdquisicion) },
    { key: 'Otro', label: 'Otro contacto', disponible: true },
  ];

  return (
    <Sheet visible={isEnvioInformeSheetOpen && !!activeCar} onClose={() => setIsEnvioInformeSheetOpen(false)} maxHeightPct={88}>
      <View style={s.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.sheetTitle}>Enviar informe al cliente</Text>
          <Text style={s.subMuted}>
            {car.marca} {car.modelo} · Folio {activeInforme.folio}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setIsEnvioInformeSheetOpen(false)}>
          <Icon name="circle-xmark" size={18} color={C.slate400} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View>
          <Text style={s.sheetFieldLabel}>¿Quién lo recibe?</Text>
          <View style={s.asChipRow}>
            {opciones.map((op) => (
              <TouchableOpacity
                key={op.key}
                disabled={!op.disponible}
                onPress={() => handleCambiarDestinatario(op.key)}
                style={[s.asChip, envioDestinatario === op.key && s.asChipActive, !op.disponible && { opacity: 0.4 }]}
              >
                <Text style={[s.asChipText, envioDestinatario === op.key && { color: C.white }]}>{op.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.inlinePanel}>
          <Text style={s.inlinePanelTitle}>Datos de contacto</Text>
          <Text style={s.inlinePanelHint}>La copia se envía por WhatsApp al número que registres.</Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            <Field
              label="Nombre"
              placeholder="Ej: Carolina Soto"
              value={envioContacto.nombre}
              onChange={(nombre) => setEnvioContacto({ ...envioContacto, nombre })}
            />
            <Field
              label="Teléfono"
              placeholder="Ej: +56 9 1234 5678"
              keyboardType="phone-pad"
              value={envioContacto.telefono}
              onChange={(telefono) => setEnvioContacto({ ...envioContacto, telefono })}
            />
          </View>
        </View>

        <View style={s.inlinePanel}>
          <Text style={s.inlinePanelTitle}>Qué incluye la copia certificada</Text>
          <View style={{ gap: 6, marginTop: 8 }}>
            {[
              'Informe completo con folio verificable',
              'Siniestros, encargo por robo y odómetro',
              'Multas, prenda y titulares anteriores',
              'Vigencia 30 días desde la emisión',
            ].map((item) => (
              <View key={item} style={s.asPitchRow}>
                <Icon name="check" size={9} color={C.teal700} />
                <Text style={s.asPitchText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[s.sheetFooter, { paddingBottom: (insets.bottom || 0) + 16 }]}>
        <TouchableOpacity onPress={() => setIsEnvioInformeSheetOpen(false)} style={s.sheetBtnGray}>
          <Text style={s.sheetBtnGrayText}>Ahora no</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleEnviarInforme} style={[s.sheetBtnTeal, { backgroundColor: C.chileanNavy }]}>
          <Text style={s.sheetBtnTealText}>Enviar · {fmtCLP(PRECIO_COPIA_INFORME)}</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

interface TransferSheetProps {
  activeCar: Car | null;
  activeInforme: InformeAutosave | null;
  activeBloqueos: string[];
  isTransferSheetOpen: boolean;
  setIsTransferSheetOpen: (open: boolean) => void;
  transferOrigen: TraspasoOrigen;
  setTransferOrigen: React.Dispatch<React.SetStateAction<TraspasoOrigen>>;
  transferModalidad: ModalidadTransferencia;
  transferNotaria: string;
  setTransferNotaria: React.Dispatch<React.SetStateAction<string>>;
  transferPagador: ResponsablePago;
  setTransferPagador: React.Dispatch<React.SetStateAction<ResponsablePago>>;
  transferProcesando: boolean;
  handleCambiarModalidad: (modalidad: ModalidadTransferencia) => void;
  handleGenerarTransferencia: () => void;
  showNotification: (message: string, type?: string) => void;
}

/* ======================= SHEET: TRANSFERENCIA NOTARIAL ======================= */
export function TransferSheet({
  activeCar,
  activeInforme,
  activeBloqueos,
  isTransferSheetOpen,
  setIsTransferSheetOpen,
  transferOrigen,
  setTransferOrigen,
  transferModalidad,
  transferNotaria,
  setTransferNotaria,
  transferPagador,
  setTransferPagador,
  transferProcesando,
  handleCambiarModalidad,
  handleGenerarTransferencia,
  showNotification,
}: TransferSheetProps) {
  const insets = useSafeAreaInsets();
  if (!activeCar || !activeInforme) return null;
  const car = activeCar;
  const bloqueado = activeBloqueos.length > 0;
  const copiaPagada = (car.informesEnviados || []).length > 0;
  const cotizacion = cotizarTransferencia({
    precioOperacion: car.precioVenta,
    tasacionFiscal: activeInforme.tasacionFiscal,
    modalidad: transferModalidad,
    copiaInformeYaPagada: copiaPagada,
  });
  const puedeDirecto = hasContactData(car.clienteAdquisicion);
  const vendedor =
    transferOrigen === 'Directo' && puedeDirecto
      ? (car.clienteAdquisicion as VehicleContact)
      : { clienteId: null, nombre: AUTOMOTORA.nombre, telefono: AUTOMOTORA.telefono };

  return (
    <Sheet visible={isTransferSheetOpen && !!activeCar} onClose={() => setIsTransferSheetOpen(false)} maxHeightPct={90}>
      <View style={s.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.sheetTitle}>Transferencia notarial</Text>
          <Text style={s.subMuted}>
            {car.marca} {car.modelo} · {car.patente}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setIsTransferSheetOpen(false)}>
          <Icon name="circle-xmark" size={18} color={C.slate400} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        {bloqueado ? (
          <View style={[s.asAlertStrip, { backgroundColor: C.red50, borderLeftColor: C.red600 }]}>
            <Text style={[s.asAlertTitle, { color: C.red700 }]}>El informe AutoSave bloquea la inscripción</Text>
            {activeBloqueos.map((b) => (
              <Text key={b} style={s.asAlertText}>
                · {b}
              </Text>
            ))}
          </View>
        ) : null}

        <View>
          <Text style={s.sheetFieldLabel}>Tipo de traspaso</Text>
          <View style={s.segment}>
            <SegBtn
              label="Desde la automotora"
              active={transferOrigen === 'Automotora'}
              onPress={() => setTransferOrigen('Automotora')}
            />
            <SegBtn
              label="Directo al comprador"
              active={transferOrigen === 'Directo'}
              onPress={() => (puedeDirecto ? setTransferOrigen('Directo') : showNotification('Este auto no tiene cliente de adquisición registrado.', 'warning'))}
            />
          </View>
          <Text style={s.inlinePanelHint}>
            {transferOrigen === 'Directo'
              ? 'El dueño anterior transfiere directamente al comprador. La automotora solo gestiona.'
              : 'El vehículo se transfiere desde la automotora al comprador final.'}
          </Text>
        </View>

        <View style={s.inlinePanel}>
          <Text style={s.inlinePanelTitle}>Partes</Text>
          <View style={{ gap: 10, marginTop: 10 }}>
            <PartyRow rol="Vendedor" contacto={vendedor} />
            <PartyRow rol="Comprador" contacto={car.comprador} />
          </View>
          {!hasContactData(car.comprador) ? (
            <Text style={[s.inlinePanelHint, { color: C.red600 }]}>
              Registra al comprador en "Cambiar Estado" antes de generar la transferencia.
            </Text>
          ) : null}
        </View>

        <View>
          <Text style={s.sheetFieldLabel}>Modalidad</Text>
          <View style={s.segment}>
            <SegBtn label="Digital" active={transferModalidad === 'Digital'} onPress={() => handleCambiarModalidad('Digital')} />
            <SegBtn
              label="Presencial"
              active={transferModalidad === 'Presencial'}
              onPress={() => handleCambiarModalidad('Presencial')}
            />
          </View>
        </View>

        <View>
          <Text style={s.sheetFieldLabel}>Notaría</Text>
          <Dropdown
            small
            value={transferNotaria}
            onChange={setTransferNotaria}
            options={NOTARIAS.map((n) => ({ label: n, value: n }))}
          />
        </View>

        <View>
          <Text style={s.sheetFieldLabel}>¿Quién paga el trámite?</Text>
          <View style={s.asChipRow}>
            {(['Comprador', 'Vendedor', 'Compartido'] as ResponsablePago[]).map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setTransferPagador(r)}
                style={[s.asChip, transferPagador === r && s.asChipActive]}
              >
                <Text style={[s.asChipText, transferPagador === r && { color: C.white }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.inlinePanel}>
          <Text style={s.inlinePanelTitle}>Costos del trámite</Text>
          <Text style={s.inlinePanelHint}>
            Base imponible {fmtCLP(cotizacion.baseImponible)} — el mayor entre el precio de la operación (
            {fmtCLP(car.precioVenta)}) y la tasación fiscal del SII ({fmtCLP(activeInforme.tasacionFiscal)}).
          </Text>
          <View style={{ marginTop: 12 }}>
            {cotizacion.costos.map((c) => (
              <View key={c.concepto} style={s.asCostRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={s.asCostLabel}>{c.concepto}</Text>
                  {c.nota ? <Text style={s.asCostNota}>{c.nota}</Text> : null}
                </View>
                <Text style={[s.asCostValue, c.monto < 0 && { color: C.emerald600 }]}>
                  {c.monto === 0 ? 'Incluida' : fmtCLP(c.monto)}
                </Text>
              </View>
            ))}
            <View style={[s.asCostRow, s.asCostTotalRow]}>
              <Text style={s.asCostTotalLabel}>Total</Text>
              <Text style={s.asCostTotalValue}>{fmtCLP(cotizacion.total)}</Text>
            </View>
          </View>
          <Text style={[s.inlinePanelHint, { marginTop: 8 }]}>
            Entrega estimada: {fmtFecha(cotizacion.fechaEstimadaEntrega)} ({cotizacion.plazoTexto}).
          </Text>
        </View>
      </ScrollView>

      <View style={[s.sheetFooter, { paddingBottom: (insets.bottom || 0) + 16 }]}>
        <TouchableOpacity onPress={() => setIsTransferSheetOpen(false)} style={s.sheetBtnGray}>
          <Text style={s.sheetBtnGrayText}>Ahora no</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={bloqueado || transferProcesando}
          onPress={handleGenerarTransferencia}
          style={[s.sheetBtnTeal, { backgroundColor: C.chileanNavy }, (bloqueado || transferProcesando) && s.asCtaDisabled]}
        >
          {transferProcesando ? (
            <View style={s.rowCenter}>
              <Spinner size={11} color={C.white} />
              <Text style={[s.sheetBtnTealText, { marginLeft: 6 }]}>Enviando a AutoSave…</Text>
            </View>
          ) : (
            <Text style={[s.sheetBtnTealText, bloqueado && { color: C.slate400 }]}>Generar transferencia</Text>
          )}
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}
