import React from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, fmtCLP } from '../src/theme';
import { Dropdown, Icon, PageOverlay } from '../src/ui';
import { s } from '../src/styles';
import { Car, ESTADOS, EstadoAuto, costoBase } from '../src/data';
import {
  COMBUSTIBLE_OPTIONS,
  EQUIPAMIENTO_OPTIONS,
  MARCA_OPTIONS,
  PUERTAS_OPTIONS,
  SUCURSAL_OPTIONS,
  TIPO_VEHICULO_OPTIONS,
  TRACCION_OPTIONS,
  TRANSMISION_OPTIONS,
  WIZARD_PASOS,
  WizardData,
  emptyContact,
  optionsWithCurrent,
  requiresBuyer,
} from '../src/helpers';
import {
  DateField,
  Field,
  MotorPreciosPublicacion,
  MultilineField,
  ToggleChip,
} from '../components/shared';

interface AltaVehiculoWizardProps {
  isCargarAutoOpen: boolean;
  setIsCargarAutoOpen: (open: boolean) => void;
  cargarStep: number;
  setCargarStep: React.Dispatch<React.SetStateAction<number>>;
  wizardData: WizardData;
  setWizardData: React.Dispatch<React.SetStateAction<WizardData>>;
  showNotification: (message: string, type?: string) => void;
  handleGuardarAutoWizard: () => void;
  handleCapturarFoto: () => void;
  handleGaleria: () => void;
  handleQuitarFoto: (idx: number) => void;
  toggleEquipamiento: (item: string) => void;
}

/* ======================= WIZARD CARGAR AUTO ======================= */
export function AltaVehiculoWizard({
  isCargarAutoOpen,
  setIsCargarAutoOpen,
  cargarStep,
  setCargarStep,
  wizardData,
  setWizardData,
  showNotification,
  handleGuardarAutoWizard,
  handleCapturarFoto,
  handleGaleria,
  handleQuitarFoto,
  toggleEquipamiento,
}: AltaVehiculoWizardProps) {
  const insets = useSafeAreaInsets();

  return renderWizard();

  function renderWizard() {
    if (!isCargarAutoOpen) return null;
    return (
      <PageOverlay>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            {/* Header */}
            <View style={[s.overlayHeader, { paddingTop: insets.top + 16 }]}>
              <TouchableOpacity onPress={() => setIsCargarAutoOpen(false)} style={s.rowCenter}>
                <Icon name="xmark" size={18} color={C.slate400} />
                <Text style={s.cancelText}> Cancelar</Text>
              </TouchableOpacity>
              <Text style={s.overlayTitle}>{wizardData.id ? 'Editar Publicación' : 'Cargar Auto Usado'}</Text>
              <View style={s.stepPill}>
                <Text style={s.stepPillText}>Paso {cargarStep} de {WIZARD_PASOS}</Text>
              </View>
            </View>

            {/* Progreso */}
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(cargarStep / WIZARD_PASOS) * 100}%` }]} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {cargarStep === 1 && renderWizardStep1()}
              {cargarStep === 2 && renderWizardStep2()}
              {cargarStep === 3 && renderWizardStep3()}
            </ScrollView>

            {/* Botonera */}
            <View style={[s.wizardFooter, { paddingBottom: (insets.bottom || 8) + 16 }]}>
              {cargarStep > 1 && (
                <TouchableOpacity onPress={() => setCargarStep(cargarStep - 1)} style={s.wizardBack}>
                  <Text style={s.wizardBackText}>Atrás</Text>
                </TouchableOpacity>
              )}
              {cargarStep < WIZARD_PASOS ? (
                <TouchableOpacity
                  onPress={() => {
                    if (cargarStep === 2 && (!wizardData.patente || !wizardData.marca)) {
                      showNotification('Por favor, introduce al menos la patente y la marca.', 'warning');
                      return;
                    }
                    setCargarStep(cargarStep + 1);
                  }}
                  style={s.wizardNext}
                >
                  <Text style={s.wizardNextText}>Siguiente</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleGuardarAutoWizard} style={[s.wizardNext, { backgroundColor: C.teal600 }]}>
                  <Text style={s.wizardNextText}>{wizardData.id ? 'Guardar Cambios' : 'Guardar en Stock'}</Text>
                </TouchableOpacity>
              )}
            </View>
        </KeyboardAvoidingView>
      </PageOverlay>
    );
  }

  function renderWizardStep1() {
    return (
      <View style={{ gap: 16 }}>
        <View>
          <Text style={s.stepTitle}>Cargar Fotos del Vehículo</Text>
          <Text style={s.stepSub}>La primera foto se convertirá en la portada del vehículo.</Text>
        </View>

        {/* Cámara real */}
        <View style={s.cameraBox}>
          <Icon name="camera" size={40} color={C.slate500} />
          <Text style={s.cameraTitle}>Cámara Integrada</Text>
          <Text style={s.cameraSub}>Saca fotos del auto directamente o elige desde tu galería.</Text>
          <View style={s.cameraActions}>
            <TouchableOpacity onPress={handleCapturarFoto} style={[s.captureBtn, s.cameraActionBtn]}>
              <Icon name="camera" size={12} color={C.white} />
              <Text style={s.captureText}>Capturar Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleGaleria} style={[s.galleryBtn, s.cameraActionBtn]}>
              <Icon name="images" size={12} color={C.slate200} />
              <Text style={s.galleryText}>Galería</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Galería previa */}
        <View style={s.previewGrid}>
          {wizardData.fotos.map((f, idx) => (
            <View key={`${f}-${idx}`} style={s.previewCell}>
              <Image source={{ uri: f }} style={s.previewImg} />
              <View style={s.previewBadge}>
                <Text style={s.previewBadgeText}>{idx === 0 ? 'Portada' : `Foto ${idx + 1}`}</Text>
              </View>
              <TouchableOpacity onPress={() => handleQuitarFoto(idx)} style={s.previewRemove}>
                <Icon name="xmark" size={10} color={C.white} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderWizardStep2() {
    return (
      <View style={{ gap: 16 }}>
        <View>
          <Text style={s.stepTitle}>Información del Vehículo</Text>
          <Text style={s.stepSub}>Todo lo que es del auto: identificación y especificaciones.</Text>
        </View>
        <View style={{ gap: 12 }}>
          <View>
            <Text style={s.fieldLabel}>Patente Chilena</Text>
            <TextInput
              placeholder="Ej: KDPT45"
              placeholderTextColor={C.slate400}
              maxLength={6}
              autoCapitalize="characters"
              value={wizardData.patente}
              onChangeText={(t) => setWizardData({ ...wizardData, patente: t.toUpperCase() })}
              style={s.patenteInput}
            />
          </View>
          <Field label="VIN" placeholder="Ej: 1HGCM82633A123456" value={wizardData.vin} onChange={(t) => setWizardData({ ...wizardData, vin: t.toUpperCase() })} />
          <View>
            <Text style={s.fieldLabel}>Tipo de Vehículo</Text>
            <Dropdown
              value={wizardData.tipoVehiculo}
              onChange={(v) => setWizardData({ ...wizardData, tipoVehiculo: v as WizardData['tipoVehiculo'] })}
              options={TIPO_VEHICULO_OPTIONS.map((v) => ({ label: v, value: v }))}
            />
          </View>
          <View>
            <Text style={s.fieldLabel}>Marca</Text>
            <Dropdown
              value={wizardData.marca}
              placeholder="Seleccionar marca"
              onChange={(v) => setWizardData({ ...wizardData, marca: v })}
              options={optionsWithCurrent(wizardData.marca, MARCA_OPTIONS)}
            />
          </View>
          <Field label="Modelo" placeholder="Ej: Morning" value={wizardData.modelo} onChange={(t) => setWizardData({ ...wizardData, modelo: t })} />
          <Field label="Versión" placeholder="Ej: XEI 1.8" value={wizardData.version} onChange={(t) => setWizardData({ ...wizardData, version: t })} />
          <Field
            label="Año modelo"
            placeholder="Ej: 2019"
            keyboardType="number-pad"
            value={wizardData.anio ? String(wizardData.anio) : ''}
            onChange={(t) => setWizardData({ ...wizardData, anio: parseInt(t) || 0 })}
          />
          <Field
            label="Año Fabricación"
            placeholder="Ej: 2018"
            keyboardType="number-pad"
            value={wizardData.anioFabricacion ? String(wizardData.anioFabricacion) : ''}
            onChange={(t) => setWizardData({ ...wizardData, anioFabricacion: parseInt(t) || 0 })}
          />
          <View>
            <Text style={s.fieldLabel}>Sucursal</Text>
            <Dropdown
              value={wizardData.sucursal}
              onChange={(v) => setWizardData({ ...wizardData, sucursal: v })}
              options={SUCURSAL_OPTIONS.map((v) => ({ label: v, value: v }))}
            />
          </View>
          <Field label="Origen" placeholder="Ej: Retoma, Subasta, Importación" value={wizardData.origen} onChange={(t) => setWizardData({ ...wizardData, origen: t })} />
          {/* La fecha de ingreso, el estado inicial y el cliente salieron de acá: no
              son datos del auto sino de la operación, y por eso van con los precios. */}
          <Field
            label="Kilometraje (km)"
            placeholder="Ej: 58000"
            keyboardType="number-pad"
            value={wizardData.km ? String(wizardData.km) : ''}
            onChange={(t) => setWizardData({ ...wizardData, km: parseInt(t) || 0 })}
          />
          <Field label="Color" placeholder="Ej: Gris Plata" value={wizardData.color} onChange={(t) => setWizardData({ ...wizardData, color: t })} />
          <View style={s.fieldPair}>
            <View style={s.fieldPairItem}>
              <Text style={s.fieldLabel}>Transmisión</Text>
              <Dropdown
                value={wizardData.transmision}
                onChange={(v) => setWizardData({ ...wizardData, transmision: v })}
                options={TRANSMISION_OPTIONS.map((v) => ({ label: v, value: v }))}
              />
            </View>
            <View style={s.fieldPairItem}>
              <Text style={s.fieldLabel}>Combustible</Text>
              <Dropdown
                value={wizardData.combustible}
                onChange={(v) => setWizardData({ ...wizardData, combustible: v })}
                options={COMBUSTIBLE_OPTIONS.map((v) => ({ label: v, value: v }))}
              />
            </View>
          </View>
          <View style={s.fieldPair}>
            <View style={s.fieldPairItem}>
              <Text style={s.fieldLabel}>Tracción</Text>
              <Dropdown
                value={wizardData.traccion}
                onChange={(v) => setWizardData({ ...wizardData, traccion: v })}
                options={TRACCION_OPTIONS.map((v) => ({ label: v, value: v }))}
              />
            </View>
            <View style={s.fieldPairItem}>
              <Text style={s.fieldLabel}>Puertas</Text>
              <Dropdown
                value={wizardData.puertas}
                placeholder="Seleccionar"
                onChange={(v) => setWizardData({ ...wizardData, puertas: v })}
                options={PUERTAS_OPTIONS.map((v) => ({ label: v, value: v }))}
              />
            </View>
          </View>
          <Field
            label="Cilindrada"
            placeholder="Ej: 1600"
            keyboardType="number-pad"
            value={wizardData.cilindrada ? String(wizardData.cilindrada) : ''}
            onChange={(t) => setWizardData({ ...wizardData, cilindrada: parseInt(t) || 0 })}
          />
          <View style={s.inlinePanel}>
            <View style={s.rowBetween}>
              <Text style={s.inlinePanelTitle}>Equipamiento</Text>
              <Text style={s.inlinePanelCount}>{wizardData.equipamiento.length}</Text>
            </View>
            <View style={s.optionWrap}>
              {EQUIPAMIENTO_OPTIONS.map((item) => (
                <ToggleChip
                  key={item}
                  label={item}
                  active={wizardData.equipamiento.includes(item)}
                  onPress={() => toggleEquipamiento(item)}
                />
              ))}
            </View>
          </View>
          <MultilineField
            label="Otros"
            placeholder="Observaciones técnicas o comerciales adicionales"
            value={wizardData.otros}
            onChange={(t) => setWizardData({ ...wizardData, otros: t })}
          />
        </View>
      </View>
    );
  }

  function renderWizardStep3() {
    const precioBase = wizardData.precioVentaEstimado || wizardData.precioPublicacionContado || wizardData.precioVenta;
    const base = costoBase(wizardData as Car);
    const margen = precioBase - base;
    const pct = Math.round((margen / base) * 100) || 0;
    return (
      <View style={{ gap: 16 }}>
        <View>
          <Text style={s.stepTitle}>Precios y Operación</Text>
          <Text style={s.stepSub}>Los números, cuándo entró y en qué estado queda.</Text>
        </View>
        <View style={{ gap: 16 }}>
          <View>
            <Text style={s.fieldLabel}>Costo Adquisición (CLP)</Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="Ej: 5900000"
              placeholderTextColor={C.slate400}
              value={wizardData.costoAdquisicion ? String(wizardData.costoAdquisicion) : ''}
              onChangeText={(t) => setWizardData({ ...wizardData, costoAdquisicion: parseInt(t) || 0 })}
              style={s.moneyInput}
            />
          </View>
          <View>
            <Text style={s.fieldLabel}>Publicación Contado (CLP)</Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="Ej: 7890000"
              placeholderTextColor={C.slate400}
              value={wizardData.precioPublicacionContado ? String(wizardData.precioPublicacionContado) : ''}
              onChangeText={(t) => setWizardData({ ...wizardData, precioPublicacionContado: parseInt(t) || 0, precioVenta: parseInt(t) || 0 })}
              style={s.moneyInput}
            />
          </View>
          <View>
            <Text style={s.fieldLabel}>Publicación Financiado (CLP)</Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="Ej: 8190000"
              placeholderTextColor={C.slate400}
              value={wizardData.precioPublicacionFinanciado ? String(wizardData.precioPublicacionFinanciado) : ''}
              onChangeText={(t) => setWizardData({ ...wizardData, precioPublicacionFinanciado: parseInt(t) || 0 })}
              style={s.moneyInput}
            />
          </View>
          <View>
            <Text style={s.fieldLabel}>Precio de Venta Estimado (CLP)</Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="Ej: 7800000"
              placeholderTextColor={C.slate400}
              value={wizardData.precioVentaEstimado ? String(wizardData.precioVentaEstimado) : ''}
              onChangeText={(t) => setWizardData({ ...wizardData, precioVentaEstimado: parseInt(t) || 0 })}
              style={s.moneyInput}
            />
          </View>
          <View style={s.margenBox}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.margenLabel}>Margen de Venta Estimado</Text>
              <Text style={s.margenValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {fmtCLP(margen)}
              </Text>
            </View>
            <View style={s.margenTag}>
              <Text style={s.margenTagText}>{pct}% Retorno</Text>
            </View>
          </View>

          <MotorPreciosPublicacion patente={wizardData.patente} km={wizardData.km} vehiculo={wizardData} />

          {/* Datos de la operación, no del auto: por eso viven acá y no en el paso 2. */}
          <DateField
            label="Fecha de Ingreso"
            value={wizardData.fechaIngreso}
            onChange={(fechaIngreso) => setWizardData({ ...wizardData, fechaIngreso })}
          />
          <View>
            <Text style={s.fieldLabel}>Estado Inicial</Text>
            <Dropdown
              value={wizardData.estado}
              onChange={(v) => setWizardData({ ...wizardData, estado: v as EstadoAuto })}
              options={ESTADOS.map((v) => ({ label: v, value: v }))}
            />
          </View>

          {/* El cliente se pregunta solo si el auto entra reservado o vendido. Si entra
              en preparación o en venta todavía no hay nadie del otro lado. */}
          {requiresBuyer(wizardData.estado) ? (
            <>
              <View style={s.inlinePanel}>
                <Text style={s.inlinePanelTitle}>Comprador</Text>
                <Text style={s.inlinePanelHint}>Obligatorio para autos reservados o vendidos.</Text>
                <View style={{ gap: 10, marginTop: 12 }}>
                  <Field
                    label="Nombre"
                    placeholder="Ej: María González"
                    value={wizardData.comprador?.nombre || ''}
                    onChange={(nombre) =>
                      setWizardData({
                        ...wizardData,
                        comprador: { ...(wizardData.comprador || emptyContact()), nombre },
                      })
                    }
                  />
                  <Field
                    label="Teléfono"
                    placeholder="Ej: +56 9 1234 5678"
                    keyboardType="phone-pad"
                    value={wizardData.comprador?.telefono || ''}
                    onChange={(telefono) =>
                      setWizardData({
                        ...wizardData,
                        comprador: { ...(wizardData.comprador || emptyContact()), telefono },
                      })
                    }
                  />
                  <View>
                    <Text style={s.fieldLabel}>Notas del cliente</Text>
                    <TextInput
                      placeholder="Ej: preferencias, acuerdos o cuidados al tratarlo"
                      placeholderTextColor={C.slate400}
                      value={wizardData.comprador?.notas || ''}
                      onChangeText={(notas) =>
                        setWizardData({
                          ...wizardData,
                          comprador: { ...(wizardData.comprador || emptyContact()), notas },
                        })
                      }
                      multiline
                      style={[s.textArea, { minHeight: 72 }]}
                    />
                  </View>
                </View>
              </View>
              <View style={s.inlinePanel}>
                <Text style={s.inlinePanelTitle}>Cliente de Adquisición</Text>
                <Text style={s.inlinePanelHint}>Opcional: de quién venía esta unidad.</Text>
                <View style={{ gap: 10, marginTop: 12 }}>
                  <Field
                    label="Nombre"
                    placeholder="Ej: Juan Pérez o Empresa SpA"
                    value={wizardData.clienteAdquisicion?.nombre || ''}
                    onChange={(nombre) =>
                      setWizardData({
                        ...wizardData,
                        clienteAdquisicion: { ...(wizardData.clienteAdquisicion || emptyContact()), nombre },
                      })
                    }
                  />
                  <Field
                    label="Teléfono"
                    placeholder="Ej: +56 9 1234 5678"
                    keyboardType="phone-pad"
                    value={wizardData.clienteAdquisicion?.telefono || ''}
                    onChange={(telefono) =>
                      setWizardData({
                        ...wizardData,
                        clienteAdquisicion: { ...(wizardData.clienteAdquisicion || emptyContact()), telefono },
                      })
                    }
                  />
                  <View>
                    <Text style={s.fieldLabel}>Notas del cliente</Text>
                    <TextInput
                      placeholder="Ej: motivo de venta, disponibilidad o condiciones acordadas"
                      placeholderTextColor={C.slate400}
                      value={wizardData.clienteAdquisicion?.notas || ''}
                      onChangeText={(notas) =>
                        setWizardData({
                          ...wizardData,
                          clienteAdquisicion: { ...(wizardData.clienteAdquisicion || emptyContact()), notas },
                        })
                      }
                      multiline
                      style={[s.textArea, { minHeight: 72 }]}
                    />
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </View>
    );
  }

  /* El paso de Documentos y Revisión se sacó del alta: nadie carga el padrón parado
     en el patio con el auto recién llegado. Los documentos se suben después desde la
     ficha del auto. */
}
