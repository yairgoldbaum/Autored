import React from 'react';
import {
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, fmtCLP, fmtMiles } from '../src/theme';
import { Dropdown, Icon, PageOverlay, Spinner } from '../src/ui';
import { s } from '../src/styles';
import { Car, ESTADOS, EstadoAuto, costoBase } from '../src/data';
import {
  FichaPatente,
  PATENTES_DEMO_ALTA,
  PATENTES_SIN_REGISTRO,
  normalizarPatente,
} from '../src/pricing';
import {
  BusquedaPatente,
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
  LecturaPatente,
  emptyContact,
  makeBusquedaPatente,
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
  altaFase: 'patente' | 'fotos';
  setAltaFase: React.Dispatch<React.SetStateAction<'patente' | 'fotos'>>;
  wizardData: WizardData;
  setWizardData: React.Dispatch<React.SetStateAction<WizardData>>;
  busquedaPatente: BusquedaPatente;
  setBusquedaPatente: React.Dispatch<React.SetStateAction<BusquedaPatente>>;
  handleBuscarPatente: () => void;
  handleTomarFichaPatente: () => void;
  lecturaPatente: LecturaPatente;
  handleConfirmarLectura: () => void;
  handleDescartarLectura: () => void;
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
  altaFase,
  setAltaFase,
  wizardData,
  setWizardData,
  busquedaPatente,
  setBusquedaPatente,
  handleBuscarPatente,
  handleTomarFichaPatente,
  lecturaPatente,
  handleConfirmarLectura,
  handleDescartarLectura,
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
    /* En la mitad de la patente no hay a dónde avanzar todavía: se sale de ahí
       buscando la patente, leyéndola de una foto o eligiendo cargarlo a mano.
       Es lo que hace que la patente sea el primer paso de verdad y no un campo
       más que se puede saltar de largo. Deja de frenar apenas el auto tiene
       marca: si ya se tomó una ficha y el vendedor volvió acá con "Cambiar",
       los datos ya están y encerrarlo sería un bug. */
    const esperandoPatente =
      cargarStep === 1 && wizardData.id === null && altaFase === 'patente' && !wizardData.marca;
    return (
      <PageOverlay>
        {/* Sin KeyboardAvoidingView a propósito: acá lo que hace falta es que el
            campo enfocado suba sobre el teclado, y de eso se encarga
            `automaticallyAdjustKeyboardInsets` en el ScrollView de abajo.
            Envolver todo en un KAV solo achicaba la pantalla sin mover el campo. */}
        <View style={{ flex: 1 }}>
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

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
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
                  disabled={esperandoPatente}
                  onPress={() => {
                    if (cargarStep === 2 && (!wizardData.patente || !wizardData.marca)) {
                      showNotification('Por favor, introduce al menos la patente y la marca.', 'warning');
                      return;
                    }
                    setCargarStep(cargarStep + 1);
                  }}
                  style={[s.wizardNext, esperandoPatente && s.wizardNextOff]}
                >
                  <Text style={[s.wizardNextText, esperandoPatente && s.wizardNextTextOff]}>Siguiente</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleGuardarAutoWizard} style={[s.wizardNext, { backgroundColor: C.teal600 }]}>
                  <Text style={s.wizardNextText}>{wizardData.id ? 'Guardar Cambios' : 'Guardar en Stock'}</Text>
                </TouchableOpacity>
              )}
            </View>
        </View>
      </PageOverlay>
    );
  }

  /* El paso 1 son dos mitades, una después de la otra: primero la patente, y
     las fotos recién cuando el auto ya está identificado (o cuando el vendedor
     eligió cargarlo a mano). Antes estaban las dos juntas, con la cámara arriba
     y la patente al fondo, y la patente es lo que el vendedor tiene primero:
     escribirla trae la ficha y el paso 2 llega lleno. Al editar no hay nada que
     buscar, así que ahí se entra derecho a las fotos. */
  function renderWizardStep1() {
    if (wizardData.id === null && altaFase === 'patente') return renderPaso1Patente();
    return renderPaso1Fotos();
  }

  function renderPaso1Patente() {
    return (
      <View style={{ gap: 16 }}>
        <View>
          <Text style={s.stepTitle}>Empecemos por la Patente</Text>
          <Text style={s.stepSub}>
            Con la patente traemos la ficha del vehículo y el resto del formulario llega lleno.
          </Text>
        </View>

        {renderBuscarPatente()}
      </View>
    );
  }

  function renderPaso1Fotos() {
    const identificado = wizardData.id === null && !!wizardData.marca;

    return (
      <View style={{ gap: 16 }}>
        <View>
          <Text style={s.stepTitle}>Cargar Fotos del Vehículo</Text>
          <Text style={s.stepSub}>La primera foto se convertirá en la portada del vehículo.</Text>
        </View>

        {/* Qué auto se está fotografiando, con la salida para corregir la patente:
            el "Atrás" del pie no existe en el paso 1 y sin esto no había vuelta. */}
        {identificado ? (
          <View style={s.altaAutoChip}>
            <Icon name="car-side" size={16} color={C.chileanTeal} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.altaAutoChipNombre} numberOfLines={1}>
                {wizardData.marca} {wizardData.modelo} {wizardData.anio ? `· ${wizardData.anio}` : ''}
              </Text>
              <Text style={s.altaAutoChipPatente}>{wizardData.patente || 'Sin patente'}</Text>
            </View>
            <TouchableOpacity onPress={() => setAltaFase('patente')} style={s.altaAutoChipBtn}>
              <Text style={s.altaAutoChipBtnText}>Cambiar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* El lector de la patente también vive acá: por el camino manual se llega
            a las fotos sin patente, y ahí la foto es la que la puede dar. */}
        {wizardData.id === null ? renderLectorPatente() : null}

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
          {/* Se avisa antes de sacar la foto, si no el lector aparece de la nada */}
          {wizardData.id === null && normalizarPatente(wizardData.patente).length < 5 ? (
            <View style={s.cameraAiHint}>
              <Icon name="wand-magic-sparkles" size={10} color={C.teal300} />
              <Text style={s.cameraAiHintText}>La patente se lee sola desde la foto</Text>
            </View>
          ) : null}
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

        {wizardData.fotos.length === 0 ? (
          <Text style={s.altaManualSub}>
            Las fotos no son obligatorias: puedes seguir y agregarlas después.
          </Text>
        ) : null}
      </View>
    );
  }

  function renderBuscarPatente() {
    const patente = normalizarPatente(wizardData.patente);
    const buscando = busquedaPatente.estado === 'buscando';
    const puedeBuscar = patente.length >= 5 && !buscando;
    /* El resultado vale solo para la patente que está escrita ahora. Si la
       cambiaron (acá o en el paso 2), lo que se buscó antes deja de mostrarse. */
    const vigente = busquedaPatente.patente === patente;

    const elegirPatente = (p: string) => {
      setWizardData({ ...wizardData, patente: p });
      setBusquedaPatente(makeBusquedaPatente());
    };

    return (
      <View style={{ gap: 12 }}>
        {renderLectorPatente()}

        <View style={s.patenteBox}>
          <View style={s.patenteBoxHead}>
            <Icon name="magnifying-glass" size={14} color={C.teal700} />
            <Text style={s.patenteBoxTitle}>Agregar la Patente</Text>
          </View>
          <Text style={s.patenteBoxSub}>
            Escríbela y buscamos la ficha del vehículo. Si aparece, el paso siguiente llega con los
            datos puestos y solo hay que revisarlos.
          </Text>

          <TextInput
            placeholder="KDPT45"
            placeholderTextColor={C.slate400}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
            value={wizardData.patente}
            onChangeText={(txt) => {
              setWizardData({ ...wizardData, patente: normalizarPatente(txt) });
              // Cambiar la patente invalida lo que se había buscado antes
              if (busquedaPatente.estado !== 'idle') setBusquedaPatente(makeBusquedaPatente());
            }}
            style={s.patenteInput}
          />

          <View style={s.motorDemoRow}>
            <Text style={s.motorDemoLabel}>Prueba con:</Text>
            {PATENTES_DEMO_ALTA.map((p) => (
              <TouchableOpacity key={p} onPress={() => elegirPatente(p)} style={s.motorDemoChip}>
                <Text style={s.motorDemoChipText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.motorDemoRow}>
            <Text style={s.motorDemoLabel}>Sin registro:</Text>
            {PATENTES_SIN_REGISTRO.map((p) => (
              <TouchableOpacity key={p} onPress={() => elegirPatente(p)} style={s.motorDemoChip}>
                <Text style={s.motorDemoChipText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleBuscarPatente}
            disabled={!puedeBuscar}
            style={[s.patenteBuscarBtn, !puedeBuscar && s.patenteBuscarBtnOff]}
          >
            <Icon name="magnifying-glass" size={12} color={puedeBuscar ? C.white : C.slate400} />
            <Text style={[s.patenteBuscarText, !puedeBuscar && s.patenteBuscarTextOff]}>
              Buscar Patente
            </Text>
          </TouchableOpacity>
        </View>

        {buscando ? (
          <View style={s.fichaBuscando}>
            <Spinner size={14} color={C.teal700} />
            <Text style={s.fichaBuscandoText}>Buscando {busquedaPatente.patente} en el registro…</Text>
          </View>
        ) : null}

        {vigente && busquedaPatente.estado === 'ok' && busquedaPatente.ficha
          ? renderFichaEncontrada(busquedaPatente.ficha)
          : null}

        {vigente && busquedaPatente.estado === 'sin_registro' ? renderFichaSinRegistro() : null}

        {/* Las dos alternativas a escribir la patente. Desaparecen cuando hay un
            resultado en pantalla: ahí lo que toca es tomar la ficha o llenar a
            mano, y dejarlas puestas competía con eso. */}
        {!buscando && !(vigente && busquedaPatente.estado !== 'idle') ? (
          <View style={{ gap: 12 }}>
            <View style={s.altaSepRow}>
              <View style={s.altaSepLinea} />
              <Text style={s.altaSepTexto}>O</Text>
              <View style={s.altaSepLinea} />
            </View>

            <TouchableOpacity onPress={handleCapturarFoto} style={s.altaFotoBtn}>
              <Icon name="camera" size={13} color={C.slate700} />
              <Text style={s.altaFotoBtnText}>Sacar la foto y leer la patente</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAltaFase('fotos')} style={s.altaManualBtn}>
              <Text style={s.altaManualText}>Cargarlo a mano</Text>
              <Text style={s.altaManualSub}>
                Sin buscar en el registro: las fotos y después los datos, todo escrito por ti.
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  /* El lector de patente: corre solo al agregar una foto mientras no haya
     patente. Nunca escribe en el campo por su cuenta — propone y el vendedor
     confirma, porque una patente mal leída se arrastra hasta el registro. */
  function renderLectorPatente() {
    if (lecturaPatente.estado === 'idle') return null;

    if (lecturaPatente.estado === 'leyendo') {
      return (
        <View style={s.fichaBuscando}>
          <Spinner size={14} color={C.teal700} />
          <Text style={s.fichaBuscandoText}>Leyendo la patente en la foto…</Text>
        </View>
      );
    }

    if (lecturaPatente.estado === 'sin_lectura') {
      return (
        <View style={s.fichaVaciaBox}>
          <View style={s.patenteBoxHead}>
            <Icon name="eye-slash" size={14} color={C.amber600} />
            <Text style={s.fichaVaciaTitulo}>No pude leer la patente</Text>
          </View>
          <Text style={s.fichaVaciaSub}>
            En esta foto no se alcanza a distinguir. Saca otra donde la patente se vea derecha, o
            escríbela tú abajo.
          </Text>
          <TouchableOpacity onPress={handleDescartarLectura} style={s.fichaManualBtn}>
            <Icon name="pen" size={12} color={C.amber700} />
            <Text style={s.fichaManualText}>Escribirla a mano</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={s.lecturaBox}>
        <View style={s.patenteBoxHead}>
          <Icon name="wand-magic-sparkles" size={14} color={C.teal700} />
          <Text style={s.patenteBoxTitle}>Patente leída de la foto</Text>
        </View>
        <View style={s.lecturaRow}>
          {lecturaPatente.foto ? (
            <Image source={{ uri: lecturaPatente.foto }} style={s.lecturaThumb} />
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.lecturaPregunta}>¿Es esta?</Text>
            <Text style={s.lecturaPatenteLeida} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {lecturaPatente.patente}
            </Text>
          </View>
        </View>
        <View style={s.fichaAcciones}>
          <TouchableOpacity onPress={handleConfirmarLectura} style={s.fichaTomarBtn}>
            <Icon name="check" size={12} color={C.white} />
            <Text style={s.fichaTomarText}>Sí, es esa</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDescartarLectura} style={s.fichaOtraBtn}>
            <Text style={s.fichaOtraText}>Corregir</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderFichaEncontrada(ficha: FichaPatente) {
    const celdas: { label: string; valor: string; ancho?: boolean }[] = [
      { label: 'Tipo', valor: ficha.tipoVehiculo },
      { label: 'Año fabricación', valor: String(ficha.anioFabricacion) },
      { label: 'Color', valor: ficha.color },
      { label: 'Transmisión', valor: ficha.transmision },
      { label: 'Combustible', valor: ficha.combustible },
      { label: 'Tracción', valor: ficha.traccion },
      { label: 'Puertas', valor: ficha.puertas },
      { label: 'Cilindrada', valor: `${fmtMiles(ficha.cilindrada)} cc` },
      { label: 'Km último permiso', valor: `${fmtMiles(ficha.kmPermiso)} km` },
      { label: 'VIN', valor: ficha.vin, ancho: true },
    ];

    return (
      <View style={s.fichaBox}>
        <View style={s.fichaHead}>
          <Icon name="circle-check" size={13} color={C.teal700} />
          <Text style={s.fichaLabel}> Vehículo encontrado</Text>
          <View style={s.fichaPatenteTag}>
            <Text style={s.fichaPatenteTagText}>{busquedaPatente.patente}</Text>
          </View>
        </View>

        <View>
          <Text style={s.fichaTitulo} numberOfLines={2}>
            {ficha.marca} {ficha.modelo} {ficha.version}
          </Text>
          <Text style={s.fichaSubtitulo}>
            Año {ficha.anio} · {ficha.transmision} · {ficha.combustible}
          </Text>
        </View>

        <View style={s.fichaGrid}>
          {celdas.map((c) => (
            <View key={c.label} style={[s.fichaCell, c.ancho ? { flexBasis: '100%' } : null]}>
              <Text style={s.fichaCellLabel}>{c.label}</Text>
              <Text style={s.fichaCellValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {c.valor}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.fichaAcciones}>
          <TouchableOpacity onPress={handleTomarFichaPatente} style={s.fichaTomarBtn}>
            <Icon name="wand-magic-sparkles" size={12} color={C.white} />
            <Text style={s.fichaTomarText}>Tomar esta información</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setBusquedaPatente(makeBusquedaPatente())} style={s.fichaOtraBtn}>
            <Text style={s.fichaOtraText}>Buscar otra</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderFichaSinRegistro() {
    return (
      <View style={s.fichaVaciaBox}>
        <View style={s.patenteBoxHead}>
          <Icon name="triangle-exclamation" size={14} color={C.amber600} />
          <Text style={s.fichaVaciaTitulo}>No encontramos {busquedaPatente.patente}</Text>
        </View>
        <Text style={s.fichaVaciaSub}>
          El registro no tiene esa patente. Revisa que esté bien escrita o sigue y llena la ficha
          del auto a mano: la patente ya queda guardada.
        </Text>
        {/* Sigue por las fotos, igual que el camino con ficha: la patente ya quedó
            escrita y el auto está delante del vendedor. */}
        <TouchableOpacity onPress={() => setAltaFase('fotos')} style={s.fichaManualBtn}>
          <Icon name="pen" size={12} color={C.amber700} />
          <Text style={s.fichaManualText}>Seguir y llenar los datos a mano</Text>
        </TouchableOpacity>
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

          {/* Consignado no es un auto que compraste: es de otro y lo vendes por él.
              Por eso pide dueño y precio piso, y ese piso es el que manda en el
              margen (costoBase) en vez del costo de adquisición. */}
          {wizardData.estado === 'Consignado' ? (
            <View style={s.inlinePanel}>
              <Text style={s.inlinePanelTitle}>Dueño del auto</Text>
              <Text style={s.inlinePanelHint}>Obligatorio para dejar el auto en consignación.</Text>
              <View style={{ gap: 10, marginTop: 12 }}>
                <Field
                  label="Nombre"
                  placeholder="Ej: Juan Pérez"
                  value={wizardData.consignante?.nombre || ''}
                  onChange={(nombre) =>
                    setWizardData({
                      ...wizardData,
                      consignante: { ...(wizardData.consignante || emptyContact()), nombre },
                    })
                  }
                />
                <Field
                  label="Teléfono"
                  placeholder="Ej: +56 9 1234 5678"
                  keyboardType="phone-pad"
                  value={wizardData.consignante?.telefono || ''}
                  onChange={(telefono) =>
                    setWizardData({
                      ...wizardData,
                      consignante: { ...(wizardData.consignante || emptyContact()), telefono },
                    })
                  }
                />
                <View>
                  <Text style={s.fieldLabel}>Precio piso pactado (CLP)</Text>
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="Ej: 5900000"
                    placeholderTextColor={C.slate400}
                    value={wizardData.precioPisoConsignacion ? String(wizardData.precioPisoConsignacion) : ''}
                    onChangeText={(v) =>
                      setWizardData({ ...wizardData, precioPisoConsignacion: parseInt(v) || 0 })
                    }
                    style={s.moneyInput}
                  />
                  <Text style={s.inlinePanelHint}>Lo que se le entrega al dueño cuando el auto se venda.</Text>
                </View>
              </View>
            </View>
          ) : null}

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
