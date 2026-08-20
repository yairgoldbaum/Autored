import React from 'react';
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, W, fmtCLP, fmtMiles } from '../src/theme';
import { Dropdown, Icon, Sheet } from '../src/ui';
import { s } from '../src/styles';
import { Auction, Car, RelacionClienteVehiculo, costoBase, diasEnStock } from '../src/data';
import {
  FiltroDias,
  ORDEN_STOCK_OPTIONS,
  OrdenStock,
  StockFilters,
  badgeForEstado,
  emptyStockFilters,
  leadsDeVehiculo,
} from '../src/helpers';

interface StockScreenProps {
  stock: Car[];
  filteredStock: Car[];
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filterState: string;
  setFilterState: React.Dispatch<React.SetStateAction<string>>;
  filters: StockFilters;
  setFilters: React.Dispatch<React.SetStateAction<StockFilters>>;
  activeStockAuctionMap: Map<number, Auction>;
  relaciones: RelacionClienteVehiculo[];
  setActiveCar: (car: Car | null) => void;
  setIsFilterSheetOpen: (open: boolean) => void;
  handleEliminarAuto: (car: Car) => void;
}

/* ======================= PANTALLA STOCK ======================= */
export function StockScreen({
  stock,
  filteredStock,
  searchQuery,
  setSearchQuery,
  filterState,
  setFilterState,
  filters,
  setFilters,
  activeStockAuctionMap,
  relaciones,
  setActiveCar,
  setIsFilterSheetOpen,
  handleEliminarAuto,
}: StockScreenProps) {
  const chips = ['Todos', 'Pre-stock', 'En preparación', 'En venta', 'Reservado', 'Vendido'];
  return (
    <View style={{ gap: 16 }}>
      <View style={s.screenHead}>
        <View style={s.screenHeadText}>
          <Text style={s.h2Black}>Stock de Vehículos</Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} onPress={() => setIsFilterSheetOpen(true)} style={[s.filterBtn, s.screenHeadAction]}>
          <Icon name="sliders" size={12} color={C.slate700} />
          <Text style={s.filterBtnText}>Filtros</Text>
        </TouchableOpacity>
      </View>

      {/* Buscar */}
      <View style={s.searchWrap}>
        <Icon name="magnifying-glass" size={14} color={C.slate400} style={{ marginLeft: 14 }} />
        <TextInput
          placeholder="Buscar por marca, modelo o patente..."
          placeholderTextColor={C.slate400}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={s.searchInput}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ paddingHorizontal: 12 }}>
            <Icon name="circle-xmark" size={16} color={C.slate400} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Chips */}
      <View style={s.chipWrap}>
        {chips.map((est) => {
          const cant = est === 'Todos' ? stock.length : stock.filter((c) => c.estado === est).length;
          const isSelected = filterState === est;
          return (
            <TouchableOpacity
              key={est}
              activeOpacity={0.8}
              onPress={() => setFilterState(est)}
              style={[s.chip, isSelected ? s.chipActive : s.chipInactive]}
            >
              <Text style={[s.chipText, { color: isSelected ? C.white : C.slate600 }]}>{est}</Text>
              <View style={[s.chipCount, { backgroundColor: isSelected ? C.chileanTeal : C.slate100 }]}>
                <Text style={{ fontSize: 10, color: isSelected ? C.white : C.slate500, fontWeight: W.bold }}>{cant}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Aviso del filtro por días, que llega desde el gráfico de antigüedad de KPIs.
          Sin esto el usuario no tiene cómo saber por qué ve menos autos. */}
      {filters.dias ? (
        <View style={s.filtroDiasBanner}>
          <Icon name="clock" size={11} color={C.teal700} />
          <Text style={s.filtroDiasText}>
            Mostrando solo los autos de {filters.dias === '+60' ? 'más de 60' : filters.dias} días en stock
          </Text>
          <TouchableOpacity onPress={() => setFilters((prev) => ({ ...prev, dias: null }))}>
            <Icon name="circle-xmark" size={14} color={C.teal700} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Listado */}
      <View style={{ gap: 12 }}>
        {filteredStock.length === 0 ? (
          <View style={s.emptyBox}>
            <Icon name="car-side" size={40} color={C.slate300} />
            <Text style={s.emptyText}>No encontramos autos con esos filtros</Text>
            <TouchableOpacity
              onPress={() => {
                setFilterState('Todos');
                setFilters(emptyStockFilters());
                setSearchQuery('');
              }}
            >
              <Text style={s.resetText}>Restablecer filtros</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredStock.map((car) => {
            const badge = badgeForEstado(car.estado);
            const activeStockAuction = activeStockAuctionMap.get(car.id);
            const dias = diasEnStock(car);
            // Lo que David quiere ver en la tarjeta (puntos 12 y 13): margen,
            // versión y leads. El margen SIEMPRE contra costoBase, nunca
            // restando costoAdquisicion a mano (en consignación es 0).
            const margen = car.precioVenta - costoBase(car);
            const leads = leadsDeVehiculo(relaciones, car.id);
            const visitas = car.visitas?.length || 0;
            return (
              <TouchableOpacity key={car.id} activeOpacity={0.9} onPress={() => setActiveCar(car)} style={s.carCard}>
                <View style={s.carThumb}>
                  {car.fotos.length > 0 ? (
                    <Image source={{ uri: car.fotos[0] }} style={s.carThumbImg} />
                  ) : (
                    <View style={s.carThumbEmpty}>
                      <Icon name="car-side" size={22} color={C.slate300} />
                    </View>
                  )}
                  {dias > 60 && car.estado !== 'Vendido' && (
                    <View style={s.badge60}>
                      <Icon name="clock" size={8} color={C.white} />
                      <Text style={s.badge60Text}>+60 DÍAS</Text>
                    </View>
                  )}
                  {activeStockAuction && (
                    <View style={s.auctionThumbBadge}>
                      <Icon name="gavel" size={8} color={C.white} />
                      <Text style={s.badge60Text}>SUBASTA</Text>
                    </View>
                  )}
                </View>

                <View style={s.carInfo}>
                  <View style={s.carTop}>
                    <View style={s.carHead}>
                      <View style={s.carTitleWrap}>
                        <Text style={s.carTitle} numberOfLines={1}>
                          {car.marca} {car.modelo}
                        </Text>
                      </View>
                      <View style={s.carHeadActions}>
                        <View style={s.patentePill}>
                          <Text style={s.patenteText} numberOfLines={1}>{car.patente}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation?.();
                            handleEliminarAuto(car);
                          }}
                          activeOpacity={0.75}
                          hitSlop={8}
                          style={s.trashSm}
                        >
                          <Icon name="trash-can" size={11} color={C.red600} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {car.version ? (
                      <Text style={s.carVersion} numberOfLines={1}>
                        {car.version}
                      </Text>
                    ) : null}
                    <Text style={s.carSpecs}>
                      {car.anio} • {fmtMiles(car.km)} km • {car.transmision}
                    </Text>
                  </View>

                  <View style={s.carCommercial}>
                    <View style={s.carPriceBlock}>
                      <Text style={s.priceLabel}>Precio Venta</Text>
                      {/* Mismo arreglo que en KpiCard: el monto se achica antes de partirse
                          en dos líneas (feedback de Jorge y Mauro). */}
                      <Text style={s.priceValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {fmtCLP(car.precioVenta)}
                      </Text>
                      <Text
                        style={[s.carMargen, margen < 0 && { color: C.red600 }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        Margen {margen >= 0 ? '+' : '−'}
                        {fmtCLP(Math.abs(margen))}
                      </Text>
                    </View>
                    <View style={s.carBadgeRow}>
                      <View style={[s.estadoBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                        <Text style={[s.estadoBadgeText, { color: badge.color }]} numberOfLines={1}>
                          {car.estado}
                        </Text>
                      </View>
                      {/* Propio y consignado dejan de verse iguales (Mauro, punto 11):
                          el consignado no es tuyo y su margen se calcula distinto. */}
                      {car.tenencia === 'Consignado' && (
                        <View style={s.consignadoPill}>
                          <Icon name="handshake" size={8} color={C.purple700} />
                          <Text style={s.consignadoText}>Consignado</Text>
                        </View>
                      )}
                      {activeStockAuction && (
                        <View style={s.stockAuctionPill}>
                          <Icon name="clock" size={8} color={C.amber700} />
                          <Text style={s.stockAuctionText}>En subasta</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.diasStock}>
                      {visitas} {visitas === 1 ? 'visita' : 'visitas'} · {leads} {leads === 1 ? 'lead' : 'leads'} · {dias}{' '}
                      {dias === 1 ? 'día' : 'días'} en stock
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </View>
  );
}

interface FilterSheetProps {
  isFilterSheetOpen: boolean;
  setIsFilterSheetOpen: (open: boolean) => void;
  filters: StockFilters;
  setFilters: React.Dispatch<React.SetStateAction<StockFilters>>;
  marcasDisponibles: string[];
  stock: Car[];
  ordenStock: OrdenStock;
  setOrdenStock: React.Dispatch<React.SetStateAction<OrdenStock>>;
}

const DIAS_OPTIONS: { label: string; value: FiltroDias }[] = [
  { label: 'Todos', value: null },
  { label: '0-30 días', value: '0-30' },
  { label: '31-60 días', value: '31-60' },
  { label: '+60 días', value: '+60' },
];

const TENENCIA_OPTIONS = [
  { label: 'Todas', value: '' },
  { label: 'Propio', value: 'Propio' },
  { label: 'Consignado', value: 'Consignado' },
];

/* ======================= SHEET: FILTROS ======================= */
export function FilterSheet({
  isFilterSheetOpen,
  setIsFilterSheetOpen,
  filters,
  setFilters,
  marcasDisponibles,
  stock,
  ordenStock,
  setOrdenStock,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  // Los modelos se acotan a la marca elegida, si hay una.
  const modelosDisponibles = [
    ...new Set(stock.filter((c) => !filters.marca || c.marca === filters.marca).map((c) => c.modelo)),
  ].sort();
  // La sucursal solo se ofrece cuando el stock tiene más de una (punto 20): el
  // campo existe en el modelo, pero para una compraventa de una sede es ruido.
  const sucursalesDisponibles = [...new Set(stock.map((c) => c.sucursal).filter(Boolean))].sort();

  return (
    <Sheet visible={isFilterSheetOpen} onClose={() => setIsFilterSheetOpen(false)} maxHeightPct={85}>
      <View style={s.sheetHeader}>
        <Text style={s.sheetTitle}>Filtrar Vehículos</Text>
        <TouchableOpacity onPress={() => setIsFilterSheetOpen(false)}>
          <Icon name="circle-xmark" size={18} color={C.slate400} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View>
          <Text style={s.sheetFieldLabel}>Ordenar por</Text>
          <View style={s.asChipRow}>
            {ORDEN_STOCK_OPTIONS.map((op) => (
              <TouchableOpacity
                key={op.value}
                onPress={() => setOrdenStock(op.value)}
                style={[s.asChip, ordenStock === op.value && s.asChipActive]}
              >
                <Text style={[s.asChipText, ordenStock === op.value && { color: C.white }]}>{op.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View>
          <Text style={s.sheetFieldLabel}>Marca</Text>
          <Dropdown
            small
            value={filters.marca}
            placeholder="Todas las marcas"
            onChange={(v) => setFilters({ ...filters, marca: v, modelo: '' })}
            options={[{ label: 'Todas las marcas', value: '' }, ...marcasDisponibles.map((m) => ({ label: m, value: m }))]}
          />
        </View>
        <View>
          <Text style={s.sheetFieldLabel}>Modelo</Text>
          <Dropdown
            small
            value={filters.modelo}
            placeholder="Todos los modelos"
            onChange={(v) => setFilters({ ...filters, modelo: v })}
            options={[{ label: 'Todos los modelos', value: '' }, ...modelosDisponibles.map((m) => ({ label: m, value: m }))]}
          />
        </View>
        <View>
          <Text style={s.sheetFieldLabel}>Año</Text>
          <View style={s.fieldPair}>
            <TextInput
              placeholder="Desde"
              placeholderTextColor={C.slate400}
              keyboardType="number-pad"
              maxLength={4}
              value={filters.anioDesde}
              onChangeText={(t) => setFilters({ ...filters, anioDesde: t.replace(/\D/g, '') })}
              style={[s.sheetInput, s.fieldPairItem]}
            />
            <TextInput
              placeholder="Hasta"
              placeholderTextColor={C.slate400}
              keyboardType="number-pad"
              maxLength={4}
              value={filters.anioHasta}
              onChangeText={(t) => setFilters({ ...filters, anioHasta: t.replace(/\D/g, '') })}
              style={[s.sheetInput, s.fieldPairItem]}
            />
          </View>
        </View>
        <View>
          <Text style={s.sheetFieldLabel}>Precio (CLP)</Text>
          <View style={s.fieldPair}>
            <TextInput
              placeholder="Desde"
              placeholderTextColor={C.slate400}
              keyboardType="number-pad"
              value={filters.precioDesde}
              onChangeText={(t) => setFilters({ ...filters, precioDesde: t.replace(/\D/g, '') })}
              style={[s.sheetInput, s.fieldPairItem]}
            />
            <TextInput
              placeholder="Hasta"
              placeholderTextColor={C.slate400}
              keyboardType="number-pad"
              value={filters.precioHasta}
              onChangeText={(t) => setFilters({ ...filters, precioHasta: t.replace(/\D/g, '') })}
              style={[s.sheetInput, s.fieldPairItem]}
            />
          </View>
        </View>
        {sucursalesDisponibles.length > 1 ? (
          <View>
            <Text style={s.sheetFieldLabel}>Sucursal</Text>
            <Dropdown
              small
              value={filters.sucursal}
              placeholder="Todas las sucursales"
              onChange={(v) => setFilters({ ...filters, sucursal: v })}
              options={[
                { label: 'Todas las sucursales', value: '' },
                ...sucursalesDisponibles.map((suc) => ({ label: suc, value: suc })),
              ]}
            />
          </View>
        ) : null}
        <View>
          <Text style={s.sheetFieldLabel}>Días en stock</Text>
          <View style={s.asChipRow}>
            {DIAS_OPTIONS.map((op) => (
              <TouchableOpacity
                key={op.label}
                onPress={() => setFilters({ ...filters, dias: op.value })}
                style={[s.asChip, filters.dias === op.value && s.asChipActive]}
              >
                <Text style={[s.asChipText, filters.dias === op.value && { color: C.white }]}>{op.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View>
          <Text style={s.sheetFieldLabel}>Tenencia</Text>
          <View style={s.asChipRow}>
            {TENENCIA_OPTIONS.map((op) => (
              <TouchableOpacity
                key={op.label}
                onPress={() => setFilters({ ...filters, tenencia: op.value })}
                style={[s.asChip, filters.tenencia === op.value && s.asChipActive]}
              >
                <Text style={[s.asChipText, filters.tenencia === op.value && { color: C.white }]}>{op.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={[s.sheetFooter, { paddingBottom: (insets.bottom || 0) + 16 }]}>
        <TouchableOpacity
          onPress={() => {
            setFilters(emptyStockFilters());
            setOrdenStock('ingreso');
            setIsFilterSheetOpen(false);
          }}
          style={s.sheetBtnGray}
        >
          <Text style={s.sheetBtnGrayText}>Limpiar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsFilterSheetOpen(false)} style={s.sheetBtnTeal}>
          <Text style={s.sheetBtnTealText}>Aplicar Filtros</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}
