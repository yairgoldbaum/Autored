import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { C } from '../src/theme';
import { Icon, Pulse } from '../src/ui';
import { s } from '../src/styles';

interface InicioScreenProps {
  motorRebotes: number;
  inicioVisitas: number;
  handleAbrirMotor: () => void;
}

/* ======================= PANTALLA INICIO ======================= */
export function InicioScreen({ motorRebotes, inicioVisitas, handleAbrirMotor }: InicioScreenProps) {
  return (
    <View style={{ gap: 22 }}>
      <View style={s.homeGreeting}>
        <Text style={s.h2}>Hola</Text>
        <Text style={s.subMuted}>¿Qué auto ingresará al stock hoy?</Text>
      </View>

      {/* MOTOR DE PRECIOS — acceso principal, un solo botón */}
      <Pulse cycles={motorRebotes} runKey={inicioVisitas}>
        <TouchableOpacity activeOpacity={0.85} onPress={handleAbrirMotor} style={s.motorBtn}>
          <View style={s.motorBtnIcon}>
            <Icon name="gauge-high" size={30} color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.motorBtnTitle}>Motor de Precios</Text>
            <Text style={s.motorBtnSub}>¿Cuánto le ofrezco por su auto?</Text>
          </View>
          <Icon name="chevron-right" size={16} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </Pulse>

      {/* Las tarjetas y los gráficos se mudaron a su propia pestaña de KPIs. */}
    </View>
  );
}
