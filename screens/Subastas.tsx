import React from 'react';
import {
  Image,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, W, fmtCLP, fmtMiles } from '../src/theme';
import { Dropdown, Icon, PageOverlay, Pulse, Sheet, Spinner } from '../src/ui';
import { s } from '../src/styles';
import { Auction, Car } from '../src/data';
import {
  SubastaTabKey,
  formatAuctionRemaining,
  getAuctionFeatures,
  getAuctionImageUrl,
  getAuctionMsLeft,
  getAuctionProgressPct,
  getAuctionStatusCopy,
  isAuctionFinal,
  suggestSealedBid,
} from '../src/helpers';
import { PhotoGallery, TechItem } from '../components/shared';

interface SubastasScreenProps {
  auctions: Auction[];
  nowTs: number;
  subastaTab: SubastaTabKey;
  setSubastaTab: React.Dispatch<React.SetStateAction<SubastaTabKey>>;
  stockById: Map<number, Car>;
  setActiveCar: (car: Car | null) => void;
  setActiveAuction: (auction: Auction | null) => void;
  setBidAmount: React.Dispatch<React.SetStateAction<number>>;
  setIsAuctionBidSheetOpen: (open: boolean) => void;
  handleAbrirPublicarSubasta: () => void;
  handleAbrirCaracteristicasSubasta: (auction: Auction) => void;
  handleCancelarSubastaPropia: (auction: Auction) => void;
  handleAgregarDesdeSubasta: (auction: Auction) => void;
}

/* ======================= PANTALLA SUBASTAS ======================= */
export function SubastasScreen({
  auctions,
  nowTs,
  subastaTab,
  setSubastaTab,
  stockById,
  setActiveCar,
  setActiveAuction,
  setBidAmount,
  setIsAuctionBidSheetOpen,
  handleAbrirPublicarSubasta,
  handleAbrirCaracteristicasSubasta,
  handleCancelarSubastaPropia,
  handleAgregarDesdeSubasta,
}: SubastasScreenProps) {
  const lista = auctions.filter((a) => {
    const active = !isAuctionFinal(a) && getAuctionMsLeft(a, nowTs) > 0;
    if (subastaTab === 'disponibles') return active && a.sellerType === 'externo' && !a.miOferta;
    if (subastaTab === 'ofertas') return active && a.sellerType === 'externo' && !!a.miOferta;
    if (subastaTab === 'mis_subastas') return active && a.sellerType === 'propio';
    if (subastaTab === 'finalizadas') return !active || isAuctionFinal(a);
    return false;
  });
  const counts = {
    disponibles: auctions.filter((a) => !isAuctionFinal(a) && getAuctionMsLeft(a, nowTs) > 0 && a.sellerType === 'externo' && !a.miOferta).length,
    ofertas: auctions.filter((a) => !isAuctionFinal(a) && getAuctionMsLeft(a, nowTs) > 0 && a.sellerType === 'externo' && !!a.miOferta).length,
    misSubastas: auctions.filter((a) => !isAuctionFinal(a) && getAuctionMsLeft(a, nowTs) > 0 && a.sellerType === 'propio').length,
    finalizadas: auctions.filter((a) => isAuctionFinal(a) || getAuctionMsLeft(a, nowTs) <= 0).length,
  };
  return (
    <View style={{ gap: 16 }}>
      <View style={s.screenHead}>
        <View style={s.screenHeadText}>
          <Text style={s.h2Black}>Mesa de Subastas</Text>
          <Text style={s.subMuted}>Compra y vende stock en subastas selladas de 4 horas</Text>
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={handleAbrirPublicarSubasta} style={[s.publishAuctionBtn, s.screenHeadAction]}>
          <Icon name="plus" size={12} color={C.white} />
          <Text style={s.publishAuctionText} numberOfLines={1}>Subastar</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-tabs */}
      <View style={s.chipWrap}>
        {(
          [
            { key: 'disponibles', label: 'Disponibles', count: counts.disponibles },
            { key: 'ofertas', label: 'Ofertas', count: counts.ofertas },
            { key: 'mis_subastas', label: 'Mis subastas', count: counts.misSubastas },
            { key: 'finalizadas', label: 'Finalizadas', count: counts.finalizadas },
          ] as { key: SubastaTabKey; label: string; count: number }[]
        ).map((tab) => {
          const isSelected = subastaTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.8}
              onPress={() => setSubastaTab(tab.key)}
              style={[s.chip, isSelected ? s.chipActive : s.chipInactive]}
            >
              <Text style={[s.chipText, { color: isSelected ? C.white : C.slate600 }]}>{tab.label}</Text>
              <View style={[s.chipCount, { backgroundColor: isSelected ? C.chileanTeal : C.slate100 }]}>
                <Text style={{ fontSize: 10, color: isSelected ? C.white : C.slate500, fontWeight: W.bold }}>{tab.count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ gap: 12 }}>
        {lista.map((auc) => {
          const msLeft = getAuctionMsLeft(auc, nowTs);
          const active = !isAuctionFinal(auc) && msLeft > 0;
          const sealedCount = auc.sellerType === 'propio' ? auc.receivedOffers?.length || 0 : undefined;
          const status = getAuctionStatusCopy(auc, active);
          const stockCar = auc.stockId ? stockById.get(auc.stockId) : null;
          const auctionImageUrl = getAuctionImageUrl(auc, stockCar);
          return (
            <View key={auc.id} style={s.aucCard}>
              <View style={s.auctionTopRow}>
                <View style={s.auctionLead}>
                  <Image source={{ uri: auctionImageUrl }} style={s.auctionThumb} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.aucBadgeRow}>
                      <View style={s.origenPill}>
                        <Text style={s.origenText}>{auc.origen}</Text>
                      </View>
                      <View style={[s.auctionStatusPill, { backgroundColor: status.bg }]}>
                        <Text style={[s.auctionStatusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>
                    {stockCar ? (
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => setActiveCar(stockCar)}
                        style={s.auctionTitleTap}
                      >
                        <Text style={[s.aucTitle, { color: C.chileanTeal }]} numberOfLines={2}>
                          {auc.marca} {auc.modelo}
                        </Text>
                        <Icon name="arrow-up-right-from-square" size={9} color={C.chileanTeal} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => handleAbrirCaracteristicasSubasta(auc)}
                        style={s.auctionTitleTap}
                      >
                        <Text style={[s.aucTitle, { color: C.chileanTeal }]} numberOfLines={2}>
                          {auc.marca} {auc.modelo}
                        </Text>
                        <Icon name="circle-info" size={10} color={C.chileanTeal} />
                      </TouchableOpacity>
                    )}
                    <Text style={s.aucSub} numberOfLines={2}>
                      {auc.anio} • {auc.version}
                    </Text>
                    {stockCar ? <Text style={s.aucStockLink}>Desde stock: {stockCar.estado}</Text> : null}
                    {!stockCar && (
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => handleAbrirCaracteristicasSubasta(auc)}
                        style={s.auctionFeatureHint}
                      >
                        <Icon name="list-check" size={9} color={C.chileanTeal} />
                        <Text style={s.auctionFeatureHintText}>Características</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={s.auctionSideMeta}>
                  <Text style={s.aucId}>ID: #{auc.id}</Text>
                  <View style={[s.timePill, !active && s.timePillDone]}>
                    <Icon name="clock" size={9} color={active ? C.amber700 : C.slate500} />
                    <Text style={[s.timePillText, !active && { color: C.slate500 }]}>
                      {active ? formatAuctionRemaining(msLeft) : 'Finalizada'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={s.auctionNoteBox}>
                <Text style={s.auctionNoteLabel}>Nota del vendedor</Text>
                <Text style={s.auctionNoteText}>{auc.sellerNote}</Text>
              </View>

              <View style={s.aucSpecs}>
                <View style={{ flex: 1 }}>
                  <Text style={s.aucSpecLabel}>Patente</Text>
                  <Text style={s.aucSpecValue} numberOfLines={2}>{auc.patente || 'Por asignar'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.aucSpecLabel}>Kilometraje</Text>
                  <Text style={s.aucSpecValue} numberOfLines={2}>{fmtMiles(auc.km)} km</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.aucSpecLabel}>Transmisión</Text>
                  <Text style={s.aucSpecValue} numberOfLines={2}>{auc.transmision}</Text>
                </View>
              </View>

              <View style={s.auctionProgressTrack}>
                <View style={[s.auctionProgressFill, { width: `${getAuctionProgressPct(auc, nowTs)}%` }]} />
              </View>

              <View style={s.aucFooterRow}>
                <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 150 }}>
                  {auc.estado === 'Cancelada' ? (
                    <>
                      <Text style={s.aucMoneyLabel}>Estado</Text>
                      <Text style={[s.aucMoney, { color: C.red700 }]}>Subasta cancelada</Text>
                    </>
                  ) : auc.sellerType === 'propio' && active ? (
                    <>
                      <Text style={s.aucMoneyLabel}>Ofertas recibidas</Text>
                      <Text style={s.aucMoney}>{sealedCount} selladas</Text>
                    </>
                  ) : auc.estado === 'Adjudicada' ? (
                    <>
                      <Text style={s.aucMoneyLabel}>Tu oferta ganadora</Text>
                      <Text style={[s.aucMoney, { color: C.teal600 }]}>{fmtCLP(auc.miOferta || auc.costoFinal)}</Text>
                    </>
                  ) : auc.estado === 'Vendida' ? (
                    <>
                      <Text style={s.aucMoneyLabel}>Mejor oferta recibida</Text>
                      <Text style={[s.aucMoney, { color: C.teal600 }]}>{fmtCLP(auc.winningBid || auc.costoFinal)}</Text>
                    </>
                  ) : auc.miOferta ? (
                    <>
                      <Text style={s.aucMoneyLabel}>Mi oferta sellada</Text>
                      <Text style={s.aucMoney}>{fmtCLP(auc.miOferta)}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={s.aucMoneyLabel}>Modalidad</Text>
                      <Text style={s.aucMoney}>Sobre cerrado</Text>
                    </>
                  )}
                </View>

                {auc.estado === 'Disponible' && active && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      setActiveAuction(auc);
                      setBidAmount(suggestSealedBid(auc));
                      setIsAuctionBidSheetOpen(true);
                    }}
                    style={s.ofertarBtn}
                  >
                    <Text style={s.ofertarBtnText}>Ofertar</Text>
                  </TouchableOpacity>
                )}

                {auc.estado === 'Mis Ofertas' && active && (
                  <View style={s.pendingPill}>
                    <Spinner size={11} color={C.amber600} />
                    <Text style={s.pendingText}>Pendiente</Text>
                  </View>
                )}

                {auc.estado === 'Mi Subasta' && active && (
                  <View style={s.aucFooterActions}>
                    <View style={s.pendingPill}>
                      <Icon name="lock" size={10} color={C.amber600} />
                      <Text style={s.pendingText}>Sellada</Text>
                    </View>
                    {stockCar && (
                      <TouchableOpacity activeOpacity={0.85} onPress={() => setActiveCar(stockCar)} style={s.viewStockBtn}>
                        <Icon name="circle-info" size={10} color={C.chileanTeal} />
                        <Text style={s.viewStockText}>Ver ficha</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity activeOpacity={0.85} onPress={() => handleCancelarSubastaPropia(auc)} style={s.cancelAuctionBtn}>
                      <Icon name="ban" size={10} color={C.red700} />
                      <Text style={s.cancelAuctionText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {auc.estado === 'Adjudicada' && (
                  <Pulse>
                    <TouchableOpacity activeOpacity={0.85} onPress={() => handleAgregarDesdeSubasta(auc)} style={s.addStockBtn}>
                      <Icon name="cloud-arrow-down" size={11} color={C.white} />
                      <Text style={s.addStockText} numberOfLines={1}>Agregar al Stock</Text>
                    </TouchableOpacity>
                  </Pulse>
                )}
              </View>
            </View>
          );
        })}

        {lista.length === 0 && (
          <View style={s.emptyBox}>
            <Icon name="gavel" size={40} color={C.slate300} />
            <Text style={[s.emptyText, { fontSize: 12 }]}>No hay subastas en esta categoría por ahora</Text>
          </View>
        )}
      </View>
    </View>
  );
}

interface AuctionBidSheetProps {
  activeAuction: Auction | null;
  nowTs: number;
  isAuctionBidSheetOpen: boolean;
  setIsAuctionBidSheetOpen: (open: boolean) => void;
  bidAmount: number;
  setBidAmount: React.Dispatch<React.SetStateAction<number>>;
  handleEnviarOfertaSubasta: () => void;
}

/* ======================= SHEET: OFERTAR SUBASTA ======================= */
export function AuctionBidSheet({
  activeAuction,
  nowTs,
  isAuctionBidSheetOpen,
  setIsAuctionBidSheetOpen,
  bidAmount,
  setBidAmount,
  handleEnviarOfertaSubasta,
}: AuctionBidSheetProps) {
  const insets = useSafeAreaInsets();
  if (!activeAuction) return null;
  const auc = activeAuction;
  const msLeft = getAuctionMsLeft(auc, nowTs);
  return (
    <Sheet visible={isAuctionBidSheetOpen && !!activeAuction} onClose={() => setIsAuctionBidSheetOpen(false)}>
      <View style={{ padding: 16, gap: 16, paddingBottom: (insets.bottom || 0) + 16 }}>
        <View style={s.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={s.sheetTitleSm}>Ingresar oferta sellada</Text>
            <Text style={s.subMuted}>
              {auc.marca} {auc.modelo} ({auc.origen})
            </Text>
          </View>
          <TouchableOpacity onPress={() => setIsAuctionBidSheetOpen(false)}>
            <Icon name="circle-xmark" size={18} color={C.slate400} />
          </TouchableOpacity>
        </View>

        <View style={s.bigValueBox}>
          <Text style={s.bigValueLabel}>Monto de tu Oferta</Text>
          <Text style={s.bigValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {fmtCLP(bidAmount)}
          </Text>
        </View>

        <View style={s.sealedInfoBox}>
          <Icon name="lock" size={14} color={C.chileanTeal} />
          <Text style={s.sealedInfoText}>
            Tu oferta queda oculta hasta el cierre. No verás ofertas de otros compradores durante la subasta.
          </Text>
        </View>

        <View style={s.stepperRow}>
          <TouchableOpacity
            onPress={() => setBidAmount(Math.max(bidAmount - 100000, 0))}
            style={s.stepperBtn}
          >
            <Icon name="minus" size={18} color={C.slate800} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.bidMinText}>Tiempo restante: {formatAuctionRemaining(msLeft)}</Text>
          </View>
          <TouchableOpacity onPress={() => setBidAmount(bidAmount + 100000)} style={s.stepperBtn}>
            <Icon name="plus" size={18} color={C.slate800} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleEnviarOfertaSubasta} style={s.sheetPrimaryBtn}>
          <Text style={s.sheetPrimaryText}>Enviar Oferta Sellada</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

interface AuctionPublishSheetProps {
  isAuctionPublishSheetOpen: boolean;
  setIsAuctionPublishSheetOpen: (open: boolean) => void;
  publishStockId: string;
  setPublishStockId: React.Dispatch<React.SetStateAction<string>>;
  stockAuctionOptions: { label: string; value: string }[];
  sellerNote: string;
  setSellerNote: React.Dispatch<React.SetStateAction<string>>;
  handlePublicarSubastaStock: () => void;
}

/* ======================= SHEET: PUBLICAR SUBASTA ======================= */
export function AuctionPublishSheet({
  isAuctionPublishSheetOpen,
  setIsAuctionPublishSheetOpen,
  publishStockId,
  setPublishStockId,
  stockAuctionOptions,
  sellerNote,
  setSellerNote,
  handlePublicarSubastaStock,
}: AuctionPublishSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Sheet visible={isAuctionPublishSheetOpen} onClose={() => setIsAuctionPublishSheetOpen(false)} maxHeightPct={86}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16, gap: 16, paddingBottom: (insets.bottom || 0) + 16 }}>
          <View style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitleSm}>Subastar vehículo del stock</Text>
              <Text style={s.subMuted}>La ventana queda activa por 4 horas desde la publicación.</Text>
            </View>
            <TouchableOpacity onPress={() => setIsAuctionPublishSheetOpen(false)}>
              <Icon name="circle-xmark" size={18} color={C.slate400} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handlePublicarSubastaStock} style={s.publishStickyBtn}>
            <Icon name="gavel" size={12} color={C.white} />
            <Text style={s.sheetPrimaryText}>Publicar Subasta por 4 Horas</Text>
          </TouchableOpacity>

          <View style={{ gap: 12 }}>
            <View>
              <Text style={s.sheetFieldLabel}>Vehículo</Text>
              <Dropdown
                value={publishStockId}
                options={stockAuctionOptions}
                onChange={setPublishStockId}
                placeholder={stockAuctionOptions.length ? 'Selecciona un auto del stock' : 'No hay stock disponible'}
              />
            </View>

            <View>
              <View style={s.noteHeaderRow}>
                <Text style={s.sheetFieldLabel}>Nota abierta del vendedor</Text>
                <TouchableOpacity activeOpacity={0.8} onPress={Keyboard.dismiss} style={s.dismissKeyboardBtn}>
                  <Icon name="check" size={10} color={C.chileanTeal} />
                  <Text style={s.dismissKeyboardText}>Listo</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                placeholder="Ej: Mantenciones al día, documentos disponibles, detalle menor en parachoques..."
                placeholderTextColor={C.slate400}
                value={sellerNote}
                onChangeText={setSellerNote}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={s.auctionNoteInput}
              />
            </View>

            <View style={s.sealedInfoBox}>
              <Icon name="hourglass-half" size={14} color={C.chileanTeal} />
              <Text style={s.sealedInfoText}>
                Los compradores ofertan sin ver otros montos. Al finalizar, se adjudica la mejor oferta recibida.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Sheet>
  );
}

interface AuctionFeaturesSheetProps {
  activeAuction: Auction | null;
  isAuctionFeaturesSheetOpen: boolean;
  setIsAuctionFeaturesSheetOpen: (open: boolean) => void;
  nowTs: number;
  setActiveAuction: (auction: Auction | null) => void;
  setBidAmount: React.Dispatch<React.SetStateAction<number>>;
  setIsAuctionBidSheetOpen: (open: boolean) => void;
}

/* ======================= SHEET: CARACTERÍSTICAS SUBASTA ======================= */
export function AuctionFeaturesSheet({
  activeAuction,
  isAuctionFeaturesSheetOpen,
  setIsAuctionFeaturesSheetOpen,
  nowTs,
  setActiveAuction,
  setBidAmount,
  setIsAuctionBidSheetOpen,
}: AuctionFeaturesSheetProps) {
  const insets = useSafeAreaInsets();
  if (!activeAuction || !isAuctionFeaturesSheetOpen) return null;
  const auc = activeAuction;
  const imageUrl = getAuctionImageUrl(auc);
  const features = getAuctionFeatures(auc);
  const msLeft = getAuctionMsLeft(auc, nowTs);
  const active = !isAuctionFinal(auc) && msLeft > 0;
  return (
    <PageOverlay>
      <View style={[s.overlayHeader, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => setIsAuctionFeaturesSheetOpen(false)} style={s.rowCenter}>
          <Icon name="chevron-left" size={14} color={C.slate400} />
          <Text style={s.cancelText}> Volver</Text>
        </TouchableOpacity>
        <Text style={s.overlayTitle}>Ficha de Subasta</Text>
        <View style={s.stepPill}>
          <Text style={s.stepPillText}>#{auc.id}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <PhotoGallery fotos={[imageUrl]} />

        <View style={{ padding: 16, gap: 16 }}>
          <View style={[s.rowBetween, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <View style={s.aucBadgeRow}>
                <View style={s.origenPill}>
                  <Text style={s.origenText}>{auc.origen}</Text>
                </View>
                <View style={[s.auctionStatusPill, { backgroundColor: active ? C.emerald50 : C.slate100 }]}>
                  <Text style={[s.auctionStatusText, { color: active ? C.emerald700 : C.slate600 }]}>
                    {active ? 'Abierta' : 'Finalizada'}
                  </Text>
                </View>
              </View>
              <Text style={s.detailTitle}>
                {auc.marca} {auc.modelo}
              </Text>
              <Text style={s.detailSub}>
                {auc.version} • Año {auc.anio}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View style={[s.timePill, !active && s.timePillDone]}>
                <Icon name="clock" size={9} color={active ? C.amber700 : C.slate500} />
                <Text style={[s.timePillText, !active && { color: C.slate500 }]}>
                  {active ? formatAuctionRemaining(msLeft) : 'Finalizada'}
                </Text>
              </View>
              <View style={s.detailEstado}>
                <Text style={{ fontSize: 12, fontWeight: W.extrabold, color: C.teal700 }}>Sobre cerrado</Text>
              </View>
            </View>
          </View>

          <View style={s.detailMargenCard}>
            <View style={s.rowBetween}>
              <Text style={s.detailMiniLabel}>Referencia de compra</Text>
              <Text style={s.detailMiniValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {fmtCLP(auc.costoFinal)}
              </Text>
            </View>
            <View style={[s.rowBetween, { alignItems: 'flex-end' }]}>
              <View>
                <Text style={s.detailMiniLabel}>Venta sugerida</Text>
                <Text style={s.detailPrecio} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {fmtCLP(auc.sugeridoVenta)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.detailMiniLabel, { color: C.emerald600 }]}>Margen estimado</Text>
                <Text style={s.detailMargen} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  +{fmtCLP(auc.sugeridoVenta - auc.costoFinal)}
                </Text>
              </View>
            </View>
            <View style={s.detailFinanceGrid}>
              <TechItem label="Modalidad" value="Sobre cerrado" />
              <TechItem label="Oferta visible" value="No disponible" />
            </View>
          </View>

          <View style={s.detailTechCard}>
            <Text style={s.detailTechTitle}>Identificación</Text>
            <View style={s.detailTechGrid}>
              <TechItem label="Patente" value={auc.patente || 'Por asignar'} />
              <TechItem label="Origen" value={auc.origen || '—'} />
              <TechItem label="Año Modelo" value={auc.anio ? String(auc.anio) : '—'} />
              <TechItem label="ID Subasta" value={`#${auc.id}`} />
            </View>
          </View>

          <View style={s.detailTechCard}>
            <Text style={s.detailTechTitle}>Detalle del Vehículo</Text>
            <View style={s.detailTechGrid}>
              <TechItem label="Kilometraje" value={`${fmtMiles(auc.km)} km`} />
              <TechItem label="Color" value={auc.color || '—'} />
              <TechItem label="Transmisión" value={auc.transmision || '—'} />
              <TechItem label="Combustible" value={auc.combustible || '—'} />
            </View>
          </View>

          <View style={s.detailTechCard}>
            <Text style={s.detailTechTitle}>Características declaradas</Text>
            <View style={s.equipmentList}>
              {features.map((feature) => (
                <View key={`${feature.label}-${feature.value}`} style={s.featureDetailPill}>
                  <Icon name="check" size={9} color={C.teal700} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.featureDetailLabel}>{feature.label}</Text>
                    <Text style={s.featureDetailText}>{feature.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={s.detailTechCard}>
            <Text style={s.detailTechTitle}>Documentos</Text>
            <View style={{ gap: 8 }}>
              <View style={s.docRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.docTitle}>Carpeta digital de subasta</Text>
                  <Text style={s.docMeta}>Revisión documental • disponible al adjudicar</Text>
                </View>
              </View>
              <View style={s.docRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.docTitle}>Inspección visual</Text>
                  <Text style={s.docMeta}>Declaración estándar • sin garantía mecánica</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={s.notasBox}>
            <Text style={s.notasLabel}>Nota del vendedor:</Text>
            <Text style={s.notasText}>{auc.sellerNote}</Text>
          </View>
        </View>
      </ScrollView>

      {auc.estado === 'Disponible' && active && (
        <View style={[s.detailFooter, { paddingBottom: (insets.bottom || 8) + 16 }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setIsAuctionFeaturesSheetOpen(false);
              setActiveAuction(auc);
              setBidAmount(suggestSealedBid(auc));
              setIsAuctionBidSheetOpen(true);
            }}
            style={s.detailEditBtn}
          >
            <Icon name="gavel" size={12} color={C.white} />
            <Text style={s.detailEditText}>Ofertar en esta Subasta</Text>
          </TouchableOpacity>
        </View>
      )}
    </PageOverlay>
  );
}
