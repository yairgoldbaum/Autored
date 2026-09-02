import React, { useEffect, useState } from 'react';
import {
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
  PRECIO_COPIA_INFORME,
  alertaPrincipal,
  fmtFecha,
  resumenVeredictos,
} from '../src/autosave';
import { hasContactData, requiresBuyer, totalAntecedentes, veredictoColor } from '../src/helpers';
import {
  Field,
  MotorPreciosPublicacion,
  PhotoGallery,
  SegBtn,
  TechItem,
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
  setIsAutosaveReportOpen: (open: boolean) => void;
  handleAbrirEnvioInforme: (car: Car) => void;
  /* El acceso directo del punto 7: cierra la ficha y abre el módulo de
     Transferencias. No lleva la patente puesta, porque la pantalla de crear
     corta al elegir el tipo. */
  handleIrATransferencias: () => void;
  handleLlamar: (telefono: string) => void;
  handleWhatsapp: (telefono: string) => void;
  setAdjustedPrice: React.Dispatch<React.SetStateAction<number>>;
  setIsPriceSheetOpen: (open: boolean) => void;
  handleAbrirEstado: (car: Car) => void;
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
  setIsAutosaveReportOpen,
  handleAbrirEnvioInforme,
  handleIrATransferencias,
  handleLlamar,
  handleWhatsapp,
  setAdjustedPrice,
  setIsPriceSheetOpen,
  handleAbrirEstado,
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
     y el que llama pinta el cuerpo aparte (lo usa AutoSafe, que conserva su
     bloque propio con la barra de marca). */
  function renderSeccion(
    id: string,
    titulo: string,
    resumen: string,
    contenido?: () => React.ReactNode,
  ) {
    // En modo cliente no hay nada que plegar: se le muestra el auto al cliente,
    // no se navega. Las secciones que sobreviven van abiertas y sin chevron.
    const abierta = modoCliente || !!seccionesAbiertas[id];
    return (
      <View style={s.detailTechCard}>
        <TouchableOpacity
          activeOpacity={modoCliente ? 1 : 0.75}
          disabled={modoCliente}
          onPress={() => toggleSeccion(id)}
          style={s.seccionHead}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.seccionTitulo}>{titulo}</Text>
            {!abierta && resumen ? (
              <Text style={s.seccionResumen} numberOfLines={1}>
                {resumen}
              </Text>
            ) : null}
          </View>
          {modoCliente ? null : (
            <Icon name={abierta ? 'chevron-up' : 'chevron-down'} size={12} color={C.slate400} />
          )}
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
            <View style={[s.overlayHeader, { paddingTop: insets.top + 16 }]}>
              <TouchableOpacity onPress={() => setActiveCar(null)} style={s.rowCenter}>
                <Icon name="chevron-left" size={14} color={C.slate400} />
                <Text style={s.cancelText}> Volver</Text>
              </TouchableOpacity>
              <Text style={s.overlayTitle}>Ficha del Auto</Text>
              <View style={s.rowCenter}>
                {/* Modo cliente (punto 24): el mayorista le muestra el auto al
                    cliente desde su propio teléfono. Es un interruptor de
                    presentación, no una sección, así que vive en la cabecera
                    como un ojo y no ocupa una tarjeta entera de la ficha. */}
                <TouchableOpacity
                  onPress={() => setModoCliente(!modoCliente)}
                  hitSlop={10}
                  style={[s.ojoModoCliente, modoCliente && s.ojoModoClienteOn]}
                >
                  <Icon
                    name={modoCliente ? 'eye-slash' : 'eye'}
                    size={14}
                    color={modoCliente ? C.white : C.slate400}
                  />
                </TouchableOpacity>
                <View style={[s.stepPill, { marginLeft: 8 }]}>
                  <Text style={s.stepPillText}>{car.patente}</Text>
                </View>
              </View>
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
                  {modoCliente ? null : (
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
                  )}
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

                {!modoCliente &&
                  renderSeccion(
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

                {/* Acá vivía la tarjeta de Inspección de Recepción con IA. Salió el
                    1-09 (ronda 3, punto 3): David pidió sacarla porque el auto ya
                    está comprado cuando entra a esta app. El módulo sigue en
                    `src/inspection/`, desconectado. */}

                {/* Acceso directo a Transferencias (punto 7). David: "en la ficha de
                    tu auto, cuando hay un auto que ya está vendido, tenéis que tener
                    un botón que diga transferir". Andrés: "sí, como un acceso
                    directo". No lleva la patente puesta: la pantalla de crear corta
                    al elegir el tipo, así que no hay dónde ponerla todavía. */}
                {!modoCliente && car.estado === 'Vendido' ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleIrATransferencias}
                    style={s.transferirCard}
                    accessibilityRole="button"
                    accessibilityLabel="Transferir este vehículo"
                  >
                    <View style={s.transferirIcono}>
                      <Icon name="right-left" size={15} color={C.white} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.transferirTitulo}>Transferir este vehículo</Text>
                      <Text style={s.transferirSub}>Te lleva a Transferencias para crear la solicitud</Text>
                    </View>
                    <Icon name="chevron-right" size={14} color={C.slate400} />
                  </TouchableOpacity>
                ) : null}

                {/* AutoSafe conserva su bloque propio con la barra de marca: la
                    sección solo aporta el encabezado colapsable. */}
                {!modoCliente && activeInforme ? (
                  <>
                    {renderSeccion(
                      'autosave',
                      'AutoSafe · Historial del vehículo',
                      alertaInforme ? alertaInforme.titulo : 'Sin hallazgos',
                    )}
                    {seccionesAbiertas['autosave'] ? renderAutosaveBlock(car) : null}
                  </>
                ) : null}

                {!modoCliente &&
                  renderSeccion(
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

                {!modoCliente &&
                  renderSeccion(
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

                {!modoCliente &&
                  renderSeccion(
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
                  onPress={() => handleAbrirEstado(car)}
                  style={[s.detailActionGray, s.detailFooterAction]}
                >
                  <Icon name="rotate" size={12} color={C.slate700} />
                  <Text style={s.detailActionGrayText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    Cambiar Estado
                  </Text>
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
  // Conserva la barra cian de marca: es otra empresa del grupo, y se distingue por
  // jerarquía, no metiendo un segundo color. Desde el 1-09 la única tarjeta es la
  // del informe: la de transferencia salió con el punto 7 de la ronda 3.
  function renderAutosaveBlock(car: Car) {
    if (!activeInforme) return null;
    return (
      <View style={s.asBlock}>
        <View style={s.asBrandBar} />
        <View style={{ flex: 1, gap: 12 }}>{renderInformeCard(car, activeInforme)}</View>
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
          <Text style={s.asBrandLabel}>AutoSafe · Informe</Text>
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

  /* Acá vivían renderTransferCard y renderTransferTracker: la cotización del
     trámite notarial, el seguimiento por hitos hasta el nuevo padrón y los
     bloqueos por informe. Salieron el 1-09 (ronda 3, punto 7). David recortó el
     alcance él mismo: "no creo que sea exigente que ustedes armen todo el módulo
     de transferencia en la app, porque tenemos un equipo detrás que ya tiene todo
     ese know-how". En su lugar quedó el acceso directo al módulo, arriba en la
     ficha, para el auto vendido. Ver src/autosave.ts y screens/InformeAutosave.tsx.
     El sheet notarial sigue en el repo, desconectado. */
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
  statusConsignante: VehicleContact;
  setStatusConsignante: React.Dispatch<React.SetStateAction<VehicleContact>>;
  statusPiso: string;
  setStatusPiso: React.Dispatch<React.SetStateAction<string>>;
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
  statusConsignante,
  setStatusConsignante,
  statusPiso,
  setStatusPiso,
  statusFinanciado,
  setStatusFinanciado,
  handleGuardarEstado,
}: StatusSheetProps) {
  const insets = useSafeAreaInsets();
  if (!activeCar) return null;
  return (
    <Sheet visible={isStatusSheetOpen && !!activeCar} onClose={() => setIsStatusSheetOpen(false)}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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

            {/* Consignación: el auto no es tuyo, así que hace falta el dueño y el
                precio piso que se pactó con él. Ese piso reemplaza al costo de
                adquisición para calcular el margen (costoBase), y por eso el
                auto queda marcado como consignado aunque después pase a En venta
                o Vendido. */}
            {selectedStatus === 'Consignado' ? (
              <View style={s.inlinePanel}>
                <Text style={s.inlinePanelTitle}>Dueño del auto</Text>
                <Text style={s.inlinePanelHint}>
                  El auto queda en consignación: no se compró, se vende por cuenta del dueño.
                </Text>
                <View style={{ gap: 10, marginTop: 12 }}>
                  <Field
                    label="Nombre"
                    placeholder="Ej: Juan Pérez"
                    value={statusConsignante.nombre}
                    onChange={(nombre) => setStatusConsignante({ ...statusConsignante, nombre })}
                  />
                  <Field
                    label="Teléfono"
                    placeholder="Ej: +56 9 1234 5678"
                    keyboardType="phone-pad"
                    value={statusConsignante.telefono}
                    onChange={(telefono) => setStatusConsignante({ ...statusConsignante, telefono })}
                  />
                  <View>
                    <Text style={s.sheetFieldLabel}>Precio piso pactado (CLP)</Text>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="Ej: 5900000"
                      placeholderTextColor={C.slate400}
                      value={statusPiso}
                      onChangeText={(v) => setStatusPiso(v.replace(/\D/g, ''))}
                      style={s.moneyInput}
                    />
                    <Text style={s.inlinePanelHint}>Lo que se le entrega al dueño. El margen se mide contra esto.</Text>
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
      </ScrollView>
    </Sheet>
  );
}
