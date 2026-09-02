import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { C } from '../src/theme';
import { Icon } from '../src/ui';
import { s } from '../src/styles';
import { Car } from '../src/data';
import { fmtFecha } from '../src/autosave';
import { normalizarPatente } from '../src/pricing';
import {
  ETIQUETA_TIPO_INFORME,
  InformeComprado,
  RESUMEN_TIPO_INFORME,
  TIPOS_INFORME,
  TipoInforme,
  autoParaPatente,
} from '../src/informes';

interface InformesScreenProps {
  informes: InformeComprado[];
  stock: Car[];
  informePatente: string;
  setInformePatente: React.Dispatch<React.SetStateAction<string>>;
  informeTipo: TipoInforme;
  setInformeTipo: React.Dispatch<React.SetStateAction<TipoInforme>>;
  informeBusqueda: string;
  setInformeBusqueda: React.Dispatch<React.SetStateAction<string>>;
  handleSacarInforme: () => void;
  handleVerInforme: (informe: InformeComprado) => void;
}

/* Sección de Informes (ronda 3, punto 4), con la estructura de
   david-pantallas-1.png: arriba la patente y el tipo, abajo el historial con
   buscador. Nació de Mauro: "podría haber como una sección donde yo directamente
   voy a sacar los informes vehiculares y que me pueda meter a ver el historial de
   todos los informes que he sacado".

   Es independiente del stock: se saca por patente, tenga o no el auto en el patio.
   Mauro lo explicó: "estos gallos generalmente compran informes cuando van a
   comprar un auto". */
export function InformesScreen({
  informes,
  stock,
  informePatente,
  setInformePatente,
  informeTipo,
  setInformeTipo,
  informeBusqueda,
  setInformeBusqueda,
  handleSacarInforme,
  handleVerInforme,
}: InformesScreenProps) {
  const patenteLista = normalizarPatente(informePatente).length >= 6;

  const busqueda = informeBusqueda.trim().toLowerCase();
  const historial = busqueda
    ? informes.filter((inf) => {
        const auto = autoParaPatente(inf.patente, stock);
        const texto = `${inf.patente} ${inf.tipo} ${auto ? `${auto.marca} ${auto.modelo}` : ''}`;
        return texto.toLowerCase().includes(busqueda);
      })
    : informes;

  return (
    <View style={{ gap: 22 }}>
      <View>
        <Text style={s.h2Black}>Informes</Text>
        <Text style={s.subMuted}>Saca un informe por patente y revisa los que ya pediste</Text>
      </View>

      {/* Sacar uno nuevo */}
      <View style={[s.detailTechCard, { gap: 14 }]}>
        <View style={{ gap: 8 }}>
          <Text style={s.sectionLabel}>Patente del vehículo</Text>
          <TextInput
            placeholder="XXXX00"
            placeholderTextColor={C.slate300}
            value={informePatente}
            onChangeText={(t) => setInformePatente(normalizarPatente(t))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            style={s.patenteInput}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={s.sectionLabel}>Tipo de informe</Text>
          {TIPOS_INFORME.map((tipo) => {
            const activo = informeTipo === tipo;
            return (
              <TouchableOpacity
                key={tipo}
                activeOpacity={0.8}
                onPress={() => setInformeTipo(tipo)}
                style={[s.informeTipoRow, activo && s.informeTipoRowOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={ETIQUETA_TIPO_INFORME[tipo]}
              >
                <View style={[s.informeRadio, activo && s.informeRadioOn]}>
                  {activo ? <View style={s.informeRadioDot} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.informeTipoTitulo}>{ETIQUETA_TIPO_INFORME[tipo]}</Text>
                  <Text style={s.informeTipoSub}>{RESUMEN_TIPO_INFORME[tipo]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* La pantalla de ellos dice "comprar"; acá no, porque la regla ya está
            escrita en el código: la automotora tiene acceso libre y lo que se cobra
            es la copia certificada al cliente. */}
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!patenteLista}
          onPress={handleSacarInforme}
          style={[s.asCtaDark, !patenteLista && s.asCtaDisabled]}
        >
          <Text style={[s.asCtaDarkText, !patenteLista && { color: C.slate400 }]}>Sacar informe</Text>
          {patenteLista ? <Icon name="arrow-right" size={12} color={C.white} /> : null}
        </TouchableOpacity>
      </View>

      {/* Historial */}
      <View style={{ gap: 12 }}>
        {/* El contador sigue a lo que se está viendo: con el buscador puesto decía el
            total y contradecía a la lista de abajo. */}
        <Text style={s.sectionLabel}>
          Informes que has sacado ({historial.length}
          {busqueda && historial.length !== informes.length ? ` de ${informes.length}` : ''})
        </Text>

        <View style={s.searchWrap}>
          <Icon name="magnifying-glass" size={14} color={C.slate400} style={{ marginLeft: 14 }} />
          <TextInput
            placeholder="Buscar por patente, marca o tipo..."
            placeholderTextColor={C.slate400}
            value={informeBusqueda}
            onChangeText={setInformeBusqueda}
            style={s.searchInput}
          />
          {informeBusqueda ? (
            <TouchableOpacity onPress={() => setInformeBusqueda('')} style={{ paddingHorizontal: 12 }}>
              <Icon name="circle-xmark" size={16} color={C.slate400} />
            </TouchableOpacity>
          ) : null}
        </View>

        {historial.length === 0 ? (
          <View style={s.emptyBox}>
            <Icon name="file-lines" size={40} color={C.slate300} />
            <Text style={[s.emptyText, { fontSize: 12 }]}>
              {informes.length === 0 ? 'Todavía no has sacado ningún informe' : 'No encontramos informes con esa búsqueda'}
            </Text>
          </View>
        ) : (
          historial.map((inf) => {
            const auto = autoParaPatente(inf.patente, stock);
            return (
              <TouchableOpacity
                key={inf.id}
                activeOpacity={0.8}
                onPress={() => handleVerInforme(inf)}
                style={s.informeCard}
                accessibilityRole="button"
                accessibilityLabel={`Ver ${ETIQUETA_TIPO_INFORME[inf.tipo]} de ${inf.patente}`}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.informeCardPatente}>{inf.patente}</Text>
                  {auto ? (
                    <Text style={s.informeCardAuto} numberOfLines={1}>
                      {auto.marca} {auto.modelo} · {auto.anio}
                    </Text>
                  ) : null}
                  <View style={s.informeTipoPill}>
                    <Text style={s.informeTipoPillText}>{ETIQUETA_TIPO_INFORME[inf.tipo]}</Text>
                  </View>
                  <Text style={s.informeCardMeta}>Sacado el {fmtFecha(inf.fecha)}</Text>
                </View>
                {/* Estado: en la tabla de Autored todos dicen ENTREGADO. Acá sacar el
                    informe es instantáneo, así que no hay estado intermedio. */}
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <View style={s.informeEstadoPill}>
                    <Text style={s.informeEstadoText}>ENTREGADO</Text>
                  </View>
                  <Icon name="chevron-right" size={14} color={C.slate400} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </View>
  );
}
