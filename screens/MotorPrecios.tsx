import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, fmtCLP, fmtMiles } from '../src/theme';
import { Icon, PageOverlay, Spinner } from '../src/ui';
import { s } from '../src/styles';
import { PATENTES_DEMO, Tasacion, normalizarPatente } from '../src/pricing';

interface MotorPreciosOverlayProps {
  isMotorOpen: boolean;
  setIsMotorOpen: (open: boolean) => void;
  motorPatente: string;
  setMotorPatente: React.Dispatch<React.SetStateAction<string>>;
  motorKm: string;
  setMotorKm: React.Dispatch<React.SetStateAction<string>>;
  motorCalculando: boolean;
  tasacion: Tasacion | null;
  setTasacion: React.Dispatch<React.SetStateAction<Tasacion | null>>;
  handleTasar: () => void;
  handleTomarAuto: () => void;
}

/* ======================= MOTOR DE PRECIOS ======================= */
export function MotorPreciosOverlay({
  isMotorOpen,
  setIsMotorOpen,
  motorPatente,
  setMotorPatente,
  motorKm,
  setMotorKm,
  motorCalculando,
  tasacion,
  setTasacion,
  handleTasar,
  handleTomarAuto,
}: MotorPreciosOverlayProps) {
  const insets = useSafeAreaInsets();

  return renderMotorPrecios();

  function renderMotorPrecios() {
    if (!isMotorOpen) return null;
    const patenteOk = normalizarPatente(motorPatente).length >= 5;
    const kmNum = parseInt(motorKm.replace(/\D/g, ''), 10) || 0;
    const listo = patenteOk && kmNum > 0;

    return (
      <PageOverlay>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {/* Header */}
          <View style={[s.overlayHeader, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity onPress={() => setIsMotorOpen(false)} style={s.rowCenter}>
              <Icon name="xmark" size={18} color={C.slate400} />
              <Text style={s.cancelText}> Cerrar</Text>
            </TouchableOpacity>
            <Text style={s.overlayTitle}>Motor de Precios</Text>
            <View style={s.stepPill}>
              <Text style={s.stepPillText}>Demo</Text>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text style={s.stepTitle}>Tasación express</Text>
              <Text style={s.stepSub}>
                El cliente te ofrece su auto. Ingresa la patente y el kilometraje para saber cuánto puedes pagarle.
              </Text>
            </View>

            {/* Paso 1: patente */}
            <View style={s.motorField}>
              <Text style={s.fieldLabel}>1. Patente del vehículo</Text>
              <TextInput
                placeholder="KDPT45"
                placeholderTextColor={C.slate400}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
                value={motorPatente}
                onChangeText={(t) => {
                  setMotorPatente(normalizarPatente(t));
                  setTasacion(null);
                }}
                style={s.patenteInput}
              />
              <View style={s.motorDemoRow}>
                <Text style={s.motorDemoLabel}>Prueba con:</Text>
                {PATENTES_DEMO.map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      setMotorPatente(p);
                      setTasacion(null);
                    }}
                    style={s.motorDemoChip}
                  >
                    <Text style={s.motorDemoChipText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Paso 2: kilometraje */}
            <View style={s.motorField}>
              <Text style={s.fieldLabel}>2. Kilometraje</Text>
              <View style={s.motorKmWrap}>
                <TextInput
                  placeholder="58000"
                  placeholderTextColor={C.slate400}
                  keyboardType="number-pad"
                  value={motorKm}
                  onChangeText={(t) => {
                    setMotorKm(t.replace(/\D/g, ''));
                    setTasacion(null);
                  }}
                  style={s.motorKmInput}
                />
                <Text style={s.motorKmSuffix}>km</Text>
              </View>
              {kmNum > 0 && <Text style={s.motorKmHint}>{fmtMiles(kmNum)} km recorridos</Text>}
            </View>

            {/* Botón tasar */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleTasar}
              disabled={!listo || motorCalculando}
              style={[s.motorTasarBtn, (!listo || motorCalculando) && { backgroundColor: C.slate300 }]}
            >
              {motorCalculando ? (
                <Spinner size={14} color={C.white} />
              ) : (
                <Icon name="bolt" size={14} color={C.white} />
              )}
              <Text style={s.motorTasarText}>
                {motorCalculando ? 'Calculando precio…' : 'Calcular oferta'}
              </Text>
            </TouchableOpacity>

            {/* Resultado */}
            {tasacion && renderTasacion(tasacion)}
          </ScrollView>
        </KeyboardAvoidingView>
      </PageOverlay>
    );
  }

  function renderTasacion(t: Tasacion) {
    const v = t.vehiculo;
    const kmSobre = t.km > t.kmEsperado;
    return (
      <View style={{ gap: 16 }}>
        {/* Auto identificado */}
        <View style={s.motorCarBox}>
          <View style={s.motorCarIcon}>
            <Icon name="car-side" size={18} color={C.teal700} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.motorCarTitle}>
              {v.marca} {v.modelo} {v.anio}
            </Text>
            <Text style={s.motorCarSub}>
              {v.version} · {v.transmision} · {v.combustible}
            </Text>
          </View>
          <View style={s.motorConfTag}>
            <Text style={s.motorConfText}>{t.confianza}% confianza</Text>
          </View>
        </View>

        {/* LA CIFRA: rango de compra */}
        <View style={s.motorResultBox}>
          <Text style={s.motorResultLabel}>Ofrécele al cliente entre</Text>
          <Text style={s.motorResultRange} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {fmtCLP(t.ofertaMin)}
          </Text>
          <Text style={s.motorResultAnd}>y</Text>
          <Text style={s.motorResultRange} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {fmtCLP(t.ofertaMax)}
          </Text>
          <View style={s.motorResultFoot}>
            <Icon name="circle-info" size={11} color={C.teal200} />
            <Text style={s.motorResultFootText}>
              Equivale a un 25%–30% bajo el precio de venta. Parte ofreciendo el piso.
            </Text>
          </View>
        </View>

        {/* Cómo se llegó a la cifra */}
        <View style={s.motorBreakdown}>
          <Text style={s.motorBreakTitle}>Cómo se calculó</Text>

          <View style={s.motorBreakRow}>
            <Text style={s.motorBreakLabel}>Precio de venta estimado</Text>
            <Text style={s.motorBreakValueStrong}>{fmtCLP(t.precioVenta)}</Text>
          </View>
          <View style={s.motorBreakRow}>
            <Text style={s.motorBreakLabel}>Referencia de mercado {v.anio}</Text>
            <Text style={s.motorBreakValue}>{fmtCLP(v.referencia)}</Text>
          </View>
          <View style={s.motorBreakRow}>
            <Text style={s.motorBreakLabel}>
              Ajuste por kilometraje ({fmtMiles(t.km)} vs {fmtMiles(t.kmEsperado)} esperados)
            </Text>
            <Text style={[s.motorBreakValue, { color: kmSobre ? C.red600 : C.emerald600 }]}>
              {t.ajusteKm >= 0 ? '+' : '−'}
              {fmtCLP(Math.abs(t.ajusteKm)).replace('-', '')}
            </Text>
          </View>
          <View style={[s.motorBreakRow, s.motorBreakRowLast]}>
            <Text style={s.motorBreakLabel}>Tu margen bruto</Text>
            <Text style={[s.motorBreakValueStrong, { color: C.emerald600 }]}>
              {fmtCLP(t.margenMin)} – {fmtCLP(t.margenMax)}
            </Text>
          </View>
        </View>

        {/* Comparables imaginarios */}
        <View style={{ gap: 8 }}>
          <Text style={s.sectionLabel}>Publicaciones similares</Text>
          {t.comparables.map((c) => (
            <View key={c.fuente} style={s.motorCompRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.motorCompTitle} numberOfLines={1}>
                  {c.titulo}
                </Text>
                <Text style={s.motorCompSub}>
                  {c.fuente} · {fmtMiles(c.km)} km
                </Text>
              </View>
              <Text style={s.motorCompPrice}>{fmtCLP(c.precio)}</Text>
            </View>
          ))}
        </View>

        {/* Acciones */}
        <TouchableOpacity activeOpacity={0.9} onPress={handleTomarAuto} style={s.motorTakeBtn}>
          <Icon name="plus" size={13} color={C.white} />
          <Text style={s.motorTakeText}>Cerrar trato y cargar al stock</Text>
        </TouchableOpacity>

        <Text style={s.motorDisclaimer}>
          Prueba de concepto: valores simulados localmente, sin conexión a una base de datos real.
        </Text>
      </View>
    );
  }
}
