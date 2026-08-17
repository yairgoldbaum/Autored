import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { C, fmtCLP } from '../src/theme';
import { Icon } from '../src/ui';
import { s } from '../src/styles';
import { Car, EstadoAuto } from '../src/data';
import { FiltroDias, TabKey, etiquetaPeriodo } from '../src/helpers';
import { BarsAntiguedad, BarsEstado, KpiCard } from '../components/shared';

/* Los números los calcula AppInner, que es dueño del estado; la pantalla solo
   los dibuja. La foto del stock de hoy y la película del mes. */
export interface KpisStock {
  valorStock: number;
  promedioDias: number;
  margenPromedio: number;
  margenPct: number;
  criticos: Car[];
  pctCapitalCritico: number;
  antiguedad: { label: string; cantidad: number; color: string }[];
  porEstado: { estado: EstadoAuto; cantidad: number }[];
  totalActivos: number;
}

export interface KpisMes {
  ventas: number;
  margenTotal: number;
  margenPromedio: number;
  penetracionFinanciamiento: number;
  financiados: number;
  consignados: number;
}

interface KpisScreenProps {
  kpis: KpisStock;
  kpisMes: KpisMes;
  periodoKpi: string;
  setPeriodoKpi: React.Dispatch<React.SetStateAction<string>>;
  periodosDisponibles: string[];
  setFilterState: React.Dispatch<React.SetStateAction<string>>;
  setFiltroDias: React.Dispatch<React.SetStateAction<FiltroDias>>;
  setActiveTab: React.Dispatch<React.SetStateAction<TabKey>>;
}

/* ======================= PANTALLA KPIs ======================= */
export function KpisScreen({
  kpis,
  kpisMes,
  periodoKpi,
  setPeriodoKpi,
  periodosDisponibles,
  setFilterState,
  setFiltroDias,
  setActiveTab,
}: KpisScreenProps) {
  // Tocar una barra abre el Stock con ese filtro puesto.
  const irAStockPorEstado = (estado: string) => {
    setFiltroDias(null);
    setFilterState(estado);
    setActiveTab('stock');
  };
  const irAStockPorDias = (rango: FiltroDias) => {
    setFilterState('Todos');
    setFiltroDias(rango);
    setActiveTab('stock');
  };

  return (
    <View style={{ gap: 22 }}>
      <View>
        <Text style={s.h2Black}>KPIs</Text>
        <Text style={s.subMuted}>Cómo te fue en el mes y cómo está tu stock hoy</Text>
      </View>

      {/* Filtro de período */}
      <View style={{ gap: 8 }}>
        <Text style={s.sectionLabel}>Período</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {periodosDisponibles.map((p) => {
            const isSelected = periodoKpi === p;
            return (
              <TouchableOpacity
                key={p}
                activeOpacity={0.8}
                onPress={() => setPeriodoKpi(p)}
                style={[s.chip, isSelected ? s.chipActive : s.chipInactive]}
              >
                <Text style={[s.chipText, { color: isSelected ? C.white : C.slate600 }]}>{etiquetaPeriodo(p)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Los cuatro del mes */}
      <View style={{ gap: 12 }}>
        <Text style={s.sectionLabel}>Lo que pasó en {etiquetaPeriodo(periodoKpi)}</Text>
        <View style={s.kpiRow}>
          <KpiCard
            label="Ventas"
            value={String(kpisMes.ventas)}
            insight={kpisMes.ventas === 1 ? 'auto vendido' : 'autos vendidos'}
            color={C.brand}
          />
          <KpiCard
            label="Margen promedio"
            value={fmtCLP(kpisMes.margenPromedio)}
            insight="por auto vendido"
            color={C.emerald600}
          />
        </View>
        <View style={s.kpiRow}>
          <KpiCard
            label="Margen total"
            value={fmtCLP(kpisMes.margenTotal)}
            insight="del mes completo"
            color={C.emerald600}
          />
          <KpiCard
            label="Financiamiento"
            value={`${kpisMes.penetracionFinanciamiento}%`}
            insight={`${kpisMes.financiados} de ${kpisMes.ventas} con crédito`}
            color={C.brand}
          />
        </View>
        {kpisMes.consignados > 0 ? (
          <View style={s.kpiNota}>
            <Icon name="circle-info" size={11} color={C.amber700} />
            <Text style={s.kpiNotaText}>
              {kpisMes.consignados === 1
                ? 'Un auto vendido de este mes es consignado'
                : `${kpisMes.consignados} autos vendidos de este mes son consignados`}
              : su margen se calcula contra el piso pactado con el dueño, que es un supuesto nuestro
              mientras Autored no defina cómo se calcula la comisión.
            </Text>
          </View>
        ) : null}
      </View>

      {/* La foto del stock de hoy: sigue siendo útil y convive con lo de arriba */}
      <View style={{ gap: 12 }}>
        <Text style={s.sectionLabel}>Tu stock hoy</Text>
        <View style={s.kpiRow}>
          <KpiCard
            label="Capital en autos"
            value={fmtCLP(kpis.valorStock)}
            insight={`${kpis.totalActivos} ${kpis.totalActivos === 1 ? 'auto' : 'autos'} sin vender`}
            color={C.brand}
          />
          <KpiCard
            label="Días promedio"
            value={`${kpis.promedioDias} días`}
            insight={
              kpis.criticos.length > 0
                ? `${kpis.pctCapitalCritico}% de tu plata lleva +60 días detenida`
                : 'Toda tu plata rota en menos de 60 días'
            }
            color={kpis.criticos.length > 0 ? C.amber600 : C.emerald600}
          />
        </View>

        <View style={s.chartCard}>
          <Text style={s.chartTitle}>¿Hace cuánto tienes cada auto?</Text>
          <BarsAntiguedad data={kpis.antiguedad} onPressBar={irAStockPorDias} />
        </View>

        <View style={s.chartCard}>
          <Text style={s.chartTitle}>¿En qué etapa está tu stock?</Text>
          <BarsEstado data={kpis.porEstado} total={kpis.totalActivos} onPressBar={irAStockPorEstado} />
        </View>
      </View>
    </View>
  );
}
