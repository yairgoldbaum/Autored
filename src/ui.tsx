import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { C, W } from './theme';

/* ---------------- Icono (FontAwesome6, estilo solid) ---------------- */
export function Icon({
  name,
  size = 16,
  color = C.slate700,
  style,
}: {
  name: React.ComponentProps<typeof FontAwesome6>['name'];
  size?: number;
  color?: string;
  style?: any;
}) {
  return <FontAwesome6 name={name} size={size} color={color} style={style} solid />;
}

/* ---------------- Punto "ping" animado (animate-ping) ---------------- */
export function Ping({ color = C.emerald400, size = 8 }: { color?: string; size?: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 2.2,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

/* ---------------- Icono giratorio (animate-spin) ---------------- */
export function Spinner({ size = 12, color = C.amber600 }: { size?: number; color?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Icon name="spinner" size={size} color={color} />
    </Animated.View>
  );
}

/* ---------------- Wiggle del tacho (trashWiggle) ---------------- */
export function Wiggle({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rot, { toValue: -1, duration: 280, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(rot, { toValue: -0.5, duration: 280, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 0.5, duration: 280, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [rot]);
  const rotate = rot.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] });
  return <Animated.View style={[style, { transform: [{ rotate }] }]}>{children}</Animated.View>;
}

/* ---------------- Pulso suave (pulse-teal) ----------------
   `cycles` limita cuántos rebotes hace (por defecto, infinitos). Cambiar
   `runKey` vuelve a lanzar la animación desde cero. */
export function Pulse({
  children,
  style,
  cycles = -1,
  runKey = 0,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  cycles?: number;
  runKey?: number;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (cycles === 0) return;
    v.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
      cycles > 0 ? { iterations: cycles } : undefined,
    );
    loop.start();
    return () => loop.stop();
  }, [v, cycles, runKey]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/* ---------------- Bottom Sheet reutilizable (animate-slide-up) ----------------
   Overlay absoluto (no Modal nativo): permite apilar sheets sobre pantallas
   completas y mostrar notificaciones encima, igual que el HTML base. */
export function Sheet({
  visible,
  onClose,
  children,
  maxHeightPct,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPct?: number;
}) {
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible, anim]);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [640, 0] });

  return (
    <View style={sheetStyles.container} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, sheetStyles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          sheetStyles.panel,
          maxHeightPct ? { maxHeight: `${maxHeightPct}%` } : null,
          { transform: [{ translateY }] },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/* ---------------- Overlay de página completa (page-transition) ----------------
   Equivale a los paneles absolute inset-0 del HTML (wizard, ficha del auto). */
export function PageOverlay({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [anim]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: anim, transform: [{ translateY }], backgroundColor: C.chileanBg }]}>
      {children}
    </Animated.View>
  );
}

const sheetStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 40,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
});

/* ---------------- Dropdown (reemplazo de <select>) ---------------- */
export function Dropdown({
  value,
  options,
  onChange,
  placeholder,
  style,
  small,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  style?: ViewStyle;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          ddStyles.box,
          { paddingVertical: small ? 10 : 12 },
          style,
        ]}
      >
        <Text
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: small ? 12 : 14,
            fontWeight: W.semibold,
            color: selected ? C.slate800 : C.slate400,
          }}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder || 'Seleccionar'}
        </Text>
        <FontAwesome6 name="chevron-down" size={12} color={C.slate400} solid />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={ddStyles.backdrop} onPress={() => setOpen(false)}>
          <View style={ddStyles.menu}>
            <ScrollView bounces={false}>
              {options.map((o) => {
                const isSel = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={[ddStyles.item, isSel && { backgroundColor: C.slate50 }]}
                  >
                    <Text style={{ fontSize: 14, fontWeight: isSel ? W.bold : W.medium, color: isSel ? C.chileanTeal : C.slate700 }}>
                      {o.label}
                    </Text>
                    {isSel && <FontAwesome6 name="check" size={13} color={C.chileanTeal} solid />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const ddStyles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 12,
    backgroundColor: C.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 32,
  },
  menu: {
    backgroundColor: C.white,
    borderRadius: 16,
    maxHeight: 320,
    overflow: 'hidden',
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.slate100,
  },
});
