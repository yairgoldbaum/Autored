import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, W, fmtCLP, fmtMiles } from '../src/theme';
import { Icon, PageOverlay, Ping, Sheet } from '../src/ui';
import { s } from '../src/styles';
import { Auction, Car, ESTADOS, EstadoAuto, InformeAutosave, VehicleContact, costoBase, diasEnStock } from '../src/data';
import {
  PITCH_TRANSFERENCIA,
  PRECIO_COPIA_INFORME,
  alertaPrincipal,
  cotizarTransferencia,
  fmtFecha,
  progresoTransferencia,
  resumenVeredictos,
} from '../src/autosave';
import { emptyContact, hasContactData, requiresBuyer, totalAntecedentes, veredictoColor } from '../src/helpers';
import {
  Field,
  MotorPreciosPublicacion,
  PhotoGallery,
  SegBtn,
  TechItem,
  TransferMetaRow,
  VehicleContactCard,
} from '../components/shared';

interface FichaAutoProps {
  activeCar: Car | null;
  setActiveCar: (car: Car | null) => void;
  /* La bandera compartida del modo cliente (cruce 4): vive en AppInner para
     que cualquier pantalla que muestre precios use la misma. */
  modoCliente: boolean;
  setModoCliente: (on: boolean) => void;
  activeStockAuctionMap: Map<number, Auction>;
  activeInforme: InformeAutosave | null;
  activeBloqueos: string[];
  setInspectingCar: (car: Car | null) => void;
  setIsAutosaveReportOpen: (open: boolean) => void;
  handleAbrirEnvioInforme: (car: Car) => void;
  handleAbrirTransferencia: (car: Car) => void;
  handleAvanzarTransferencia: (car: Car) => void;
  handleCompartirTransferencia: (car: Car) => void;
  handleLlamar: (telefono: string) => void;
  handleWhatsapp: (telefono: string) => void;
  setAdjustedPrice: React.Dispatch<React.SetStateAction<number>>;
  setIsPriceSheetOpen: (open: boolean) => void;
  setSelectedStatus: React.Dispatch<React.SetStateAction<string>>;
  setStatusNote: React.Dispatch<React.SetStateAction<string>>;
  setStatusBuyer: React.Dispatch<React.SetStateAction<VehicleContact>>;
  setStatusFinanciado: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStatusSheetOpen: (open: boolean) => void;
  handleMarcarVisita: (car: Car) => void;
  handleEditarAuto: (car: Car) => void;
  handleEliminarAuto: (car: Car) => void;
}

/* ======================= FICHA DE AUTO ======================= */
export function FichaAuto({
  activeCar,
  setActiveCar,
  modoCliente,
  setModoCliente,
  activeStockAuctionMap,
  activeInforme,
  activeBloqueos,
  setInspectingCar,
  setIsAutosaveReportOpen,
  handleAbrirEnvioInforme,
  handleAbrirTransferencia,
  handleAvanzarTransferencia,
  handleCompartirTransferencia,
  handleLlamar,
  handleWhatsapp,
  setAdjustedPrice,
  setIsPriceSheetOpen,
  setSelectedStatus,
  setStatusNote,
  setStatusBuyer,
  setStatusFinanciado,
  setIsStatusSheetOpen,
  handleMarcarVisita,
  handleEditarAuto,
  handleEliminarAuto,
}: FichaAutoProps) {
  const insets = useSafeAreaInsets();

  /* La ficha dejó de ser una tira con todo desplegado: cada sección arranca
     cerrada y el usuario abre lo que le interesa (David, punto 23). El estado
     se resetea al cambiar de auto. */
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>({});
  const carId = activeCar?.id ?? null;
  useEffect(() => {
    setSeccionesAbiertas({});
  }, [carId]);

  const toggleSeccion = (id: string) =>
    setSeccionesAbiertas((prev) => ({ ...prev, [id]: !prev[id] }));

  return renderCarDetail();

  /* Una sección de la ficha. Sin `contenido`, la tarjeta es solo el encabezado
     y el que llama pinta el cuerpo aparte (lo usa AutoSave, que conserva su
     bloque propio con la barra de marca). */
  function renderSeccion(
    id: string,
    titulo: string,
    resumen: string,
    contenido?: () => React.ReactNode,
  ) {
    const abierta = !!seccionesAbiertas[id];
    return (
      <View style={s.detailTechCard}>
        <TouchableOpacity activeOpacity={0.75} onPress={() => toggleSeccion(id)} style={s.seccionHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.seccionTitulo}>{titulo}</Text>
            {!abierta && resumen ? (
              <Text style={s.seccionResumen} numberOfLines={1}>
                {resumen}
              </Text>
            ) : null}
          </View>
          <Icon name={abierta ? 'chevron-up' : 'chevron-down'} size={12} color={C.slate400} />
        </TouchableOpacity>
        {abierta && contenido ? <View style={{ marginTop: 12 }}>{contenido()}</View> : null}
      </View>
    );
  }

  function renderCarDetail() {
    if (!activeCar) return null;
    const car = activeCar;
    const activeStockAuction = activeStockAuctionMap.get(car.id);
    const precioContado = car.precioPublicacionContado || car.precioVenta;
    const margenNeto = precioContado - costoBase(car);
    const clientesRegistrados = [
      car.comprador,
      car.tenencia === 'Consignado' ? car.consignante : null,
      car.clienteAdquisicion,
    ].filter((c) => hasContactData(c)).length;
    const alertaInforme = activeInforme ? alertaPrincipal(activeInforme) : null;
    return (
      <PageOverlay>
            <View style={[s.overlayHeader, s.fichaOverlayHeader, { paddingTop: insets.top + 16 }]}>
              <TouchableOpacity onPress={() => setActiveCar(null)} style={[s.rowCenter, s.fichaHeaderBack]}>
                <Icon name="chevron-left" size={14} color={C.slate400} />
                <Text style={s.cancelText}> Volver</Text>
              </TouchableOpacity>
              <Text style={s.overlayTitle}>Ficha de Auto</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setModoCliente(!modoCliente)}
                style={[s.fichaHeaderAction, modoCliente && s.fichaHeaderActionOn]}
                accessibilityRole="button"
                accessibilityLabel={modoCliente ? 'Volver a modo gestión' : 'Activar modo cliente'}
              >
                <Icon name={modoCliente ? 'eye-slash' : 'eye'} size={15} color={modoCliente ? C.white : C.slate300} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <PhotoGallery fotos={car.fotos} />

              <View style={{ padding: 16, gap: 16 }}>
                <View style={s.detailHeaderRow}>
                  <View style={s.detailHeaderText}>
                    <Text style={s.detailTitle}>
                      {car.marca} {car.modelo}
                    </Text>
                    <Text style={s.detailSub}>
                      {car.version} • Año {car.anio}
                    </Text>
                  </View>
                  <View style={s.detailHeaderBadges}>
                    <View style={s.detailEstado}>
                      <Text style={{ fontSize: 12, fontWeight: W.extrabold, color: C.teal700 }}>{car.estado}</Text>
                    </View>
                    {activeStockAuction && (
                      <View style={s.detailAuctionBadge}>
                        <Icon name="gavel" size={9} color={C.amber700} />
                        <Text style={s.detailAuctionText}>En subasta</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Precios y margen: cerrada, el resumen igual deja lo esencial
                    a la vista sin ocupar la pantalla entera. En modo cliente la
                    sección solo muestra los precios de publicación. */}
                {modoCliente
                  ? renderSeccion('precios', 'Precios', fmtCLP(precioContado), () => (
                      <View style={s.detailFinanceGrid}>
                        <TechItem label="Contado" value={fmtCLP(precioContado)} />
                        <TechItem
                          label="Financiado"
                          value={car.precioPublicacionFinanciado ? fmtCLP(car.precioPublicacionFinanciado) : '—'}
                        />
                      </View>
                    ))
                  : renderSeccion(
                      'precios',
                      'Precios y Margen',
                      `${fmtCLP(precioContado)} · margen ${margenNeto >= 0 ? '+' : '−'}${fmtCLP(Math.abs(margenNeto))}`,
                      () => (
                        <View style={{ gap: 8 }}>
                          <View style={s.detailMoneyRow}>
                            <Text style={s.detailMiniLabel}>
                              {car.tenencia === 'Consignado' ? 'Piso Consignación' : 'Costo Adquisición'}
                            </Text>
                            <Text style={s.detailMiniValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                              {fmtCLP(costoBase(car))}
                            </Text>
                          </View>
                          <View style={s.detailMoneyRow}>
                            <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 130 }}>
                              <Text style={s.detailMiniLabel}>Publicación Contado</Text>
                              <Text style={s.detailPrecio} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                                {fmtCLP(precioContado)}
                              </Text>
                            </View>
                            <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 120 }}>
                              <Text style={[s.detailMiniLabel, { color: C.emerald600 }]}>Margen Neto</Text>
                              <Text
                                style={[s.detailMargen, margenNeto < 0 && { color: C.red600 }]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.6}
                              >
                                {margenNeto >= 0 ? '+' : '−'}
                                {fmtCLP(Math.abs(margenNeto))}
                              </Text>
                            </View>
                          </View>
                          <View style={s.detailFinanceGrid}>
                            <TechItem label="Financiado" value={car.precioPublicacionFinanciado ? fmtCLP(car.precioPublicacionFinanciado) : '—'} />
                            <TechItem label="Venta Estimada" value={fmtCLP(car.precioVentaEstimado || car.precioVenta)} />
                          </View>
                        </View>
                      ),
                    )}

                {/* Motor de precios sobre ESTE auto (punto 25): antes vivía solo
                    en Inicio, desconectado del auto que estabas mirando. Es
                    asesoría de venta del mayorista, así que en modo cliente no
                    aparece. Mientras Autored no abra la integración real, corre
                    contra el motor simulado de src/pricing.ts. */}
                {!modoCliente &&
                  renderSeccion(
                    'motor',
                    'Motor de Precios',
                    '¿A cuánto conviene vender este auto?',
                    () => (
                      <MotorPreciosPublicacion
                        patente={car.patente}
                        km={car.km}
                        vehiculo={car}
                        emptyText="El expediente no tiene patente o kilometraje: complétalos con Editar y acá aparece el precio sugerido."
                      />
                    ),
                  )}

                {renderSeccion(
                  'clientes',
                  'Clientes del Vehículo',
                  clientesRegistrados > 0
                    ? `${clientesRegistrados} ${clientesRegistrados === 1 ? 'contacto registrado' : 'contactos registrados'}`
                    : 'Sin contactos registrados',
                  () => (
                    /* Punto 27, con lo que hay mientras la reunión no cierre el
                       alcance: David acotaría esto al cliente de la reserva o
                       venta (por eso va primero), Mauro quiere al consignante
                       también (va segundo, solo en autos consignados). El
                       cliente de adquisición queda al final. */
                    <View style={{ gap: 10 }}>
                      {requiresBuyer(car.estado) ? (
                        <VehicleContactCard
                          title={car.estado === 'Reservado' ? 'Comprador / reserva' : 'Comprador final'}
                          contact={car.comprador}
                          emptyText="Registra el comprador para completar este estado."
                          onCall={handleLlamar}
                          onWhatsapp={handleWhatsapp}
                        />
                      ) : null}
                      {car.tenencia === 'Consignado' ? (
                        <VehicleContactCard
                          title="Consignante (dueño del auto)"
                          contact={car.consignante}
                          emptyText="Sin consignante registrado."
                          onCall={handleLlamar}
                          onWhatsapp={handleWhatsapp}
                        />
                      ) : null}
                      <VehicleContactCard
                        title="Cliente de adquisición"
                        contact={car.clienteAdquisicion}
                        emptyText="Sin cliente de adquisición registrado."
                        onCall={handleLlamar}
                        onWhatsapp={handleWhatsapp}
                      />
                    </View>
                  ),
                )}

                {/* Inspección de recepción con IA */}
                {car.inspeccion ? (
                  <TouchableOpacity onPress={() => setInspectingCar(car)} style={s.inspDoneCard} activeOpacity={0.8}>
                    <View style={s.detailHeaderRow}>
                      <View style={[s.rowCenter, { flex: 1, minWidth: 0 }]}>
                        <View style={s.inspDoneIcon}>
                          <Icon name="clipboard-check" size={16} color={C.teal700} />
                        </View>
                        <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
                          <Text style={s.inspTitle}>Inspección de Recepción</Text>
                          <Text style={s.inspSub}>
                            Nota {car.inspeccion.notaCondicion}/10 • Reparaciones est.{' '}
                            {fmtCLP(car.inspeccion.costoTotalEstimadoCLP)}
                          </Text>
                        </View>
                      </View>
                      <Icon name="chevron-right" size={14} color={C.slate400} />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setInspectingCar(car)} style={s.inspCtaCard} activeOpacity={0.8}>
                    <View style={s.rowCenter}>
                      <View style={s.inspCtaIcon}>
                        <Icon name="wand-magic-sparkles" size={16} color={C.white} />
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={s.inspCtaTitle}>Inspección de Recepción con IA</Text>
                        <Text style={s.inspCtaSub}>
                          {car.estado === 'Pre-stock' || car.estado === 'En preparación'
                            ? 'Recomendado: fotografía el auto al recibirlo y la IA detectará daños y generará el informe.'
                            : 'Fotografía el auto y la IA detectará hallazgos y generará el informe PDF.'}
                        </Text>
                      </View>
                      <Icon name="chevron-right" size={14} color={C.teal200} />
                    </View>
                  </TouchableOpacity>
                )}

                {/* AutoSave conserva su bloque propio con la barra de marca: la
                    sección solo aporta el encabezado colapsable. */}
                {activeInforme ? (
                  <>
                    {renderSeccion(
                      'autosave',
                      'AutoSave · Historial y Transferencia',
                      alertaInforme ? alertaInforme.titulo : 'Sin hallazgos',
                    )}
                    {seccionesAbiertas['autosave'] ? renderAutosaveBlock(car) : null}
                  </>
                ) : null}

                {renderSeccion(
                  'identificacion',
                  'Identificación',
                  `${car.sucursal || '—'} · ingreso ${car.fechaIngreso || '—'}`,
                  () => (
                    <View style={s.detailTechGrid}>
                      <TechItem label="VIN" value={car.vin || '—'} />
                      <TechItem label="Tipo" value={car.tipoVehiculo || '—'} />
                      <TechItem label="Sucursal" value={car.sucursal || '—'} />
                      <TechItem label="Fecha Ingreso" value={car.fechaIngreso || '—'} />
                      <TechItem label="Año Modelo" value={car.anio ? String(car.anio) : '—'} />
                      <TechItem label="Año Fabricación" value={car.anioFabricacion ? String(car.anioFabricacion) : '—'} />
                      <TechItem label="Origen" value={car.origen || '—'} />
                      <TechItem
                        label="Días en Stock"
                        value={`${diasEnStock(car)} días`}
                        warn={diasEnStock(car) > 60}
                      />
                    </View>
                  ),
                )}

                {renderSeccion(
                  'detalle',
                  'Detalle del Vehículo',
                  `${fmtMiles(car.km)} km · ${car.color || '—'} · ${car.transmision}`,
                  () => (
                    <View style={s.detailTechGrid}>
                      <TechItem label="Kilometraje" value={`${fmtMiles(car.km)} km`} />
                      <TechItem label="Color" value={car.color} />
                      <TechItem label="Transmisión" value={car.transmision} />
                      <TechItem label="Combustible" value={car.combustible} />
                      <TechItem label="Tracción" value={car.traccion || '—'} />
                      <TechItem label="Cilindrada" value={car.cilindrada ? `${fmtMiles(car.cilindrada)} cc` : '—'} />
                      <TechItem label="Puertas" value={car.puertas || '—'} />
                    </View>
                  ),
                )}

                {renderSeccion(
                  'equipamiento',
                  'Equipamiento',
                  car.equipamiento.length > 0
                    ? `${car.equipamiento.length} ${car.equipamiento.length === 1 ? 'ítem' : 'ítems'}${car.otros ? ' · con observaciones' : ''}`
                    : 'Sin equipamiento registrado',
                  () => (
                    <>
                      {car.equipamiento.length > 0 ? (
                        <View style={s.equipmentList}>
                          {car.equipamiento.map((item) => (
                            <View key={item} style={s.equipmentPill}>
                              <Icon name="check" size={9} color={C.teal700} />
                              <Text style={s.equipmentText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={s.emptySectionText}>Sin equipamiento registrado.</Text>
                      )}
                      {car.otros ? (
                        <View style={s.detailNoteInset}>
                          <Text style={s.detailNoteInsetLabel}>Otros</Text>
                          <Text style={s.detailNoteInsetText}>{car.otros}</Text>
                        </View>
                      ) : null}
                    </>
                  ),
                )}

                {renderSeccion(
                  'documentos',
                  'Documentos',
                  car.documentos.length > 0
                    ? `${car.documentos.length} ${car.documentos.length === 1 ? 'documento' : 'documentos'}`
                    : 'No hay documentos preparados',
                  () =>
                    car.documentos.length > 0 ? (
                      <View style={{ gap: 8 }}>
                        {car.documentos.map((doc) => (
                          <View key={doc.id} style={s.docRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.docTitle}>{doc.nombre || doc.tipo}</Text>
                              <Text style={s.docMeta}>
                                {doc.tipo}
                                {doc.fechaVencimiento ? ` • vence ${doc.fechaVencimiento}` : ''}
                                {doc.archivoNombre ? ` • ${doc.archivoNombre}` : ''}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={s.emptySectionText}>No hay documentos preparados.</Text>
                    ),
                )}

                {renderSeccion(
                  'notas',
                  'Notas de Stock',
                  car.comentario || 'Sin notas u observaciones especiales',
                  () => (
                    <Text style={s.notasText}>{car.comentario || 'Sin notas u observaciones especiales.'}</Text>
                  ),
                )}
              </View>
            </ScrollView>

            {/* Botonera de gestión: en modo cliente no va. "Ajustar Precio"
                abre un sheet que muestra el margen, y el resto es operación
                interna que el cliente no tiene por qué ver. */}
            {modoCliente ? null : (
            <View style={[s.detailFooter, { paddingBottom: (insets.bottom || 8) + 16 }]}>
              <View style={s.detailFooterActions}>
                <TouchableOpacity
                  onPress={() => {
                    setAdjustedPrice(car.precioVenta);
                    setIsPriceSheetOpen(true);
                  }}
                  style={[s.detailActionGray, s.detailFooterAction]}
                >
                  <Icon name="dollar-sign" size={12} color={C.slate700} />
                  <Text style={s.detailActionGrayText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    Ajustar Precio
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedStatus(car.estado);
                    setStatusNote('');
                    setStatusBuyer(car.comprador || emptyContact());
                    setStatusFinanciado(car.financiado ?? false);
                    setIsStatusSheetOpen(true);
                  }}
                  style={[s.detailActionGray, s.detailFooterAction]}
                >
                  <Icon name="rotate" size={12} color={C.slate700} />
                  <Text style={s.detailActionGrayText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    Cambiar Estado
                  </Text>
                </TouchableOpacity>
                {/* El otro dato que P2 necesita desde la ficha: las visitas.
                    Alimentan el orden "Más visitas" de la bandeja. Sin pedir
                    datos: el modelo acepta visitas anónimas. */}
                <TouchableOpacity onPress={() => handleMarcarVisita(car)} style={[s.detailActionGray, s.detailFooterAction]}>
                  <Icon name="person-walking" size={12} color={C.slate700} />
                  <Text style={s.detailActionGrayText} numberOfLines={1}>Visita</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => handleEditarAuto(car)} style={s.detailEditBtn}>
                <Icon name="pen-to-square" size={12} color={C.white} />
                <Text style={s.detailEditText}>Editar Todo el Expediente</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleEliminarAuto(car)} style={s.detailDeleteBtn}>
                <Icon name="trash-can" size={12} color={C.red700} />
                <Text style={s.detailDeleteText}>Eliminar Publicación</Text>
              </TouchableOpacity>
            </View>
            )}
      </PageOverlay>
    );
  }

  /* ======================= AUTOSAVE: BLOQUE EN LA FICHA ======================= */
  // Las dos tarjetas de AutoSave van juntas y comparten la barra cian de marca: es otra
  // empresa del grupo, y se distingue por jerarquía, no metiendo un segundo color.
  function renderAutosaveBlock(car: Car) {
    if (!activeInforme) return null;
    return (
      <View style={s.asBlock}>
        <View style={s.asBrandBar} />
        <View style={{ flex: 1, gap: 12 }}>
          {renderInformeCard(car, activeInforme)}
          {renderTransferCard(car)}
        </View>
      </View>
    );
  }

  function renderInformeCard(car: Car, informe: InformeAutosave) {
    const chips = resumenVeredictos(informe);
    const alerta = alertaPrincipal(informe);
    const envios = car.informesEnviados || [];
    const ultimoEnvio = envios[envios.length - 1];
    const alertaColor = veredictoColor(alerta ? alerta.veredicto : 'ok');

    return (
      <View style={s.detailTechCard}>
        <View style={s.asCardHead}>
          <Text style={s.asBrandLabel}>AutoSave · Informe</Text>
          <Text style={s.asFolio}>{informe.folio}</Text>
        </View>

        <View style={s.asVerdictStrip}>
          {chips.map((chip) => {
            const col = veredictoColor(chip.veredicto);
            return (
              <View key={chip.clave} style={s.asVerdictCell}>
                <View style={[s.asVerdictBar, { backgroundColor: col.color }]} />
                <Text style={s.asVerdictLabel} numberOfLines={1}>
                  {chip.label}
                </Text>
                <Icon name={chip.icono as any} size={13} color={col.color} />
                <Text style={[s.asVerdictValue, { color: col.text }]} numberOfLines={2}>
                  {chip.valor}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[s.asAlertStrip, { backgroundColor: alertaColor.bg, borderLeftColor: alertaColor.color }]}>
          <Text style={[s.asAlertTitle, { color: alertaColor.text }]}>{alerta ? alerta.titulo : 'Sin hallazgos'}</Text>
          <Text style={s.asAlertText}>{alerta ? alerta.detalle : informe.resumen}</Text>
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={() => setIsAutosaveReportOpen(true)} style={s.asLinkRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.asLinkText}>Ver informe completo</Text>
            <Text style={s.asMetaText}>
              Consultado el {fmtFecha(informe.fechaConsulta)} · {totalAntecedentes(informe)}{' '}
              {totalAntecedentes(informe) === 1 ? 'antecedente' : 'antecedentes'}
            </Text>
          </View>
          <Icon name="chevron-right" size={12} color={C.slate400} />
        </TouchableOpacity>

        <View style={s.asClientBlock}>
          <Text style={s.asClientTitle}>Para tu cliente</Text>
          <Text style={s.asClientHint}>
            Copia certificada con folio, válida 30 días. Se la puedes enviar al comprador o al vendedor del auto.
          </Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => handleAbrirEnvioInforme(car)} style={s.asCtaDark}>
            <Text style={s.asCtaDarkText}>Enviar informe al cliente</Text>
            <Text style={s.asCtaPrice}>{fmtCLP(PRECIO_COPIA_INFORME)}</Text>
          </TouchableOpacity>
          {ultimoEnvio ? (
            <Text style={s.asMetaText}>
              Enviado a {ultimoEnvio.nombre} ({ultimoEnvio.destinatario.toLowerCase()}) el {fmtFecha(ultimoEnvio.fecha)}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  function renderTransferCard(car: Car) {
    if (car.transferencia) return renderTransferTracker(car, car.transferencia);
    if (!activeInforme) return null;

    const vendido = car.estado === 'Vendido';
    const bloqueado = activeBloqueos.length > 0;
    const habilitado = vendido && !bloqueado;
    const cotizacion = cotizarTransferencia({
      precioOperacion: car.precioVenta,
      tasacionFiscal: activeInforme.tasacionFiscal,
      modalidad: 'Digital',
      copiaInformeYaPagada: false,
    });

    return (
      <View style={s.detailTechCard}>
        <View style={s.asCardHead}>
          <Text style={s.asBrandLabel}>AutoSave · Transferencia</Text>
        </View>

        {!vendido ? (
          <Text style={[s.asMetaText, { marginTop: 0, marginBottom: 12 }]}>
            Se habilita al marcar el auto como Vendido.
          </Text>
        ) : null}

        <Text style={s.asClientTitle}>Qué le ofreces al cliente</Text>
        <View style={{ gap: 6, marginTop: 8 }}>
          {PITCH_TRANSFERENCIA.map((item) => (
            <View key={item} style={s.asPitchRow}>
              <Icon name="check" size={9} color={C.teal700} />
              <Text style={s.asPitchText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={s.asQuoteRow}>
          <TechItem label="Costo estimado" value={`desde ${fmtCLP(cotizacion.total)}`} />
          <TechItem label="Plazo" value={`${cotizacion.plazoTexto} (digital)`} />
        </View>

        {bloqueado ? (
          <View style={[s.asAlertStrip, { backgroundColor: C.red50, borderLeftColor: C.red600, marginTop: 12 }]}>
            <Text style={[s.asAlertTitle, { color: C.red700 }]}>No se puede inscribir todavía</Text>
            {activeBloqueos.map((b) => (
              <Text key={b} style={s.asAlertText}>
                · {b}
              </Text>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!habilitado}
          onPress={() => handleAbrirTransferencia(car)}
          style={[s.asCtaDark, { marginTop: 12 }, !habilitado && s.asCtaDisabled]}
        >
          <Text style={[s.asCtaDarkText, !habilitado && { color: C.slate400 }]}>
            {bloqueado ? 'Bloqueada por el informe' : vendido ? 'Iniciar transferencia notarial' : 'Disponible al vender'}
          </Text>
          {habilitado ? <Icon name="arrow-right" size={12} color={C.white} /> : null}
        </TouchableOpacity>
      </View>
    );
  }

  function renderTransferTracker(car: Car, t: NonNullable<Car['transferencia']>) {
    const { paso, total } = progresoTransferencia(t);
    const idxActual = t.hitos.findIndex((h) => h.estado === t.estado);
    // Una vez inscrita el trámite terminó: el último hito va como completado, no "en curso".
    const finalizado = t.estado === 'Inscrita';

    return (
      <View style={s.detailTechCard}>
        <View style={s.asCardHead}>
          <Text style={s.asBrandLabel}>AutoSave · Transferencia</Text>
          <Text style={s.asFolio}>{t.folio}</Text>
        </View>

        <View style={{ marginTop: 4 }}>
          {t.hitos.map((hito, i) => {
            const completado = i < idxActual || (finalizado && i === idxActual);
            const actual = i === idxActual && !finalizado;
            const ultimo = i === t.hitos.length - 1;
            return (
              <View key={hito.estado} style={s.asTimelineItem}>
                <View style={s.asTimelineGutter}>
                  <View
                    style={[
                      s.asTimelineNode,
                      completado && s.asTimelineNodeDone,
                      actual && s.asTimelineNodeActive,
                    ]}
                  >
                    {actual ? <Ping color={C.teal400} size={6} /> : null}
                  </View>
                  {!ultimo ? <View style={[s.asTimelineLine, completado && { backgroundColor: C.slate800 }]} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: ultimo ? 0 : 14 }}>
                  <View style={s.detailMoneyRow}>
                    <Text
                      style={[s.asTimelineLabel, (completado || actual) && { color: C.slate800 }]}
                      numberOfLines={2}
                    >
                      {hito.estado}
                    </Text>
                    <Text style={s.asTimelineDate}>
                      {actual ? 'En curso' : hito.fecha ? fmtFecha(hito.fecha) : 'Pendiente'}
                    </Text>
                  </View>
                  {actual ? <Text style={s.asTimelineDetail}>{hito.detalle}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={s.asTransferMeta}>
          <TransferMetaRow
            label="Traspaso"
            value={
              t.origen === 'Directo'
                ? `Directo · ${t.vendedor.nombre} → ${t.comprador.nombre}`
                : `Automotora → ${t.comprador.nombre}`
            }
          />
          <TransferMetaRow label="Notaría" value={t.notaria} />
          <TransferMetaRow label="Modalidad" value={t.modalidad} />
          <TransferMetaRow label="Entrega estimada" value={fmtFecha(t.fechaEstimadaEntrega)} />
          <TransferMetaRow label="Total" value={`${fmtCLP(t.total)} · paga ${t.responsablePago.toLowerCase()}`} strong />
        </View>

        <View style={[s.detailFooterActions, { marginTop: 12 }]}>
          <TouchableOpacity onPress={() => handleCompartirTransferencia(car)} style={s.detailActionGray}>
            <Icon name="comment-dots" size={12} color={C.slate700} />
            <Text style={s.detailActionGrayText} numberOfLines={1}>Compartir</Text>
          </TouchableOpacity>
          {!finalizado ? (
            <TouchableOpacity
              onPress={() => handleAvanzarTransferencia(car)}
              style={[s.detailActionGray, { backgroundColor: C.chileanNavy }]}
            >
              <Icon name="rotate" size={12} color={C.white} />
              <Text style={[s.detailActionGrayText, { color: C.white }]}>Actualizar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={[s.asMetaText, { marginTop: 8, textAlign: 'center' }]}>
          {finalizado ? `Transferencia inscrita · padrón a nombre de ${t.comprador.nombre}` : `Paso ${paso} de ${total}`}
        </Text>
      </View>
    );
  }
}

interface PriceSheetProps {
  activeCar: Car | null;
  isPriceSheetOpen: boolean;
  setIsPriceSheetOpen: (open: boolean) => void;
  adjustedPrice: number;
  setAdjustedPrice: React.Dispatch<React.SetStateAction<number>>;
  handleGuardarPrecio: () => void;
}

/* ======================= SHEET: AJUSTAR PRECIO ======================= */
export function PriceSheet({
  activeCar,
  isPriceSheetOpen,
  setIsPriceSheetOpen,
  adjustedPrice,
  setAdjustedPrice,
  handleGuardarPrecio,
}: PriceSheetProps) {
  const insets = useSafeAreaInsets();
  if (!activeCar) return null;
  return (
    <Sheet visible={isPriceSheetOpen && !!activeCar} onClose={() => setIsPriceSheetOpen(false)}>
      <View style={{ padding: 16, gap: 16, paddingBottom: (insets.bottom || 0) + 16 }}>
        <View style={s.rowBetween}>
          <View>
            <Text style={s.sheetTitleSm}>Ajustar Precio de Venta</Text>
            <Text style={s.subMuted}>
              {activeCar.marca} {activeCar.modelo}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setIsPriceSheetOpen(false)}>
            <Icon name="circle-xmark" size={18} color={C.slate400} />
          </TouchableOpacity>
        </View>

        <View style={s.bigValueBox}>
          <Text style={s.bigValueLabel}>Nuevo Precio</Text>
          <Text style={s.bigValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {fmtCLP(adjustedPrice)}
          </Text>
        </View>

        <View style={s.stepperRow}>
          <TouchableOpacity
            onPress={() => setAdjustedPrice(Math.max(adjustedPrice - 100000, costoBase(activeCar)))}
            style={s.stepperBtn}
          >
            <Icon name="minus" size={18} color={C.slate800} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.bigValueLabel, { color: C.emerald600 }]}>Nuevo Margen Estimado</Text>
            <Text style={s.stepperMargen} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {/* Contra costoBase, nunca costoAdquisicion: en un consignado la
                  resta a mano devolvía el precio completo como utilidad y
                  dejaba bajar el precio hasta cero. */}
              +{fmtCLP(adjustedPrice - costoBase(activeCar))}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setAdjustedPrice(adjustedPrice + 100000)} style={s.stepperBtn}>
            <Icon name="plus" size={18} color={C.slate800} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleGuardarPrecio} style={s.sheetPrimaryBtn}>
          <Text style={s.sheetPrimaryText}>Guardar Precio de Venta</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

interface StatusSheetProps {
  activeCar: Car | null;
  isStatusSheetOpen: boolean;
  setIsStatusSheetOpen: (open: boolean) => void;
  selectedStatus: string;
  setSelectedStatus: React.Dispatch<React.SetStateAction<string>>;
  statusNote: string;
  setStatusNote: React.Dispatch<React.SetStateAction<string>>;
  statusBuyer: VehicleContact;
  setStatusBuyer: React.Dispatch<React.SetStateAction<VehicleContact>>;
  statusFinanciado: boolean;
  setStatusFinanciado: React.Dispatch<React.SetStateAction<boolean>>;
  handleGuardarEstado: () => void;
}

/* ======================= SHEET: CAMBIAR ESTADO ======================= */
export function StatusSheet({
  activeCar,
  isStatusSheetOpen,
  setIsStatusSheetOpen,
  selectedStatus,
  setSelectedStatus,
  statusNote,
  setStatusNote,
  statusBuyer,
  setStatusBuyer,
  statusFinanciado,
  setStatusFinanciado,
  handleGuardarEstado,
}: StatusSheetProps) {
  const insets = useSafeAreaInsets();
  if (!activeCar) return null;
  return (
    <Sheet visible={isStatusSheetOpen && !!activeCar} onClose={() => setIsStatusSheetOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ padding: 16, gap: 16, paddingBottom: (insets.bottom || 0) + 16 }}>
          <View style={s.rowBetween}>
            <View>
              <Text style={s.sheetTitleSm}>Cambiar Estado de Operación</Text>
              <Text style={s.subMuted}>
                {activeCar.marca} {activeCar.modelo}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsStatusSheetOpen(false)}>
              <Icon name="circle-xmark" size={18} color={C.slate400} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 12 }}>
            <Text style={s.sheetFieldLabel}>Seleccionar Estado</Text>
            <View style={s.statusGrid}>
              {ESTADOS.map((est) => {
                const isSelected = selectedStatus === est;
                return (
                  <TouchableOpacity
                    key={est}
                    onPress={() => setSelectedStatus(est)}
                    style={[s.statusBtn, isSelected ? s.statusBtnActive : s.statusBtnInactive]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: W.bold, color: isSelected ? C.white : C.slate700 }}>{est}</Text>
                    {isSelected && <Icon name="circle-check" size={13} color={C.teal400} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {requiresBuyer(selectedStatus as EstadoAuto) ? (
              <View style={s.inlinePanel}>
                <Text style={s.inlinePanelTitle}>Comprador</Text>
                <Text style={s.inlinePanelHint}>Este contacto se registrará automáticamente como cliente de venta.</Text>
                <View style={{ gap: 10, marginTop: 12 }}>
                  <Field
                    label="Nombre"
                    placeholder="Ej: María González"
                    value={statusBuyer.nombre}
                    onChange={(nombre) => setStatusBuyer({ ...statusBuyer, nombre })}
                  />
                  <Field
                    label="Teléfono"
                    placeholder="Ej: +56 9 1234 5678"
                    keyboardType="phone-pad"
                    value={statusBuyer.telefono}
                    onChange={(telefono) => setStatusBuyer({ ...statusBuyer, telefono })}
                  />
                  <View>
                    <Text style={s.sheetFieldLabel}>Notas del cliente</Text>
                    <TextInput
                      placeholder="Ej: forma de pago, horarios, objeciones o acuerdos"
                      placeholderTextColor={C.slate400}
                      value={statusBuyer.notas || ''}
                      onChangeText={(notas) => setStatusBuyer({ ...statusBuyer, notas })}
                      multiline
                      style={[s.textArea, { minHeight: 72 }]}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {/* Solo al vender: sin esto la penetración de financiamiento de
                los KPIs del mes no tiene de dónde salir. */}
            {selectedStatus === 'Vendido' ? (
              <View>
                <Text style={s.sheetFieldLabel}>¿Cómo se pagó?</Text>
                <View style={s.segment}>
                  <SegBtn label="Contado" active={!statusFinanciado} onPress={() => setStatusFinanciado(false)} />
                  <SegBtn label="Financiado" active={statusFinanciado} onPress={() => setStatusFinanciado(true)} />
                </View>
              </View>
            ) : null}

            <View>
              <Text style={s.sheetFieldLabel}>Nota Opcional</Text>
              <TextInput
                placeholder="Ej: Se inicia proceso de detallado estético..."
                placeholderTextColor={C.slate400}
                value={statusNote}
                onChangeText={setStatusNote}
                multiline
                numberOfLines={2}
                style={s.textArea}
              />
            </View>
          </View>

          <TouchableOpacity onPress={handleGuardarEstado} style={s.sheetPrimaryBtn}>
            <Text style={s.sheetPrimaryText}>Cambiar Estado</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Sheet>
  );
}
