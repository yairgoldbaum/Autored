import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C } from '../src/theme';
import { Icon, PageOverlay } from '../src/ui';
import { s } from '../src/styles';
import { Car } from '../src/data';
import { fmtFecha } from '../src/autosave';
import { normalizarPatente } from '../src/pricing';
import { autoParaPatente } from '../src/informes';
import {
  DESCRIPCION_TRANSFERENCIA,
  ESTADOS_TRANSFERENCIA,
  EstadoTransferencia,
  ICONO_TRANSFERENCIA,
  SIGLA_TRANSFERENCIA,
  SolicitudTransferencia,
  TIPOS_TRANSFERENCIA,
  TipoTransferencia,
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
  handleAbrirNuevaSolicitud: () => void;
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
  handleAbrirNuevaSolicitud,
}: TransferenciasScreenProps) {
  const patenteFiltro = normalizarPatente(trPatente);
  const lista = transferencias.filter((sol) => {
    if (trEstado !== 'Todos' && sol.estado !== trEstado) return false;
    if (patenteFiltro && !sol.patente.includes(patenteFiltro)) return false;
    return true;
  });

  const chips: (EstadoTransferencia | 'Todos')[] = ['Todos', ...ESTADOS_TRANSFERENCIA];

  return (
    <View style={{ gap: 22 }}>
      <View>
        <Text style={s.h2Black}>Transferencias</Text>
        <Text style={s.subMuted}>En qué va cada solicitud y cómo empezar una nueva</Text>
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

      {/* Filtros. De los seis de la captura quedan los dos que se usan mirando el
          teléfono: por patente y por estado. */}
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
            const cant = est === 'Todos' ? transferencias.length : transferencias.filter((t) => t.estado === est).length;
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
