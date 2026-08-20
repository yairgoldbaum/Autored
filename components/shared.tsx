/* Componentes compartidos por más de una pantalla. Presentacionales: reciben lo
   que necesitan y no tocan estado de nadie. */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { C, W, fmtCLP, fmtMiles } from '../src/theme';
import { Icon } from '../src/ui';
import { s } from '../src/styles';
import { Car, MODELOS_BUSCADOS, VehicleContact, VeredictoAutosave } from '../src/data';
import { buscarPatente, tasar } from '../src/pricing';
import { FiltroDias, hasContactData, veredictoColor } from '../src/helpers';

/* ---------------- Dashboard de inicio ---------------- */
export function KpiCard({ label, value, insight, color }: { label: string; value: string; insight: string; color: string }) {
  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiLabel}>{label}</Text>
      {/* Lo único que pidieron Jorge y Mauro sobre los KPIs: que el monto no se
          parta en dos líneas. Se achica solo antes de cortarse. */}
      <Text style={s.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      <Text style={[s.kpiInsight, { color }]}>{insight}</Text>
    </View>
  );
}

/* Las barras son navegables: tocar una abre el Stock con ese filtro aplicado. */
export const RANGO_POR_TRAMO: Record<string, FiltroDias> = {
  '0–30 d': '0-30',
  '31–60 d': '31-60',
  '+60 d': '+60',
};

export function BarsAntiguedad({
  data,
  onPressBar,
}: {
  data: { label: string; cantidad: number; color: string }[];
  onPressBar?: (rango: FiltroDias) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.cantidad));
  return (
    <View style={s.barsRow}>
      {data.map((d) => (
        <TouchableOpacity
          key={d.label}
          activeOpacity={onPressBar && d.cantidad > 0 ? 0.7 : 1}
          disabled={!onPressBar || d.cantidad === 0}
          onPress={() => onPressBar?.(RANGO_POR_TRAMO[d.label] ?? null)}
          style={s.barCol}
        >
          <Text style={s.barValue}>{d.cantidad}</Text>
          <View style={s.barTrack}>
            <View
              style={[s.barFill, { height: `${(d.cantidad / max) * 100}%`, backgroundColor: d.color }]}
            />
          </View>
          <Text style={s.barLabel}>{d.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function BarsEstado({
  data,
  total,
  onPressBar,
}: {
  data: { estado: string; cantidad: number }[];
  total: number;
  onPressBar?: (estado: string) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.cantidad));
  return (
    <View style={{ gap: 10 }}>
      {data.map((d) => (
        <TouchableOpacity
          key={d.estado}
          activeOpacity={onPressBar && d.cantidad > 0 ? 0.7 : 1}
          disabled={!onPressBar || d.cantidad === 0}
          onPress={() => onPressBar?.(d.estado)}
          style={s.hbarRow}
        >
          <Text style={s.hbarLabel} numberOfLines={1}>
            {d.estado}
          </Text>
          <View style={s.hbarTrack}>
            <View style={[s.hbarFill, { width: `${(d.cantidad / max) * 100}%` }]} />
          </View>
          <Text style={s.hbarValue}>{d.cantidad}</Text>
        </TouchableOpacity>
      ))}
      <Text style={s.chartFoot}>
        {total} {total === 1 ? 'auto activo' : 'autos activos'} en total
      </Text>
    </View>
  );
}

export function NavButton({
  icon,
  label,
  active,
  onPress,
  badge,
}: {
  icon: any;
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const color = active ? C.chileanTeal : C.slate400;
  return (
    <TouchableOpacity onPress={onPress} style={s.navBtn} activeOpacity={0.7}>
      <View>
        <Icon name={icon} size={18} color={color} />
        {badge && badge > 0 ? (
          <View style={s.navBadge}>
            <Text style={s.navBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[s.navLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SegBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.segBtn, active && s.segBtnActive]} activeOpacity={0.8}>
      <Text style={{ fontSize: 12, fontWeight: W.bold, color: active ? C.slate800 : C.slate600 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export const CAL_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const CAL_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/* Motor de precios en modo publicación: cuánto pedir por un auto que YA es tuyo.

   Componente aparte desde el principio porque P1 lo reusa en la ficha del auto (es
   el sexto cruce de cruces-p1-p2.md). Recibe lo que necesita y no toca estado de
   nadie.

   Muestra el precio sugerido y los comparables, y a propósito NO muestra el rango de
   oferta ni el margen al piso o al techo: esos son de la decisión de compra, y acá el
   auto ya está en el patio y lo que se decide es a cuánto publicarlo. Esa versión
   completa vive en renderMotorPrecios, entrando desde el Inicio.

   src/pricing.ts resuelve la referencia de mercado desde la patente; los datos que el
   usuario ya escribió (marca, modelo, año) mandan sobre lo que devuelve el registro,
   para que los comparables hablen del auto que está cargando. */
export function MotorPreciosPublicacion({
  patente,
  km,
  vehiculo,
  emptyText = 'Completa la patente y el kilometraje en el paso anterior y acá aparece el precio sugerido.',
}: {
  patente: string;
  km: number;
  vehiculo: Pick<Car, 'marca' | 'modelo' | 'version' | 'anio' | 'transmision' | 'combustible'>;
  // El texto del estado vacío depende de dónde vive el componente: en el alta
  // habla del paso anterior; en la ficha, del expediente del auto.
  emptyText?: string;
}) {
  const registro = buscarPatente(patente);
  if (!registro || km <= 0) {
    return (
      <View style={s.motorAltaEmpty}>
        <Icon name="wand-magic-sparkles" size={14} color={C.slate400} />
        <Text style={s.motorAltaEmptyText}>{emptyText}</Text>
      </View>
    );
  }

  const t = tasar(
    {
      ...registro,
      marca: vehiculo.marca || registro.marca,
      modelo: vehiculo.modelo || registro.modelo,
      version: vehiculo.version || registro.version,
      anio: vehiculo.anio || registro.anio,
      transmision: vehiculo.transmision || registro.transmision,
      combustible: vehiculo.combustible || registro.combustible,
    },
    km,
  );

  return (
    <View style={s.motorAltaBox}>
      <View style={s.rowBetween}>
        <View style={s.rowCenter}>
          <Icon name="wand-magic-sparkles" size={13} color={C.teal700} />
          <Text style={s.motorAltaTitle}> Precio sugerido</Text>
        </View>
        <View style={s.motorConfTag}>
          <Text style={s.motorConfText}>{t.confianza}% confianza</Text>
        </View>
      </View>

      <Text style={s.motorAltaPrecio} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {fmtCLP(t.precioVenta)}
      </Text>
      <Text style={s.motorAltaSub}>
        Referencia {t.vehiculo.anio} {fmtCLP(t.vehiculo.referencia)} · ajuste por {fmtMiles(km)} km{' '}
        {t.ajusteKm >= 0 ? '+' : '−'}
        {fmtCLP(Math.abs(t.ajusteKm)).replace('-', '')}
      </Text>

      <View style={{ gap: 6, marginTop: 12 }}>
        <Text style={s.sectionLabel}>Publicaciones similares</Text>
        {t.comparables.map((c) => (
          <View key={c.fuente} style={s.motorCompRow}>
            <View style={{ flex: 1 }}>
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
    </View>
  );
}

/* Qué busca el cliente. Es texto libre con sugerencias y NO un selector del stock
   propio: registrar interés en un auto que todavía no tienes es justo el caso que
   la app no sabía representar. Las sugerencias son ayuda de tipeo, no una lista
   cerrada. */
export function ModeloBuscadoField({
  modelo,
  comentario,
  onChangeModelo,
  onChangeComentario,
}: {
  modelo: string;
  comentario: string;
  onChangeModelo: (v: string) => void;
  onChangeComentario: (v: string) => void;
}) {
  const q = modelo.trim().toLowerCase();
  const sugerencias = !q
    ? []
    : MODELOS_BUSCADOS.filter((m) => m.toLowerCase().includes(q) && m.toLowerCase() !== q).slice(0, 6);

  return (
    <>
      <View>
        <Text style={s.sheetFieldLabel}>Qué busca</Text>
        <TextInput
          placeholder="Ej: Kia Morning (o lo que sea, aunque no lo tengas)"
          placeholderTextColor={C.slate400}
          value={modelo}
          onChangeText={onChangeModelo}
          style={s.sheetInput}
        />
        {sugerencias.length > 0 ? (
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingTop: 8 }}
          >
            {sugerencias.map((m) => (
              <TouchableOpacity key={m} activeOpacity={0.8} onPress={() => onChangeModelo(m)} style={s.sugerenciaChip}>
                <Text style={s.sugerenciaText}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>
      <View>
        <Text style={s.sheetFieldLabel}>Comentario</Text>
        <TextInput
          placeholder="Ej: automático, tope 7 millones"
          placeholderTextColor={C.slate400}
          value={comentario}
          onChangeText={onChangeComentario}
          multiline
          style={[s.sheetInput, { minHeight: 60, paddingTop: 10, textAlignVertical: 'top' }]}
        />
      </View>
    </>
  );
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  optional,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  const selectedDate = parseIsoDate(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => selectedDate || new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = buildCalendarCells(year, month);

  useEffect(() => {
    if (open) setCursor(selectedDate || new Date());
  }, [open, value]);

  const moveMonth = (delta: number) => {
    setCursor(new Date(year, month + delta, 1));
  };

  const selectDay = (day: number) => {
    onChange(formatIsoDate(new Date(year, month, day)));
    setOpen(false);
  };

  const selectToday = () => {
    onChange(formatIsoDate(new Date()));
    setOpen(false);
  };

  return (
    <View>
      <Text style={s.fieldLabel}>
        {label}
        {optional ? ' (opcional)' : ''}
      </Text>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen(true)} style={s.dateField}>
        <Icon name="calendar-days" size={14} color={C.slate500} />
        <Text style={[s.dateFieldText, !value && { color: C.slate400 }]}>{value || placeholder}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={s.calendarBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={s.calendarCard}>
            <View style={s.calendarHeader}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => moveMonth(-1)} style={s.calendarNavBtn}>
                <Icon name="chevron-left" size={12} color={C.slate700} />
              </TouchableOpacity>
              <Text style={s.calendarTitle}>
                {CAL_MONTHS[month]} {year}
              </Text>
              <TouchableOpacity activeOpacity={0.8} onPress={() => moveMonth(1)} style={s.calendarNavBtn}>
                <Icon name="chevron-right" size={12} color={C.slate700} />
              </TouchableOpacity>
            </View>
            <View style={s.calendarWeekRow}>
              {CAL_DAYS.map((day, index) => (
                <Text key={`${day}-${index}`} style={s.calendarWeekText}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={s.calendarGrid}>
              {cells.map((day, index) => {
                const isSelected = !!selectedDate && day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
                return (
                  <TouchableOpacity
                    key={`${day || 'blank'}-${index}`}
                    disabled={!day}
                    activeOpacity={0.78}
                    onPress={() => day && selectDay(day)}
                    style={[s.calendarDay, isSelected && s.calendarDaySelected]}
                  >
                    <Text style={[s.calendarDayText, isSelected && s.calendarDayTextSelected]}>{day || ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.calendarFooter}>
              <TouchableOpacity activeOpacity={0.8} onPress={selectToday} style={s.calendarTodayBtn}>
                <Text style={s.calendarTodayText}>Hoy</Text>
              </TouchableOpacity>
              {optional && value ? (
                <TouchableOpacity activeOpacity={0.8} onPress={() => { onChange(''); setOpen(false); }} style={s.calendarClearBtn}>
                  <Text style={s.calendarClearText}>Limpiar</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity activeOpacity={0.8} onPress={() => setOpen(false)} style={s.calendarDoneBtn}>
                <Text style={s.calendarDoneText}>Listo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function parseIsoDate(value: string) {
  if (!value) return null;
  const parts = value.split('-').map((part) => parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function formatIsoDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function buildCalendarCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < mondayOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function Field({
  label,
  placeholder,
  value,
  onChange,
  keyboardType,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (t: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
}) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={C.slate400}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType || 'default'}
        style={s.textInput}
      />
    </View>
  );
}

export function MultilineField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (t: string) => void;
}) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={C.slate400}
        value={value}
        onChangeText={onChange}
        multiline
        textAlignVertical="top"
        style={s.textArea}
      />
    </View>
  );
}

export function ToggleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={[s.toggleChip, active && s.toggleChipActive]}>
      {active && <Icon name="check" size={9} color={C.white} />}
      <Text style={[s.toggleChipText, active && { color: C.white }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function TechItem({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ width: '48%' }}>
      <Text style={s.techLabel}>{label}</Text>
      <Text style={[s.techValue, warn && { color: C.amber600 }]}>{value}</Text>
    </View>
  );
}

export function ReportRow({
  label,
  value,
  veredicto,
  last,
}: {
  label: string;
  value: string;
  veredicto: VeredictoAutosave;
  last?: boolean;
}) {
  const col = veredictoColor(veredicto);
  const icono = veredicto === 'ok' ? 'check' : veredicto === 'atencion' ? 'triangle-exclamation' : 'xmark';
  return (
    <View style={[s.asReportRow, last && { borderBottomWidth: 0 }]}>
      <Text style={s.asReportRowLabel}>{label}</Text>
      <View style={s.asReportRowRight}>
        <Text style={[s.asReportRowValue, { color: col.text }]} numberOfLines={2}>
          {value}
        </Text>
        <Icon name={icono as any} size={11} color={col.color} />
      </View>
    </View>
  );
}

export function TransferMetaRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.asMetaRow}>
      <Text style={s.asMetaRowLabel}>{label}</Text>
      <Text style={[s.asMetaRowValue, strong && { color: C.slate800, fontWeight: W.extrabold }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function PartyRow({ rol, contacto }: { rol: string; contacto: VehicleContact | null }) {
  const tiene = hasContactData(contacto);
  return (
    <View style={s.asPartyRow}>
      <Text style={s.asPartyRol}>{rol}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={s.asPartyName}>{tiene && contacto ? contacto.nombre : 'Sin registrar'}</Text>
        {tiene && contacto?.telefono ? <Text style={s.asPartyPhone}>{contacto.telefono}</Text> : null}
      </View>
    </View>
  );
}

export function VehicleContactCard({
  title,
  contact,
  emptyText,
  onCall,
  onWhatsapp,
}: {
  title: string;
  contact: VehicleContact | null;
  emptyText: string;
  onCall: (telefono: string) => void;
  onWhatsapp: (telefono: string) => void;
}) {
  const hasContact = hasContactData(contact);
  return (
    <View style={s.vehicleContactCard}>
      <View style={{ flex: 1 }}>
        <Text style={s.vehicleContactLabel}>{title}</Text>
        {hasContact && contact ? (
          <>
            <Text style={s.vehicleContactName}>{contact.nombre || 'Sin nombre'}</Text>
            <Text style={s.vehicleContactPhone}>{contact.telefono || 'Sin teléfono'}</Text>
          </>
        ) : (
          <Text style={s.emptySectionText}>{emptyText}</Text>
        )}
      </View>
      {hasContact && contact ? (
        <View style={s.vehicleContactActions}>
          <TouchableOpacity onPress={() => onCall(contact.telefono)} style={s.vehicleContactBtn}>
            <Icon name="phone" size={11} color={C.slate700} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onWhatsapp(contact.telefono)} style={[s.vehicleContactBtn, { backgroundColor: C.slate800 }]}>
            <Icon name="comment-dots" size={12} color={C.white} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export function NotificationBanner({ message, type, top }: { message: string; type?: string; top: number }) {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -6, duration: 400, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);
  const isWarning = type === 'warning';
  return (
    <Animated.View
      style={[
        s.notif,
        isWarning && { backgroundColor: C.amber700, borderColor: C.amber500 },
        { top, transform: [{ translateY: bounce }] },
      ]}
    >
      <Icon name={isWarning ? 'triangle-exclamation' : 'circle-check'} size={18} color={isWarning ? C.amber200 : C.teal300} />
      <Text style={s.notifText}>{message}</Text>
    </Animated.View>
  );
}

/* Galería deslizable real (el HTML solo la simulaba con "1 / N" fijo) */
export function PhotoGallery({ fotos }: { fotos: string[] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(Math.max(0, Math.min(i, fotos.length - 1)));
  };

  if (fotos.length === 0) {
    return (
      <View style={[s.gallery, s.galleryEmpty]}>
        <Icon name="camera" size={32} color={C.slate300} />
        <Text style={s.galleryEmptyText}>Sin fotos del vehículo</Text>
      </View>
    );
  }

  return (
    <View style={s.gallery} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          onScroll={onScroll}
          scrollEventThrottle={64}
        >
          {fotos.map((f, i) => (
            <Image key={`${f}-${i}`} source={{ uri: f }} style={{ width, height: 224 }} resizeMode="cover" />
          ))}
        </ScrollView>
      )}
      <View style={s.galleryCount}>
        <Text style={s.galleryCountText}>
          {index + 1} / {fotos.length}
        </Text>
      </View>
      {fotos.length > 1 && (
        <View style={s.galleryDots}>
          {fotos.map((_, i) => (
            <View key={i} style={[s.galleryDot, i === index && s.galleryDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}
