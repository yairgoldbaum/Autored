import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C } from '../src/theme';
import { Dropdown, Icon, PageOverlay, Sheet } from '../src/ui';
import { s } from '../src/styles';
import { Car } from '../src/data';
import { fmtFecha } from '../src/autosave';
import { etiquetaPeriodo } from '../src/helpers';
import { normalizarPatente } from '../src/pricing';
import { autoParaPatente } from '../src/informes';
import {
  DESCRIPCION_TRANSFERENCIA,
  ESTADOS_TRANSFERENCIA,
  EstadoTransferencia,
  FiltrosTransferencia,
  ICONO_TRANSFERENCIA,
  SIGLA_TRANSFERENCIA,
  SolicitudTransferencia,
  TIPOS_TRANSFERENCIA,
  TipoTransferencia,
  emptyFiltrosTransferencia,
  hayFiltrosTransferencia,
} from '../src/transferencias';

/* Color por tipo, tomado de las tarjetas de david-pantallas-2.png. */
const COLOR_TIPO: Record<TipoTransferencia, { fondo: string; borde: string; texto: string }> = {
  'Automotora Vende': { fondo: C.blue50, borde: C.blue100, texto: C.blue700 },
  'Automotora Compra': { fondo: C.emerald50, borde: C.emerald100, texto: C.emerald700 },
  'Contrato Abierto': { fondo: C.amber50, borde: C.amber200, texto: C.amber700 },
  'Automotora Gestiona': { fondo: C.purple50, borde: C.purple100, texto: C.purple700 },
};

/* Color por estado. El estado es lo que el compraventero mira de un vistazo, así que
   los tres que están en curso se distinguen entre sí y no solo del final. */
const COLOR_ESTADO: Record<EstadoTransferencia, { fondo: string; texto: string }> = {
  Pendiente: { fondo: C.amber50, texto: C.amber700 },
  'AutoSafe transfiere': { fondo: C.teal50, texto: C.teal700 },
  'En registro civil': { fondo: C.blue50, texto: C.blue700 },
  Finalizada: { fondo: C.emerald50, texto: C.emerald700 },
  Rechazada: { fondo: C.red50, texto: C.red700 },
};

interface TransferenciasScreenProps {
  transferencias: SolicitudTransferencia[];
  stock: Car[];
  trPatente: string;
  setTrPatente: React.Dispatch<React.SetStateAction<string>>;
  trEstado: EstadoTransferencia | 'Todos';
  setTrEstado: React.Dispatch<React.SetStateAction<EstadoTransferencia | 'Todos'>>;
  trFiltros: FiltrosTransferencia;
  setIsTrFilterSheetOpen: (open: boolean) => void;
  handleAbrirNuevaSolicitud: () => void;
}

/** Marca, modelo y mes de una solicitud, derivados de la patente como todo lo demás. */
function datosDeSolicitud(sol: SolicitudTransferencia, stock: Car[]) {
  const auto = autoParaPatente(sol.patente, stock);
  return { auto, mes: sol.fecha.slice(0, 7) };
}

/* La lista de solicitudes es lo principal de la sección. David: "que pongan esa vista
   de tabla, que vean el ejemplo que tiene todas sus transferencias, que pueda crear
   una transferencia y que lo lleve a la pantalla inicial donde selecciona el tipo.
   Hasta ahí es suficiente para mostrárselo a un usuario".

   Trae las mismas columnas de andres-transferencias-2.png —solicitud, patente, marca
   y modelo, año, creación, tipo y estado— pero como fila-tarjeta: ocho columnas en un
   teléfono de 390px no entran.

   El panel de contadores NO va. Andrés fue explícito: "este panel acá con los
   contadores ni siquiera lo incluiría, de hecho esa cuestión la vamos a sacar
   también". Y el botón de ver tampoco: David cortó antes de la vista de detalle, y lo
   que le importa al compraventero —en qué va cada una— está en la tarjeta. */
export function TransferenciasScreen({
  transferencias,
  stock,
  trPatente,
  setTrPatente,
  trEstado,
  setTrEstado,
  trFiltros,
  setIsTrFilterSheetOpen,
  handleAbrirNuevaSolicitud,
}: TransferenciasScreenProps) {
  const patenteFiltro = normalizarPatente(trPatente);
  /* Todo menos el estado. Los chips de estado cuentan sobre esto y no sobre el total,
     si no decían "Todos 8" con dos solicitudes en pantalla. */
  const base = transferencias.filter((sol) => {
    if (patenteFiltro && !sol.patente.includes(patenteFiltro)) return false;
    const { auto, mes } = datosDeSolicitud(sol, stock);
    if (trFiltros.desde && mes < trFiltros.desde) return false;
    if (trFiltros.hasta && mes > trFiltros.hasta) return false;
    if (trFiltros.marca && auto?.marca !== trFiltros.marca) return false;
    if (trFiltros.modelo && auto?.modelo !== trFiltros.modelo) return false;
    return true;
  });
  const lista = base.filter((sol) => trEstado === 'Todos' || sol.estado === trEstado);

  const chips: (EstadoTransferencia | 'Todos')[] = ['Todos', ...ESTADOS_TRANSFERENCIA];
  const filtrando = hayFiltrosTransferencia(trFiltros);

  return (
    <View style={{ gap: 22 }}>
      <View style={s.screenHead}>
        <View style={s.screenHeadText}>
          <Text style={s.h2Black}>Transferencias</Text>
          <Text style={s.subMuted}>En qué va cada solicitud y cómo empezar una nueva</Text>
        </View>
        {/* Los otros cuatro filtros de la captura van detrás del botón, que es el
            patrón que el Stock ya usa. Patente y estado se quedan a la vista. */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsTrFilterSheetOpen(true)}
          style={[s.filterBtn, s.screenHeadAction, filtrando && { borderColor: C.chileanTeal }]}
          accessibilityRole="button"
          accessibilityLabel="Filtros"
        >
          <Icon name="sliders" size={12} color={filtrando ? C.chileanTeal : C.slate700} />
          <Text style={[s.filterBtnText, filtrando && { color: C.chileanTeal }]}>Filtros</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleAbrirNuevaSolicitud}
        style={s.trNuevaBtn}
        accessibilityRole="button"
        accessibilityLabel="Nueva solicitud"
      >
        <Icon name="plus" size={13} color={C.white} />
        <Text style={s.trNuevaBtnText}>Nueva solicitud</Text>
      </TouchableOpacity>

      {/* Los dos que se usan mirando el teléfono quedan a la vista: patente y estado.
          Los otros cuatro de la captura están en el sheet del botón de arriba. */}
      <View style={{ gap: 10 }}>
        <View style={s.searchWrap}>
          <Icon name="magnifying-glass" size={14} color={C.slate400} style={{ marginLeft: 14 }} />
          <TextInput
            placeholder="Buscar por patente..."
            placeholderTextColor={C.slate400}
            value={trPatente}
            onChangeText={(t) => setTrPatente(normalizarPatente(t))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            style={s.searchInput}
          />
          {trPatente ? (
            <TouchableOpacity onPress={() => setTrPatente('')} style={{ paddingHorizontal: 12 }}>
              <Icon name="circle-xmark" size={16} color={C.slate400} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {chips.map((est) => {
            const activo = trEstado === est;
            const cant = est === 'Todos' ? base.length : base.filter((t) => t.estado === est).length;
            return (
              <TouchableOpacity
                key={est}
                activeOpacity={0.8}
                onPress={() => setTrEstado(est)}
                style={[s.chip, activo ? s.chipActive : s.chipInactive]}
              >
                <Text style={[s.chipText, { color: activo ? C.white : C.slate600 }]}>{est}</Text>
                <View style={[s.chipCount, { backgroundColor: activo ? C.chileanTeal : C.slate100 }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: activo ? C.white : C.slate500 }}>{cant}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* La tabla */}
      <View style={{ gap: 12 }}>
        {lista.length === 0 ? (
          <View style={s.emptyBox}>
            <Icon name="right-left" size={40} color={C.slate300} />
            <Text style={[s.emptyText, { fontSize: 12 }]}>
              {transferencias.length === 0
                ? 'Todavía no tienes solicitudes de transferencia'
                : 'No hay solicitudes con esos filtros'}
            </Text>
          </View>
        ) : (
          lista.map((sol) => {
            const auto = autoParaPatente(sol.patente, stock);
            const tipo = COLOR_TIPO[sol.tipo];
            const estado = COLOR_ESTADO[sol.estado];
            return (
              <View key={sol.id} style={s.trFila}>
                {/* El estado va arriba a la derecha: es lo que el compraventero mira
                    primero cuando abre la sección. */}
                <View style={s.trFilaHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.trPatente}>{sol.patente}</Text>
                    {auto ? (
                      <Text style={s.trAuto} numberOfLines={1}>
                        {auto.marca} {auto.modelo} · {auto.anio}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[s.trEstadoPill, { backgroundColor: estado.fondo }]}>
                    <Text style={[s.trEstadoText, { color: estado.texto }]}>{sol.estado}</Text>
                  </View>
                </View>
                {/* El tipo va con sigla Y nombre, como la tabla de ellos ("AG -
                    Automotora Gestiona"): dos letras solas no se adivinan. */}
                <View style={s.trPie}>
                  <View style={[s.trSigla, { backgroundColor: tipo.fondo, borderColor: tipo.borde }]}>
                    <Text style={[s.trSiglaText, { color: tipo.texto }]} numberOfLines={1}>
                      {SIGLA_TRANSFERENCIA[sol.tipo]} · {sol.tipo}
                    </Text>
                  </View>
                  <Text style={s.trMeta} numberOfLines={1}>
                    N° {sol.solicitud} · {fmtFecha(sol.fecha)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

interface NuevaSolicitudOverlayProps {
  abierto: boolean;
  onCerrar: () => void;
  tipoElegido: TipoTransferencia | null;
  setTipoElegido: (tipo: TipoTransferencia | null) => void;
}

/* Crear una solicitud llega hasta el tipo y corta. El resto —patente, prohibición de
   enajenar, términos, firma con Clave Única, impuestos— es el flujo que Autored ya
   tiene construido en su web. David: "solo queremos mostrarle que van a haber
   transferencias acá y se van a poder crear". El texto del aviso es copy nuestro:
   nadie lo dictó en la reunión. */
export function NuevaSolicitudOverlay({
  abierto,
  onCerrar,
  tipoElegido,
  setTipoElegido,
}: NuevaSolicitudOverlayProps) {
  const insets = useSafeAreaInsets();
  if (!abierto) return null;

  return (
    <PageOverlay>
      <View style={[s.overlayHeader, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={onCerrar} style={s.rowCenter}>
          <Icon name="xmark" size={18} color={C.slate400} />
          <Text style={s.cancelText}> Cerrar</Text>
        </TouchableOpacity>
        <Text style={s.overlayTitle}>Crear solicitud</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <View>
          <Text style={s.h2Black}>Selecciona el tipo</Text>
          <Text style={s.subMuted}>Qué transferencia deseas realizar</Text>
        </View>

        {TIPOS_TRANSFERENCIA.map((tipo) => {
          const color = COLOR_TIPO[tipo];
          const elegido = tipoElegido === tipo;
          return (
            <React.Fragment key={tipo}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setTipoElegido(tipo)}
                style={[
                  s.trTipoCard,
                  { backgroundColor: color.fondo, borderColor: elegido ? color.texto : color.borde },
                ]}
                accessibilityRole="button"
                accessibilityLabel={tipo}
              >
                <View style={[s.trTipoIcono, { backgroundColor: C.white }]}>
                  <Icon name={ICONO_TRANSFERENCIA[tipo] as any} size={17} color={color.texto} />
                </View>
                <Text style={s.trTipoTitulo}>{tipo}</Text>
                <Text style={s.trTipoDesc}>{DESCRIPCION_TRANSFERENCIA[tipo]}</Text>
              </TouchableOpacity>

              {/* El aviso va pegado a la tarjeta elegida y no al final de la lista:
                  eligiendo la primera, al final quedaba fuera de pantalla. */}
              {elegido ? (
                <View style={[s.detailTechCard, { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }]}>
                  <Icon name="circle-info" size={16} color={C.chileanTeal} />
                  <Text style={[s.trTipoDesc, { flex: 1, minWidth: 0 }]}>
                    Por ahora el trámite se completa en la web de Autored. Próximamente vas a poder hacerlo desde acá.
                  </Text>
                </View>
              ) : null}
            </React.Fragment>
          );
        })}
      </ScrollView>
    </PageOverlay>
  );
}

interface TransferenciasFilterSheetProps {
  abierto: boolean;
  setAbierto: (open: boolean) => void;
  transferencias: SolicitudTransferencia[];
  stock: Car[];
  filtros: FiltrosTransferencia;
  setFiltros: React.Dispatch<React.SetStateAction<FiltrosTransferencia>>;
}

/* Los cuatro filtros que no caben a la vista, detrás del botón de arriba, con el
   mismo sheet que usa el Stock. Nadie habló de filtros en la reunión del 21-08: es
   decisión de implementación, y por eso los dos que se usan de verdad —patente y
   estado— quedaron afuera del sheet, a un toque.

   Las opciones salen de las solicitudes que hay, no de catálogos: ofrecer una marca
   que ninguna solicitud tiene es un filtro que solo puede devolver vacío. */
export function TransferenciasFilterSheet({
  abierto,
  setAbierto,
  transferencias,
  stock,
  filtros,
  setFiltros,
}: TransferenciasFilterSheetProps) {
  const autos = transferencias.map((sol) => autoParaPatente(sol.patente, stock));
  const marcas = [...new Set(autos.map((a) => a?.marca).filter(Boolean) as string[])].sort();
  const modelos = [
    ...new Set(
      autos
        .filter((a) => a && (!filtros.marca || a.marca === filtros.marca))
        .map((a) => a?.modelo)
        .filter(Boolean) as string[],
    ),
  ].sort();
  // Los meses que la lista tiene, del más viejo al más nuevo.
  const meses = [...new Set(transferencias.map((sol) => sol.fecha.slice(0, 7)).filter(Boolean))].sort();

  return (
    <Sheet visible={abierto} onClose={() => setAbierto(false)} maxHeightPct={85}>
      <View style={s.sheetHeader}>
        <Text style={s.sheetTitle}>Filtrar solicitudes</Text>
        <TouchableOpacity onPress={() => setAbierto(false)}>
          <Icon name="circle-xmark" size={18} color={C.slate400} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View>
          <Text style={s.sheetFieldLabel}>Fecha de creación</Text>
          <View style={s.fieldPair}>
            <View style={s.fieldPairItem}>
              <Dropdown
                small
                value={filtros.desde}
                placeholder="Desde"
                onChange={(v) => setFiltros((prev) => ({ ...prev, desde: v }))}
                options={[{ label: 'Desde siempre', value: '' }, ...meses.map((m) => ({ label: etiquetaPeriodo(m), value: m }))]}
              />
            </View>
            <View style={s.fieldPairItem}>
              <Dropdown
                small
                value={filtros.hasta}
                placeholder="Hasta"
                onChange={(v) => setFiltros((prev) => ({ ...prev, hasta: v }))}
                options={[{ label: 'Hasta hoy', value: '' }, ...meses.map((m) => ({ label: etiquetaPeriodo(m), value: m }))]}
              />
            </View>
          </View>
        </View>
        <View>
          <Text style={s.sheetFieldLabel}>Marca</Text>
          <Dropdown
            small
            value={filtros.marca}
            placeholder="Todas las marcas"
            /* Cambiar de marca deja el modelo anterior sin sentido. Va en una sola
               escritura: dos seguidas sobre el mismo objeto se pisan. */
            onChange={(v) => setFiltros((prev) => ({ ...prev, marca: v, modelo: '' }))}
            options={[{ label: 'Todas las marcas', value: '' }, ...marcas.map((m) => ({ label: m, value: m }))]}
          />
        </View>
        <View>
          <Text style={s.sheetFieldLabel}>Modelo</Text>
          <Dropdown
            small
            value={filtros.modelo}
            placeholder="Todos los modelos"
            onChange={(v) => setFiltros((prev) => ({ ...prev, modelo: v }))}
            options={[{ label: 'Todos los modelos', value: '' }, ...modelos.map((m) => ({ label: m, value: m }))]}
          />
        </View>
      </ScrollView>
      <View style={s.sheetFooter}>
        <TouchableOpacity onPress={() => setFiltros(emptyFiltrosTransferencia())} style={s.sheetBtnGray}>
          <Text style={s.sheetBtnGrayText}>Limpiar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAbierto(false)} style={s.sheetBtnTeal}>
          <Text style={s.sheetBtnTealText}>Aplicar Filtros</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}
