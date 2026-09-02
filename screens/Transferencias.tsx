import React from 'react';
import { Text, View } from 'react-native';

import { C } from '../src/theme';
import { Icon } from '../src/ui';
import { s } from '../src/styles';

/* Sección nueva de la ronda 3 (punto 5), con el alcance que recortó el propio
   David: "que pongan esa vista de tabla, que vean el ejemplo que tiene todas sus
   transferencias, que pueda crear una transferencia y que lo lleve a la pantalla
   inicial donde selecciona el tipo. Hasta ahí es suficiente".
   Acá va el andamio: la pantalla se llena en su propio punto del plan. */
export function TransferenciasScreen() {
  return (
    <View style={{ gap: 22 }}>
      <View>
        <Text style={s.h2Black}>Transferencias</Text>
        <Text style={s.subMuted}>En qué va cada solicitud y cómo empezar una nueva</Text>
      </View>

      <View style={s.emptyBox}>
        <Icon name="right-left" size={40} color={C.slate300} />
        <Text style={[s.emptyText, { fontSize: 12 }]}>En construcción</Text>
      </View>
    </View>
  );
}
