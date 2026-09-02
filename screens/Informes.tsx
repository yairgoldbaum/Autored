import React from 'react';
import { Text, View } from 'react-native';

import { C } from '../src/theme';
import { Icon } from '../src/ui';
import { s } from '../src/styles';

/* Sección nueva de la ronda 3 (punto 4). Nació de Mauro: "podría haber como una
   sección donde yo directamente voy a sacar los informes vehiculares y que me pueda
   meter a ver el historial de todos los informes que he sacado". Es independiente
   del stock: se compra por patente, tenga o no el auto en el patio.
   Acá va el andamio: la pantalla se llena en su propio punto del plan. */
export function InformesScreen() {
  return (
    <View style={{ gap: 22 }}>
      <View>
        <Text style={s.h2Black}>Informes</Text>
        <Text style={s.subMuted}>Saca un informe por patente y revisa los que ya pediste</Text>
      </View>

      <View style={s.emptyBox}>
        <Icon name="file-lines" size={40} color={C.slate300} />
        <Text style={[s.emptyText, { fontSize: 12 }]}>En construcción</Text>
      </View>
    </View>
  );
}
