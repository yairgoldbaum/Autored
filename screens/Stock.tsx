import React from 'react';
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, W, fmtCLP, fmtMiles } from '../src/theme';
import { Dropdown, Icon, Sheet, Wiggle } from '../src/ui';
import { s } from '../src/styles';
import { Auction, Car, diasEnStock } from '../src/data';
import { FiltroDias, StockFilters, badgeForEstado } from '../src/helpers';

interface StockScreenProps {
  stock: Car[];
  filteredStock: Car[];
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filterState: string;
  setFilterState: React.Dispatch<React.SetStateAction<string>>;
  filtroDias: FiltroDias;
  setFiltroDias: React.Dispatch<React.SetStateAction<FiltroDias>>;
  setFilters: React.Dispatch<React.SetStateAction<StockFilters>>;
  activeStockAuctionMap: Map<number, Auction>;
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
  filtroDias,
  setFiltroDias,
  setFilters,
  activeStockAuctionMap,
  setActiveCar,
  setIsFilterSheetOpen,
  handleEliminarAuto,
}: StockScreenProps) {
  const chips = ['Todos', 'Pre-stock', 'En preparación', 'En venta', 'Reservado', 'Vendido'];
  return (
    <View style={{ gap: 16 }}>
      <View style={s.rowBetween}>
        <Text style={s.h2Black}>Stock de Vehículos</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={() => setIsFilterSheetOpen(true)} style={s.filterBtn}>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
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
      </ScrollView>

      {/* Aviso del filtro por días, que llega desde el gráfico de antigüedad de KPIs.
          Sin esto el usuario no tiene cómo saber por qué ve menos autos. */}
      {filtroDias ? (
        <View style={s.filtroDiasBanner}>
          <Icon name="clock" size={11} color={C.teal700} />
          <Text style={s.filtroDiasText}>
            Mostrando solo los autos de {filtroDias === '+60' ? 'más de 60' : filtroDias} días en stock
          </Text>
          <TouchableOpacity onPress={() => setFiltroDias(null)}>
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
                setFilters({ marca: '', anio: '', precioMax: 20000000, estado: '' });
                setSearchQuery('');
                setFiltroDias(null);
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

                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                  <View>
                    <View style={[s.rowBetween, { alignItems: 'flex-start' }]}>
                      <Text style={s.carTitle} numberOfLines={1}>
                        {car.marca} {car.modelo}
                      </Text>
                      <View style={s.rowCenter}>
                        <View style={s.patentePill}>
                          <Text style={s.patenteText}>{car.patente}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEliminarAuto(car);
                          }}
                          style={s.trashSm}
                        >
                          <Wiggle>
                            <Icon name="trash-can" size={11} color={C.red600} />
                          </Wiggle>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={s.carSpecs}>
                      {car.anio} • {fmtMiles(car.km)} km • {car.transmision}
                    </Text>
                  </View>

                  <View style={[s.rowBetween, { alignItems: 'flex-end', marginTop: 8 }]}>
                    <View>
                      <Text style={s.priceLabel}>Precio Venta</Text>
                      {/* Mismo arreglo que en KpiCard: el monto se achica antes de partirse
                          en dos líneas (feedback de Jorge y Mauro). */}
                      <Text style={s.priceValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {fmtCLP(car.precioVenta)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[s.estadoBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                        <Text style={{ fontSize: 10, fontWeight: W.extrabold, color: badge.color }}>{car.estado}</Text>
                      </View>
                      {activeStockAuction && (
                        <View style={s.stockAuctionPill}>
                          <Icon name="clock" size={8} color={C.amber700} />
                          <Text style={s.stockAuctionText}>En subasta</Text>
                        </View>
                      )}
                      <Text style={s.diasStock}>
                        {dias} {dias === 1 ? 'día' : 'días'} en stock
                      </Text>
                    </View>
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
}

/* ======================= SHEET: FILTROS ======================= */
export function FilterSheet({
  isFilterSheetOpen,
  setIsFilterSheetOpen,
  filters,
  setFilters,
  marcasDisponibles,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
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
          <Text style={s.sheetFieldLabel}>Marca</Text>
          <Dropdown
            small
            value={filters.marca}
            placeholder="Todas las marcas"
            onChange={(v) => setFilters({ ...filters, marca: v })}
            options={[{ label: 'Todas las marcas', value: '' }, ...marcasDisponibles.map((m) => ({ label: m, value: m }))]}
          />
        </View>
        <View>
          <Text style={s.sheetFieldLabel}>Año</Text>
          <TextInput
            placeholder="Ej: 2021"
            placeholderTextColor={C.slate400}
            keyboardType="number-pad"
            value={filters.anio}
            onChangeText={(t) => setFilters({ ...filters, anio: t })}
            style={s.sheetInput}
          />
        </View>
        <View>
          <View style={s.rowBetween}>
            <Text style={s.sheetFieldLabel}>Precio Máximo</Text>
            <Text style={s.sheetRangeValue}>{fmtCLP(filters.precioMax)}</Text>
          </View>
          <Slider
            minimumValue={4000000}
            maximumValue={20000000}
            step={500000}
            value={filters.precioMax}
            onValueChange={(v) => setFilters({ ...filters, precioMax: v })}
            minimumTrackTintColor={C.chileanTeal}
            maximumTrackTintColor={C.slate200}
            thumbTintColor={C.chileanTeal}
          />
        </View>
      </ScrollView>
      <View style={[s.sheetFooter, { paddingBottom: (insets.bottom || 0) + 16 }]}>
        <TouchableOpacity
          onPress={() => {
            setFilters({ marca: '', anio: '', precioMax: 20000000, estado: '' });
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
