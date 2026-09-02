import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { C, fmtCLP, fmtMiles } from '../src/theme';
import { Icon, Spinner } from '../src/ui';
import { s } from '../src/styles';
import {
  ETIQUETA_COMERCIALIDAD,
  PATENTES_DEMO,
  RangoPrecio,
  TasacionAutored,
  normalizarPatente,
} from '../src/pricing';

interface MotorPreciosScreenProps {
  motorPatente: string;
  setMotorPatente: React.Dispatch<React.SetStateAction<string>>;
  motorKm: string;
  setMotorKm: React.Dispatch<React.SetStateAction<string>>;
  motorCalculando: boolean;
  tasacion: TasacionAutored | null;
  setTasacion: React.Dispatch<React.SetStateAction<TasacionAutored | null>>;
  handleTasar: () => void;
  handleTomarAuto: () => void;
}

/* Motor de Precios con la cara de Autored (ronda 3, punto 6). Arriba la estructura de
   david-pantallas-4.png (AutoRed Analytics): búsqueda por patente, las tres tarjetas
   de precio con su rango, la comercialidad en estrellas y el resumen del vehículo.
   Abajo, la lista de publicaciones similares de david-pantallas-3.png, que es lo que
   avala esos precios.

   Las dos capturas van en una sola pantalla: David dijo que las dos servían de
   contexto pero no dijo cómo combinarlas, y en un teléfono no caben dos.

   Lo que se perdió respecto de la versión anterior: el rango de oferta y el margen,
   que no existen en el motor de ellos. Vale preguntárselo a Autored cuando salgan con
   clientes reales. Las tasaciones fiscales, los precios 0 km y el estado del vehículo
   del screenshot quedan fuera: son tablas anchas que en móvil piden diseño propio y
   David pidió grandes rasgos. */
export function MotorPreciosScreen({
  motorPatente,
  setMotorPatente,
  motorKm,
  setMotorKm,
  motorCalculando,
  tasacion,
  setTasacion,
  handleTasar,
  handleTomarAuto,
}: MotorPreciosScreenProps) {
  const patenteOk = normalizarPatente(motorPatente).length >= 5;
  const kmNum = parseInt(motorKm.replace(/\D/g, ''), 10) || 0;
  const listo = patenteOk && kmNum > 0;

  return (
    <View style={{ gap: 22 }}>
      <View>
        <Text style={s.h2Black}>Motor de Precios</Text>
        <Text style={s.subMuted}>Pon una patente y mira a cuánto se está moviendo ese auto</Text>
      </View>

      {/* Búsqueda */}
      <View style={[s.detailTechCard, { gap: 14 }]}>
        <View style={{ gap: 8 }}>
          <Text style={s.sectionLabel}>Patente</Text>
          <TextInput
            placeholder="XXXX00"
            placeholderTextColor={C.slate300}
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

        <View style={{ gap: 8 }}>
          <Text style={s.sectionLabel}>Kilometraje</Text>
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
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleTasar}
          disabled={!listo || motorCalculando}
          style={[s.motorTasarBtn, (!listo || motorCalculando) && { backgroundColor: C.slate300 }]}
        >
          {motorCalculando ? <Spinner size={14} color={C.white} /> : <Icon name="magnifying-glass" size={13} color={C.white} />}
          <Text style={s.motorTasarText}>{motorCalculando ? 'Buscando precios…' : 'Buscar'}</Text>
        </TouchableOpacity>
      </View>

      {tasacion ? renderResultado(tasacion) : null}
    </View>
  );

  function renderResultado(t: TasacionAutored) {
    const v = t.vehiculo;
    return (
      <View style={{ gap: 22 }}>
        {/* Título y comercialidad, como el encabezado del resultado de ellos */}
        <View style={{ gap: 8 }}>
          <Text style={s.h2Black}>
            {v.marca} {v.modelo} {v.anio}
          </Text>
          <View style={[s.mpEstrellas, { gap: 6 }]}>
            <Text style={s.mpComercialidadText}>Comercialidad:</Text>
            <View style={s.mpEstrellas}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon
                  key={i}
                  name="star"
                  size={12}
                  color={i <= t.comercialidad ? C.amber500 : C.slate200}
                />
              ))}
            </View>
            <Text style={[s.mpComercialidadText, { color: C.slate400 }]}>
              {ETIQUETA_COMERCIALIDAD[t.comercialidad]}
            </Text>
          </View>
        </View>

        {/* Los tres precios. El de venta va destacado, como en la captura. */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {renderPrecio('Precio de toma', t.precioToma, t.rangoToma, false)}
            {renderPrecio('Precio de publicación', t.precioPublicacion, t.rangoPublicacion, false)}
          </View>
          {renderPrecio('Precio de venta', t.precioVenta, t.rangoVenta, true)}
          <Text style={[s.mpPubMeta, { textAlign: 'center' }]}>
            Precios calculados para un vehículo con {fmtMiles(t.km)} km
          </Text>
        </View>

        {/* Resumen del vehículo */}
        <View style={s.detailTechCard}>
          <Text style={s.detailTechTitle}>Resumen del vehículo</Text>
          <View style={s.mpResumenRow}>
            <Text style={s.mpResumenLabel}>Patente</Text>
            <Text style={s.mpResumenValor}>{t.patente}</Text>
          </View>
          <View style={s.mpResumenRow}>
            <Text style={s.mpResumenLabel}>Versión</Text>
            <Text style={s.mpResumenValor} numberOfLines={1}>
              {v.version}
            </Text>
          </View>
          <View style={s.mpResumenRow}>
            <Text style={s.mpResumenLabel}>Transmisión</Text>
            <Text style={s.mpResumenValor}>{v.transmision}</Text>
          </View>
          <View style={[s.mpResumenRow, { borderBottomWidth: 0 }]}>
            <Text style={s.mpResumenLabel}>Combustible</Text>
            <Text style={s.mpResumenValor}>{v.combustible}</Text>
          </View>
        </View>

        {/* Publicaciones que avalan los precios */}
        <View style={{ gap: 8 }}>
          <Text style={s.sectionLabel}>
            Publicaciones similares ({t.publicaciones.length})
          </Text>
          {t.publicaciones.map((pub, i) => (
            <View key={`${pub.titulo}-${i}`} style={s.mpPubRow}>
              <Text style={s.mpPubTitulo} numberOfLines={1}>
                {pub.titulo}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <Text style={s.mpPubMeta} numberOfLines={1}>
                  {fmtMiles(pub.km)} km · {pub.ubicacion}
                </Text>
                <Text style={s.mpPubPrecio}>{fmtCLP(pub.precio)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Se conserva de la versión anterior: pasar del motor al alta con el auto
            precargado. No está en la pantalla de Autored, pero es el único puente que
            había entre tasar y cargar, y el precio de toma lo hace natural. */}
        <TouchableOpacity activeOpacity={0.85} onPress={handleTomarAuto} style={s.asCtaDark}>
          <Text style={s.asCtaDarkText}>Tomar este auto</Text>
          <Icon name="arrow-right" size={12} color={C.white} />
        </TouchableOpacity>
      </View>
    );
  }

  function renderPrecio(label: string, valor: number, rango: RangoPrecio, fuerte: boolean) {
    return (
      <View style={[s.mpPrecioCard, fuerte && s.mpPrecioCardFuerte]}>
        <Text style={[s.mpPrecioLabel, fuerte && s.mpPrecioLabelFuerte]}>{label}</Text>
        <Text
          style={[s.mpPrecioValor, fuerte && s.mpPrecioValorFuerte]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {fmtCLP(valor)}
        </Text>
        <Text style={s.mpRangoLabel}>RANGO</Text>
        <View style={s.mpRangoRow}>
          <View style={[s.mpRangoPill, fuerte && s.mpRangoPillFuerte]}>
            <Text style={[s.mpRangoText, fuerte && s.mpRangoTextFuerte]}>{fmtCLP(rango.min)}</Text>
          </View>
          <Icon name="left-right" size={9} color={fuerte ? C.slate400 : C.slate300} />
          <View style={[s.mpRangoPill, fuerte && s.mpRangoPillFuerte]}>
            <Text style={[s.mpRangoText, fuerte && s.mpRangoTextFuerte]}>{fmtCLP(rango.max)}</Text>
          </View>
        </View>
      </View>
    );
  }
}
