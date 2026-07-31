import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';

import { C, W, fmtCLP, fmtMiles } from './src/theme';
import {
  Car,
  Auction,
  Customer,
  ClienteRol,
  EstadoAuto,
  EnvioInforme,
  InformeAutosave,
  ModalidadTransferencia,
  ResponsablePago,
  TraspasoOrigen,
  VehicleContact,
  VehicleDocument,
  VeredictoAutosave,
  INITIAL_STOCK_DATA,
  INITIAL_AUCTIONS,
  INITIAL_CUSTOMERS,
  ESTADOS,
} from './src/data';
import { Icon, Ping, Spinner, Wiggle, Pulse, Sheet, Dropdown, PageOverlay } from './src/ui';
import { loadState, saveState } from './src/storage';
import {
  Tasacion,
  PATENTES_DEMO,
  buscarPatente,
  normalizarPatente,
  tasar,
} from './src/pricing';
import {
  AUTOMOTORA,
  NOTARIAS,
  PITCH_TRANSFERENCIA,
  PRECIO_COPIA_INFORME,
  alertaPrincipal,
  avanzarTransferencia,
  bloqueosTransferencia,
  cotizarTransferencia,
  crearTransferencia,
  fmtFecha,
  generarInformeAutosave,
  progresoTransferencia,
  resumenVeredictos,
  textoWhatsappInforme,
  textoWhatsappTransferencia,
} from './src/autosave';
import { InspectionScreen } from './src/inspection/InspectionScreen';
import { InspectionReport } from './src/inspection/types';

type TabKey = 'inicio' | 'stock' | 'subastas' | 'clientes';
type SubastaTabKey = 'disponibles' | 'ofertas' | 'mis_subastas' | 'finalizadas';

const AUCTION_DURATION_MS = 4 * 60 * 60 * 1000;

interface WizardData extends Omit<Car, 'id'> {
  id: number | null;
  desdeSubastaId: number | null;
}

interface NewClientData {
  id: number | null;
  nombre: string;
  telefono: string;
  tipo: 'Particular' | 'Empresa';
  estado: string;
  interes: string;
  rol: ClienteRol | 'Ambos';
}

const TIPO_VEHICULO_OPTIONS = ['Vehículo liviano', 'Vehículo pesado', 'Moto'];
const MARCA_OPTIONS = [
  'Audi',
  'BMW',
  'BYD',
  'Changan',
  'Chevrolet',
  'Citroen',
  'Fiat',
  'Ford',
  'Great Wall',
  'Honda',
  'Hyundai',
  'JAC',
  'Kia',
  'Mazda',
  'Mercedes-Benz',
  'MG',
  'Mitsubishi',
  'Nissan',
  'Peugeot',
  'Renault',
  'Subaru',
  'Suzuki',
  'Toyota',
  'Volkswagen',
  'Volvo',
];
const SUCURSAL_OPTIONS = ['Mayorista', 'Vitacura', 'Las Condes', 'La Dehesa'];
const TRANSMISION_OPTIONS = ['Manual', 'Automático', 'Automatizado'];
const COMBUSTIBLE_OPTIONS = ['Bencina', 'Diesel', 'Hibrido', 'Eléctrico'];
const TRACCION_OPTIONS = ['4x2', '4x4', 'AWD'];
const PUERTAS_OPTIONS = ['2', '3', '4', '5'];
const EQUIPAMIENTO_OPTIONS = [
  'Aire acondicionado',
  'Climatizador',
  'Airbags',
  'Frenos ABS',
  'Control estabilidad',
  'Cámara retroceso',
  'Sensores estacionamiento',
  'Bluetooth',
  'Pantalla táctil',
  'Cierre centralizado',
  'Alzavidrios eléctricos',
  'Control crucero',
];
const DOCUMENTO_OPTIONS = ['Permiso de circulación', 'Revisión técnica', 'SOAP', 'Padrón', 'Certificado multas', 'Otro'];

/* ============================ APP ROOT ============================ */
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppInner />
    </SafeAreaProvider>
  );
}

/* ============================ APP INNER ============================ */
function AppInner() {
  const insets = useSafeAreaInsets();
  const initialSyncedState = useMemo(
    () => syncStockAndCustomers(INITIAL_STOCK_DATA, INITIAL_CUSTOMERS),
    [],
  );

  // Core state
  const [stock, setStock] = useState<Car[]>(initialSyncedState.stock);
  const [auctions, setAuctions] = useState<Auction[]>(INITIAL_AUCTIONS);
  const [customers, setCustomers] = useState<Customer[]>(initialSyncedState.customers);

  const [activeTab, setActiveTab] = useState<TabKey>('inicio');

  // El botón del Motor de Precios sólo rebota en las 2 primeras entradas a Inicio.
  const [inicioVisitas, setInicioVisitas] = useState(0);
  useEffect(() => {
    if (activeTab === 'inicio') setInicioVisitas((n) => n + 1);
  }, [activeTab]);
  const motorRebotes = inicioVisitas > 0 && inicioVisitas <= 2 ? 2 : 0;

  // Modales / sheets
  const [activeCar, setActiveCar] = useState<Car | null>(null);
  // Inspección de recepción con IA (se abre desde la ficha del auto)
  const [inspectingCar, setInspectingCar] = useState<Car | null>(null);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isPriceSheetOpen, setIsPriceSheetOpen] = useState(false);
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);
  const [isAuctionBidSheetOpen, setIsAuctionBidSheetOpen] = useState(false);
  const [isAuctionPublishSheetOpen, setIsAuctionPublishSheetOpen] = useState(false);
  const [isAuctionFeaturesSheetOpen, setIsAuctionFeaturesSheetOpen] = useState(false);
  const [activeAuction, setActiveAuction] = useState<Auction | null>(null);

  // Filtros stock
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState('Todos');
  const [filters, setFilters] = useState({ marca: '', anio: '', precioMax: 20000000, estado: '' });

  // Ajuste de precio
  const [adjustedPrice, setAdjustedPrice] = useState(0);

  // Cambio de estado
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState('');
  const [statusBuyer, setStatusBuyer] = useState<VehicleContact>(emptyContact());

  // Oferta subasta
  const [bidAmount, setBidAmount] = useState(0);
  const [publishStockId, setPublishStockId] = useState('');
  const [sellerNote, setSellerNote] = useState('');
  const [nowTs, setNowTs] = useState(() => Date.now());

  // Sub-tabs
  const [subastaTab, setSubastaTab] = useState<SubastaTabKey>('disponibles');
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteRoleFilter, setClienteRoleFilter] = useState<'Todos' | ClienteRol>('Todos');
  const [isNewClientSheetOpen, setIsNewClientSheetOpen] = useState(false);
  const [newClient, setNewClient] = useState<NewClientData>({
    id: null,
    nombre: '',
    telefono: '',
    tipo: 'Particular',
    estado: 'Nuevo',
    interes: '',
    rol: 'Venta',
  });

  // AutoSave: informe (derivado, no se persiste) y transferencia notarial
  const [isAutosaveReportOpen, setIsAutosaveReportOpen] = useState(false);
  const [isEnvioInformeSheetOpen, setIsEnvioInformeSheetOpen] = useState(false);
  const [envioDestinatario, setEnvioDestinatario] = useState<EnvioInforme['destinatario']>('Comprador');
  const [envioContacto, setEnvioContacto] = useState<VehicleContact>(emptyContact());
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false);
  const [transferOrigen, setTransferOrigen] = useState<TraspasoOrigen>('Automotora');
  const [transferModalidad, setTransferModalidad] = useState<ModalidadTransferencia>('Digital');
  const [transferNotaria, setTransferNotaria] = useState<string>(NOTARIAS[0]);
  const [transferPagador, setTransferPagador] = useState<ResponsablePago>('Comprador');
  const [transferProcesando, setTransferProcesando] = useState(false);

  // Motor de precios (tasación rápida, datos simulados)
  const [isMotorOpen, setIsMotorOpen] = useState(false);
  const [motorPatente, setMotorPatente] = useState('');
  const [motorKm, setMotorKm] = useState('');
  const [motorCalculando, setMotorCalculando] = useState(false);
  const [tasacion, setTasacion] = useState<Tasacion | null>(null);

  // Wizard cargar auto
  const [isCargarAutoOpen, setIsCargarAutoOpen] = useState(false);
  const [cargarStep, setCargarStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>(makeEmptyWizard());
  const [documentDraft, setDocumentDraft] = useState<Omit<VehicleDocument, 'id'>>({
    tipo: '',
    nombre: '',
    fechaVencimiento: '',
    archivoNombre: '',
  });

  // Notificación
  const [notification, setNotification] = useState<{ message: string; type: string } | null>(null);
  const notifTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persistencia local (BDD emulada con AsyncStorage)
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await loadState();
      if (saved) {
        const synced = syncStockAndCustomers(saved.stock, saved.customers);
        setStock(synced.stock);
        setAuctions(mergeAuctionsWithInitial(saved.auctions));
        setCustomers(synced.customers);
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState({ stock, auctions, customers });
  }, [hydrated, stock, auctions, customers]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setAuctions((prev) => {
      let changed = false;
      const next = prev.map((auction) => {
        if (isAuctionFinal(auction) || getAuctionMsLeft(auction, nowTs) > 0) return auction;
        changed = true;
        return closeAuction(auction);
      });
      return changed ? next : prev;
    });
  }, [nowTs]);

  // Botón atrás de Android: cierra el overlay superior en vez de salir de la app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFilterSheetOpen) { setIsFilterSheetOpen(false); return true; }
      if (isPriceSheetOpen) { setIsPriceSheetOpen(false); return true; }
      if (isStatusSheetOpen) { setIsStatusSheetOpen(false); return true; }
      if (isAuctionBidSheetOpen) { setIsAuctionBidSheetOpen(false); return true; }
      if (isAuctionPublishSheetOpen) { setIsAuctionPublishSheetOpen(false); return true; }
      if (isAuctionFeaturesSheetOpen) { setIsAuctionFeaturesSheetOpen(false); return true; }
      if (isNewClientSheetOpen) { setIsNewClientSheetOpen(false); return true; }
      if (isEnvioInformeSheetOpen) { setIsEnvioInformeSheetOpen(false); return true; }
      if (isTransferSheetOpen) { setIsTransferSheetOpen(false); return true; }
      if (isCargarAutoOpen) { setIsCargarAutoOpen(false); return true; }
      if (isMotorOpen) { setIsMotorOpen(false); return true; }
      // El informe se apila sobre la ficha: hay que cerrarlo antes que ella.
      if (isAutosaveReportOpen) { setIsAutosaveReportOpen(false); return true; }
      if (inspectingCar) { setInspectingCar(null); return true; }
      if (activeCar) { setActiveCar(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [
    isFilterSheetOpen,
    isPriceSheetOpen,
    isStatusSheetOpen,
    isAuctionBidSheetOpen,
    isAuctionPublishSheetOpen,
    isAuctionFeaturesSheetOpen,
    isNewClientSheetOpen,
    isEnvioInformeSheetOpen,
    isTransferSheetOpen,
    isCargarAutoOpen,
    isMotorOpen,
    isAutosaveReportOpen,
    inspectingCar,
    activeCar,
  ]);

  const showNotification = (message: string, type = 'success') => {
    setNotification({ message, type });
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    notifTimeout.current = setTimeout(() => setNotification(null), 3500);
  };

  /* ------------------- KPIs ------------------- */
  const kpis = useMemo(() => {
    const activos = stock.filter((c) => c.estado !== 'Vendido');
    const valorStock = activos.reduce((sum, c) => sum + c.costoAdquisicion, 0);
    const promedioDias =
      activos.length > 0 ? Math.round(activos.reduce((sum, c) => sum + c.diasStock, 0) / activos.length) : 0;
    const margenPromedio =
      activos.length > 0
        ? Math.round(activos.reduce((sum, c) => sum + (c.precioVenta - c.costoAdquisicion), 0) / activos.length)
        : 0;
    const costoPromedio = activos.length > 0 ? valorStock / activos.length : 0;
    const margenPct = costoPromedio > 0 ? Math.round((margenPromedio / costoPromedio) * 100) : 0;

    // Autos que llevan demasiado tiempo sin venderse y cuánto capital tienen inmovilizado
    const criticos = activos.filter((c) => c.diasStock > 60);
    const capitalCritico = criticos.reduce((sum, c) => sum + c.costoAdquisicion, 0);
    const pctCapitalCritico = valorStock > 0 ? Math.round((capitalCritico / valorStock) * 100) : 0;

    // Gráfico 1: cuántos autos hay en cada tramo de antigüedad
    const antiguedad = [
      { label: '0–30 d', cantidad: activos.filter((c) => c.diasStock <= 30).length, color: C.teal600 },
      { label: '31–60 d', cantidad: activos.filter((c) => c.diasStock > 30 && c.diasStock <= 60).length, color: C.amber500 },
      { label: '+60 d', cantidad: criticos.length, color: C.red600 },
    ];

    // Gráfico 2: cómo se reparte el stock activo por estado
    const porEstado = ESTADOS.filter((e) => e !== 'Vendido').map((estado) => ({
      estado,
      cantidad: activos.filter((c) => c.estado === estado).length,
    }));

    return {
      valorStock,
      promedioDias,
      margenPromedio,
      margenPct,
      criticos,
      pctCapitalCritico,
      antiguedad,
      porEstado,
      totalActivos: activos.length,
    };
  }, [stock]);

  const filteredStock = useMemo(() => {
    return stock.filter((car) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        car.marca.toLowerCase().includes(query) ||
        car.modelo.toLowerCase().includes(query) ||
        car.patente.toLowerCase().includes(query);
      const matchesChip = filterState === 'Todos' || car.estado === filterState;
      const matchesMarca = !filters.marca || car.marca === filters.marca;
      const matchesAnio = !filters.anio || car.anio.toString() === filters.anio;
      const matchesPrecio = car.precioVenta <= filters.precioMax;
      const matchesEstado = !filters.estado || car.estado === filters.estado;
      return matchesSearch && matchesChip && matchesMarca && matchesAnio && matchesPrecio && matchesEstado;
    });
  }, [stock, searchQuery, filterState, filters]);

  const marcasDisponibles = useMemo(() => [...new Set(stock.map((c) => c.marca))], [stock]);
  const stockById = useMemo(() => new Map(stock.map((car) => [car.id, car])), [stock]);
  const activeStockAuctionMap = useMemo(() => {
    const map = new Map<number, Auction>();
    auctions.forEach((auction) => {
      if (auction.sellerType !== 'propio' || typeof auction.stockId !== 'number') return;
      if (isAuctionFinal(auction) || getAuctionMsLeft(auction, nowTs) <= 0) return;
      map.set(auction.stockId, auction);
    });
    return map;
  }, [auctions, nowTs]);
  const stockAuctionOptions = useMemo(() => {
    return stock
      .filter((car) => car.estado !== 'Vendido' && !activeStockAuctionMap.has(car.id))
      .map((car) => ({
        label: `${car.marca} ${car.modelo} ${car.anio} · ${car.patente || 'Sin patente'}`,
        value: String(car.id),
      }));
  }, [activeStockAuctionMap, stock]);

  // El informe AutoSave no es estado: se deriva del auto y siempre da lo mismo para la
  // misma patente. La automotora tiene acceso libre; lo que se cobra es la copia al cliente.
  const activeInforme = useMemo(() => (activeCar ? generarInformeAutosave(activeCar) : null), [activeCar]);
  const activeBloqueos = useMemo(() => bloqueosTransferencia(activeInforme), [activeInforme]);

  // Clientes filtrados por rol comercial y buscador.
  const filteredCustomers = useMemo(() => {
    const q = clienteSearch.trim().toLowerCase();
    return customers.filter((c) => {
      const roles = normalizeCustomerRoles(c);
      const matchesRole = clienteRoleFilter === 'Todos' || roles.includes(clienteRoleFilter);
      if (!matchesRole) return false;
      if (!q) return true;
      const vehicleLabels = getCustomerVehicleLabels(c, stockById).join(' ').toLowerCase();
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.telefono.toLowerCase().includes(q) ||
        c.interes.toLowerCase().includes(q) ||
        roles.join(' ').toLowerCase().includes(q) ||
        vehicleLabels.includes(q)
      );
    });
  }, [customers, clienteSearch, clienteRoleFilter, stockById]);

  // Autos únicos del stock activo (Marca + Modelo) para el selector de interés
  const uniqueStockOptions = useMemo(() => {
    const set = new Set<string>();
    stock.forEach((c) => set.add(`${c.marca} ${c.modelo}`.trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [stock]);

  // Opciones del dropdown de interés: stock + resguardo del interés personalizado del lead
  const interesOptions = useMemo(() => {
    const opts = uniqueStockOptions.map((v) => ({ label: v, value: v }));
    if (newClient.interes && !uniqueStockOptions.includes(newClient.interes)) {
      opts.unshift({ label: newClient.interes, value: newClient.interes });
    }
    return opts;
  }, [uniqueStockOptions, newClient.interes]);

  /* ------------------- Motor de precios ------------------- */
  const handleAbrirMotor = () => {
    setMotorPatente('');
    setMotorKm('');
    setTasacion(null);
    setMotorCalculando(false);
    setIsMotorOpen(true);
  };

  const handleTasar = () => {
    const km = parseInt(motorKm.replace(/\D/g, ''), 10);
    const vehiculo = buscarPatente(motorPatente);
    if (!vehiculo) {
      showNotification('Ingresa una patente válida (ej: KDPT45).', 'warning');
      return;
    }
    if (!km || km <= 0) {
      showNotification('Ingresa el kilometraje del auto.', 'warning');
      return;
    }
    setTasacion(null);
    setMotorCalculando(true);
    setTimeout(() => {
      setTasacion(tasar(vehiculo, km));
      setMotorCalculando(false);
    }, 700);
  };

  // Pasa la tasación al wizard de carga con el precio de venta y el costo ya propuestos
  const handleTomarAuto = () => {
    if (!tasacion) return;
    const { vehiculo } = tasacion;
    setWizardData({
      ...makeEmptyWizard(),
      patente: normalizarPatente(motorPatente),
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      version: vehiculo.version,
      anio: vehiculo.anio,
      km: tasacion.km,
      transmision: vehiculo.transmision,
      combustible: vehiculo.combustible,
      origen: 'Captación directa',
      precioVenta: tasacion.precioVenta,
      costoAdquisicion: tasacion.ofertaMin,
      comentario: `Tasado con Motor de Precios. Rango de compra ${fmtCLP(tasacion.ofertaMin)} – ${fmtCLP(tasacion.ofertaMax)}.`,
    });
    setCargarStep(1);
    setIsMotorOpen(false);
    setIsCargarAutoOpen(true);
  };

  /* ------------------- Handlers wizard ------------------- */
  const handleAbrirCargaManual = () => {
    setWizardData(makeEmptyWizard());
    setDocumentDraft({ tipo: '', nombre: '', fechaVencimiento: '', archivoNombre: '' });
    setCargarStep(1);
    setIsCargarAutoOpen(true);
  };

  const handleAgregarDesdeSubasta = (auction: Auction) => {
    setWizardData({
      id: null,
      patente: auction.patente || '',
      vin: '',
      tipoVehiculo: 'Vehículo liviano',
      marca: auction.marca,
      modelo: auction.modelo,
      version: auction.version || '',
      anio: auction.anio,
      anioFabricacion: auction.anio,
      sucursal: 'Mayorista',
      fechaIngreso: todayIsoDate(),
      km: auction.km || 0,
      color: auction.color || '',
      transmision: auction.transmision || 'Manual',
      combustible: auction.combustible || 'Bencina',
      traccion: '4x2',
      cilindrada: 0,
      puertas: '',
      equipamiento: [],
      otros: '',
      origen: 'Remate / Subasta',
      precioVenta: auction.sugeridoVenta,
      precioPublicacionContado: auction.sugeridoVenta,
      precioPublicacionFinanciado: 0,
      precioVentaEstimado: auction.sugeridoVenta,
      costoAdquisicion: auction.costoFinal,
      estado: 'Pre-stock',
      diasStock: 1,
      fotos: [],
      comentario: `Procedente de ${auction.origen}.`,
      documentos: [],
      clienteAdquisicion: null,
      comprador: null,
      desdeSubastaId: auction.id,
    });
    setDocumentDraft({ tipo: '', nombre: '', fechaVencimiento: '', archivoNombre: '' });
    setCargarStep(1);
    setIsCargarAutoOpen(true);
  };

  const handleGuardarAutoWizard = () => {
    const isEditing = stock.some((c) => c.id === wizardData.id);
    if (requiresBuyer(wizardData.estado) && !hasContactData(wizardData.comprador)) {
      showNotification('Registra el comprador antes de dejar el auto reservado o vendido.', 'warning');
      return;
    }
    const nuevoAuto: Car = {
      ...wizardData,
      id: wizardData.id || Math.max(0, ...stock.map((c) => c.id)) + 1,
      patente: wizardData.patente.toUpperCase(),
      precioVenta: Number(wizardData.precioPublicacionContado || wizardData.precioVenta),
      precioPublicacionContado: Number(wizardData.precioPublicacionContado || wizardData.precioVenta),
      precioPublicacionFinanciado: Number(wizardData.precioPublicacionFinanciado),
      precioVentaEstimado: Number(wizardData.precioVentaEstimado || wizardData.precioPublicacionContado || wizardData.precioVenta),
      costoAdquisicion: Number(wizardData.costoAdquisicion),
      clienteAdquisicion: cleanVehicleContact(wizardData.clienteAdquisicion),
      comprador: cleanVehicleContact(wizardData.comprador),
    };
    const nextStock = isEditing
      ? stock.map((c) => (c.id === nuevoAuto.id ? nuevoAuto : c))
      : [nuevoAuto, ...stock];
    const synced = syncStockAndCustomers(nextStock, customers);
    const savedAuto = synced.stock.find((c) => c.id === nuevoAuto.id) || nuevoAuto;

    if (isEditing) {
      setStock(synced.stock);
      setCustomers(synced.customers);
      setActiveCar(savedAuto);
      showNotification(`Publicación de ${savedAuto.marca} ${savedAuto.modelo} actualizada correctamente.`);
    } else {
      setStock(synced.stock);
      setCustomers(synced.customers);
      if (wizardData.desdeSubastaId) {
        setAuctions(auctions.filter((a) => a.id !== wizardData.desdeSubastaId));
        showNotification(`¡Excelente! Subasta ganada de ${savedAuto.marca} ${savedAuto.modelo} traspasada a Stock.`);
      } else {
        showNotification(`¡Auto ${savedAuto.marca} ${savedAuto.modelo} agregado al stock con éxito!`);
      }
    }
    setIsCargarAutoOpen(false);
    setActiveTab('stock');
  };

  const handleEditarAuto = (car: Car) => {
    setWizardData({ ...car, desdeSubastaId: car.desdeSubastaId || null });
    setDocumentDraft({ tipo: '', nombre: '', fechaVencimiento: '', archivoNombre: '' });
    setCargarStep(1);
    setIsCargarAutoOpen(true);
  };

  const toggleEquipamiento = (item: string) => {
    setWizardData((prev) => {
      const hasItem = prev.equipamiento.includes(item);
      return {
        ...prev,
        equipamiento: hasItem ? prev.equipamiento.filter((v) => v !== item) : [...prev.equipamiento, item],
      };
    });
  };

  const handleAgregarDocumento = () => {
    if (!documentDraft.tipo) {
      showNotification('Selecciona el tipo de documento antes de agregarlo.', 'warning');
      return;
    }
    const doc: VehicleDocument = {
      id: Date.now(),
      tipo: documentDraft.tipo,
      nombre: documentDraft.nombre || documentDraft.tipo,
      fechaVencimiento: documentDraft.fechaVencimiento,
      archivoNombre: documentDraft.archivoNombre,
    };
    setWizardData((prev) => ({ ...prev, documentos: [doc, ...prev.documentos] }));
    setDocumentDraft({ tipo: '', nombre: '', fechaVencimiento: '', archivoNombre: '' });
  };

  const handleQuitarDocumento = (id: number) => {
    setWizardData((prev) => ({ ...prev, documentos: prev.documentos.filter((doc) => doc.id !== id) }));
  };

  const handleEliminarAuto = (car: Car) => {
    Alert.alert(
      'Eliminar publicación',
      `¿Seguro que quieres eliminar el ${car.marca} ${car.modelo} (${car.patente})? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const nextStock = stock.filter((c) => c.id !== car.id);
            const synced = syncStockAndCustomers(nextStock, customers);
            setStock(synced.stock);
            setCustomers(synced.customers);
            setActiveCar((prev) => (prev && prev.id === car.id ? null : prev));
            showNotification(`Publicación de ${car.marca} ${car.modelo} eliminada.`);
          },
        },
      ],
    );
  };

  const handleGuardarPrecio = () => {
    if (!activeCar) return;
    setStock(
      stock.map((c) => {
        if (c.id === activeCar.id) {
          const actualizado = { ...c, precioVenta: adjustedPrice, precioPublicacionContado: adjustedPrice };
          setActiveCar(actualizado);
          return actualizado;
        }
        return c;
      }),
    );
    setIsPriceSheetOpen(false);
    showNotification('Precio del auto actualizado correctamente.');
  };

  const handleGuardarEstado = () => {
    if (!activeCar) return;
    const nextStatus = selectedStatus as EstadoAuto;
    if (requiresBuyer(nextStatus) && !hasContactData(statusBuyer)) {
      showNotification('Registra el comprador para reservar o vender este auto.', 'warning');
      return;
    }
    const nextStock = stock.map((c) => {
      if (c.id !== activeCar.id) return c;
      return {
        ...c,
        estado: nextStatus,
        comprador: requiresBuyer(nextStatus) ? cleanVehicleContact(statusBuyer) : c.comprador,
        comentario: statusNote || c.comentario,
      };
    });
    const synced = syncStockAndCustomers(nextStock, customers);
    const updatedCar = synced.stock.find((c) => c.id === activeCar.id) || activeCar;
    setStock(synced.stock);
    setCustomers(synced.customers);
    setActiveCar(updatedCar);
    setIsStatusSheetOpen(false);
    showNotification(`Estado cambiado a "${selectedStatus}"`);

    // Recién vendido: se ofrece cerrar la transferencia notarial con AutoSave. El sheet ES
    // el pitch (llega prellenado y con costos); la notificación no es pulsable y no serviría.
    if (nextStatus === 'Vendido' && !updatedCar.transferencia) {
      setTimeout(() => handleAbrirTransferencia(updatedCar), 320); // el sheet anterior tarda 180ms en cerrarse
    }
  };

  /* ------------------- AutoSave ------------------- */
  // activeCar es una COPIA del auto, no un derivado de `stock`: hay que actualizar ambos
  // o la ficha abierta se queda mostrando datos viejos.
  const patchCar = (id: number, patch: Partial<Car>) => {
    setStock((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setActiveCar((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  };

  const handleAbrirEnvioInforme = (car: Car) => {
    const destino: EnvioInforme['destinatario'] = hasContactData(car.comprador)
      ? 'Comprador'
      : hasContactData(car.clienteAdquisicion)
        ? 'Vendedor'
        : 'Otro';
    setEnvioDestinatario(destino);
    setEnvioContacto(contactoParaDestinatario(car, destino));
    setIsEnvioInformeSheetOpen(true);
  };

  const handleCambiarDestinatario = (destino: EnvioInforme['destinatario']) => {
    if (!activeCar) return;
    setEnvioDestinatario(destino);
    setEnvioContacto(contactoParaDestinatario(activeCar, destino));
  };

  const handleEnviarInforme = () => {
    if (!activeCar || !activeInforme) return;
    if (!hasContactData(envioContacto)) {
      showNotification('Ingresa el nombre y teléfono de quien recibirá el informe.', 'warning');
      return;
    }
    const envio: EnvioInforme = {
      id: Date.now(),
      folio: activeInforme.folio,
      fecha: todayIsoDate(),
      destinatario: envioDestinatario,
      nombre: envioContacto.nombre.trim(),
      telefono: envioContacto.telefono.trim(),
      monto: PRECIO_COPIA_INFORME,
    };
    patchCar(activeCar.id, { informesEnviados: [...(activeCar.informesEnviados || []), envio] });
    setIsEnvioInformeSheetOpen(false);
    showNotification(`Copia del informe ${activeInforme.folio} enviada a ${envio.nombre}.`);
    handleWhatsapp(envio.telefono, textoWhatsappInforme(activeCar, activeInforme));
  };

  const handleAbrirTransferencia = (car: Car) => {
    // Traspaso directo solo si hay un dueño anterior registrado a quien transferir.
    const origen: TraspasoOrigen = hasContactData(car.clienteAdquisicion) ? 'Directo' : 'Automotora';
    setTransferOrigen(origen);
    setTransferModalidad('Digital');
    setTransferNotaria(NOTARIAS[0]);
    setTransferPagador('Comprador');
    setIsTransferSheetOpen(true);
  };

  const handleCambiarModalidad = (modalidad: ModalidadTransferencia) => {
    setTransferModalidad(modalidad);
    // La firma electrónica avanzada es la primera notaría del catálogo; la presencial no.
    if (modalidad === 'Digital') setTransferNotaria(NOTARIAS[0]);
    else if (transferNotaria === NOTARIAS[0]) setTransferNotaria(NOTARIAS[1]);
  };

  const handleGenerarTransferencia = () => {
    if (!activeCar || !activeInforme) return;
    if (!hasContactData(activeCar.comprador)) {
      showNotification('Registra al comprador antes de generar la transferencia.', 'warning');
      return;
    }
    if (activeBloqueos.length) {
      showNotification('El informe AutoSave detecta impedimentos para inscribir la transferencia.', 'warning');
      return;
    }
    const vendedor =
      transferOrigen === 'Directo' && hasContactData(activeCar.clienteAdquisicion)
        ? (activeCar.clienteAdquisicion as VehicleContact)
        : { clienteId: null, nombre: AUTOMOTORA.nombre, telefono: AUTOMOTORA.telefono };

    setTransferProcesando(true);
    setTimeout(() => {
      const transferencia = crearTransferencia({
        car: activeCar,
        informe: activeInforme,
        vendedor,
        comprador: activeCar.comprador as VehicleContact,
        origen: transferOrigen,
        modalidad: transferModalidad,
        notaria: transferNotaria,
        responsablePago: transferPagador,
        copiaInformeYaPagada: (activeCar.informesEnviados || []).length > 0,
      });
      patchCar(activeCar.id, { transferencia });
      setTransferProcesando(false);
      setIsTransferSheetOpen(false);
      showNotification(`Transferencia ${transferencia.folio} solicitada a AutoSave.`);
    }, 900);
  };

  const handleAvanzarTransferencia = (car: Car) => {
    if (!car.transferencia) return;
    const siguiente = avanzarTransferencia(car.transferencia);
    if (siguiente.estado === car.transferencia.estado) {
      showNotification('La transferencia ya está inscrita.');
      return;
    }
    patchCar(car.id, { transferencia: siguiente });
    showNotification(`Transferencia actualizada: ${siguiente.estado}.`);
  };

  const handleCompartirTransferencia = (car: Car) => {
    if (!car.transferencia) return;
    handleWhatsapp(car.transferencia.comprador.telefono, textoWhatsappTransferencia(car, car.transferencia));
  };

  // Guarda el informe de inspección IA en la ficha del auto (persiste en AsyncStorage).
  // Las fotos se guardan por URI; el base64 solo vive en memoria durante la sesión.
  const handleGuardarInspeccion = (report: InspectionReport) => {
    setStock((prev) =>
      prev.map((c) => (c.id === report.carId ? { ...c, inspeccion: report } : c)),
    );
    setActiveCar((prev) =>
      prev && prev.id === report.carId ? { ...prev, inspeccion: report } : prev,
    );
    setInspectingCar(null);
    showNotification('Informe de inspección guardado en la ficha del auto.');
  };

  const handleEnviarOfertaSubasta = () => {
    if (!activeAuction) return;
    if (!bidAmount || bidAmount <= 0) {
      showNotification('Ingresa un monto de oferta válido.', 'warning');
      return;
    }
    setAuctions(
      auctions.map((a) => (a.id === activeAuction.id ? { ...a, estado: 'Mis Ofertas', miOferta: bidAmount } : a)),
    );
    setIsAuctionBidSheetOpen(false);
    showNotification(`Oferta sellada de ${fmtCLP(bidAmount)} enviada.`);
  };

  const handleAbrirPublicarSubasta = () => {
    setPublishStockId(stockAuctionOptions[0]?.value || '');
    setSellerNote('');
    setIsAuctionPublishSheetOpen(true);
  };

  const handlePublicarSubastaStock = () => {
    Keyboard.dismiss();
    const car = stock.find((item) => String(item.id) === publishStockId);
    if (!car) {
      showNotification('Selecciona un vehículo del stock.', 'warning');
      return;
    }
    if (!sellerNote.trim()) {
      showNotification('Agrega una nota abierta para los compradores.', 'warning');
      return;
    }

    const startedAt = Date.now();
    const auction: Auction = {
      id: Math.max(100, ...auctions.map((a) => a.id)) + 1,
      marca: car.marca,
      modelo: car.modelo,
      version: car.version,
      anio: car.anio,
      origen: 'Mi stock',
      costoFinal: car.costoAdquisicion,
      sugeridoVenta: car.precioVenta,
      patente: car.patente,
      km: car.km,
      color: car.color,
      transmision: car.transmision,
      combustible: car.combustible,
      imageUrl: car.fotos[0] || '',
      estado: 'Mi Subasta',
      sellerType: 'propio',
      stockId: car.id,
      sellerNote: sellerNote.trim(),
      startedAt: new Date(startedAt).toISOString(),
      endsAt: new Date(startedAt + AUCTION_DURATION_MS).toISOString(),
      receivedOffers: [],
    };

    const nextStock = stock.map((item) => (item.id === car.id ? { ...item, estado: 'En venta' as EstadoAuto } : item));
    const synced = syncStockAndCustomers(nextStock, customers);
    setStock(synced.stock);
    setCustomers(synced.customers);
    setActiveCar((prev) => (prev?.id === car.id ? synced.stock.find((item) => item.id === car.id) || prev : prev));
    setAuctions([auction, ...auctions]);
    setIsAuctionPublishSheetOpen(false);
    setSubastaTab('mis_subastas');
    showNotification(`${car.marca} ${car.modelo} publicado a subasta por 4 horas.`);
  };

  const handleAbrirCaracteristicasSubasta = (auction: Auction) => {
    setActiveAuction(auction);
    setIsAuctionFeaturesSheetOpen(true);
  };

  const handleCancelarSubastaPropia = (auction: Auction) => {
    Alert.alert(
      'Cancelar subasta',
      `¿Quieres quitar el ${auction.marca} ${auction.modelo} de la subasta activa?`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cancelar subasta',
          style: 'destructive',
          onPress: () => {
            setAuctions((prev) =>
              prev.map((item) => (item.id === auction.id ? { ...item, estado: 'Cancelada' } : item)),
            );
            showNotification(`${auction.marca} ${auction.modelo} fue quitado de subasta.`, 'warning');
          },
        },
      ],
    );
  };

  const handleAbrirNuevoCliente = () => {
    setNewClient({ id: null, nombre: '', telefono: '', tipo: 'Particular', estado: 'Nuevo', interes: '', rol: 'Venta' });
    setIsNewClientSheetOpen(true);
  };

  const handleEditarCliente = (client: Customer) => {
    setNewClient({
      id: client.id,
      nombre: client.nombre,
      telefono: client.telefono,
      tipo: client.tipo,
      estado: client.estado,
      interes: client.interes,
      rol: roleFormFromRoles(client.roles),
    });
    setIsNewClientSheetOpen(true);
  };

  const handleGuardarCliente = () => {
    if (!newClient.nombre) return;
    const roles = rolesFromForm(newClient.rol);
    if (newClient.id) {
      const existing = customers.find((c) => c.id === newClient.id);
      const updated: Customer = {
        id: newClient.id,
        nombre: newClient.nombre,
        telefono: newClient.telefono,
        tipo: newClient.tipo,
        estado: newClient.estado,
        interes: newClient.interes,
        reservadoId: existing?.reservadoId ?? null,
        roles,
        vehiculosAdquisicionIds: existing?.vehiculosAdquisicionIds ?? [],
        vehiculosVentaIds: existing?.vehiculosVentaIds ?? [],
      };
      const nextCustomers = customers.map((c) => (c.id === updated.id ? updated : c));
      const nextStock = stock.map((car) => updateCarContactForCustomer(car, updated));
      const synced = syncStockAndCustomers(nextStock, nextCustomers);
      setStock(synced.stock);
      setCustomers(synced.customers);
      setActiveCar((prev) => (prev ? synced.stock.find((car) => car.id === prev.id) || prev : prev));
      setIsNewClientSheetOpen(false);
      setNewClient({ id: null, nombre: '', telefono: '', tipo: 'Particular', estado: 'Nuevo', interes: '', rol: 'Venta' });
      showNotification('Cliente actualizado correctamente.');
      return;
    }
    const client: Customer = {
      id: Math.max(0, ...customers.map((c) => c.id)) + 1,
      nombre: newClient.nombre,
      telefono: newClient.telefono,
      tipo: newClient.tipo,
      estado: newClient.estado || 'Nuevo',
      interes: newClient.interes,
      reservadoId: null,
      roles,
      vehiculosAdquisicionIds: [],
      vehiculosVentaIds: [],
    };
    setCustomers([...customers, client]);
    setIsNewClientSheetOpen(false);
    setNewClient({ id: null, nombre: '', telefono: '', tipo: 'Particular', estado: 'Nuevo', interes: '', rol: 'Venta' });
    showNotification('Cliente registrado con éxito.');
  };

  const handleEliminarCliente = (client: Customer) => {
    Alert.alert('Eliminar cliente', `¿Seguro que quieres eliminar a ${client.nombre}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setCustomers((prev) => prev.filter((c) => c.id !== client.id));
          showNotification(`Cliente ${client.nombre} eliminado.`);
        },
      },
    ]);
  };

  // Llamada telefónica real (equivale al href="tel:..." del HTML)
  const handleLlamar = (telefono: string) => {
    const num = telefono.replace(/[^\d+]/g, '');
    if (!num) {
      showNotification('Este cliente no tiene teléfono registrado.', 'warning');
      return;
    }
    Linking.openURL(`tel:${num}`).catch(() => showNotification('No se pudo iniciar la llamada.', 'warning'));
  };

  // WhatsApp real (equivale al href="https://wa.me/..." con código de país Chile 56)
  const handleWhatsapp = (telefono: string, texto?: string) => {
    let num = (telefono || '').replace(/\D/g, '');
    if (!num) {
      showNotification('Este cliente no tiene teléfono registrado.', 'warning');
      return;
    }
    if (!num.startsWith('56')) num = `56${num}`;
    const url = texto ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}` : `https://wa.me/${num}`;
    Linking.openURL(url).catch(() => showNotification('No se pudo abrir WhatsApp.', 'warning'));
  };

  // Actualiza el estado del trato directamente desde la tarjeta
  const handleUpdateClienteEstado = (id: number, estado: string) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, estado } : c)));
  };

  // Salta al detalle del auto de interés dentro del stock
  const verInteresEnStock = (interes: string) => {
    const key = (interes || '').split(' ')[0];
    const match = stock.find((c) => c.modelo === key || c.marca === key);
    if (match) setActiveCar(match);
    else showNotification('Auto no disponible de momento.', 'warning');
  };

  /* ------------------- Cámara / Galería reales ------------------- */
  const handleCapturarFoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showNotification('Permiso de cámara denegado. Actívalo en Ajustes.', 'warning');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.length) {
      setWizardData((prev) => ({ ...prev, fotos: [result.assets[0].uri, ...prev.fotos] }));
      showNotification('Foto capturada con éxito.');
    }
  };

  const handleGaleria = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showNotification('Permiso de galería denegado. Actívalo en Ajustes.', 'warning');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 8,
    });
    if (!result.canceled && result.assets?.length) {
      const uris = result.assets.map((a) => a.uri);
      setWizardData((prev) => ({ ...prev, fotos: [...uris, ...prev.fotos] }));
      showNotification(`${uris.length} foto(s) agregada(s) desde galería.`);
    }
  };

  const handleQuitarFoto = (idx: number) => {
    setWizardData((prev) => ({ ...prev, fotos: prev.fotos.filter((_, i) => i !== idx) }));
  };

  /* ============================ RENDER ============================ */
  const adjudicadasCount = auctions.filter((a) => a.estado === 'Adjudicada').length;

  return (
    <View style={s.root}>
      <View style={s.frame}>
        {/* HEADER */}
        <View
          style={[
            s.header,
            { paddingTop: insets.top + 12, paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right },
          ]}
        >
          <Image source={require('./logoauto.jpg')} style={s.logoImg} resizeMode="contain" />
        </View>

        {/* MAIN SCROLL */}
        <ScrollView
          style={s.main}
          contentContainerStyle={[
            s.mainContent,
            { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'inicio' && renderInicio()}
          {activeTab === 'stock' && renderStock()}
          {activeTab === 'subastas' && renderSubastas()}
          {activeTab === 'clientes' && renderClientes()}
        </ScrollView>

        {/* NAV INFERIOR */}
        <View
          style={[
            s.nav,
            { paddingBottom: insets.bottom || 8, paddingLeft: 8 + insets.left, paddingRight: 8 + insets.right },
          ]}
        >
          <NavButton icon="house-chimney" label="Inicio" active={activeTab === 'inicio'} onPress={() => setActiveTab('inicio')} />
          <NavButton icon="warehouse" label="Stock" active={activeTab === 'stock'} onPress={() => setActiveTab('stock')} />

          {/* Botón + flotante */}
          <View style={s.fabWrap}>
            <TouchableOpacity activeOpacity={0.85} onPress={handleAbrirCargaManual} style={s.fab}>
              <Icon name="plus" size={20} color={C.white} />
            </TouchableOpacity>
          </View>

          <NavButton
            icon="gavel"
            label="Subastas"
            active={activeTab === 'subastas'}
            onPress={() => setActiveTab('subastas')}
            badge={adjudicadasCount}
          />
          <NavButton icon="user-group" label="Clientes" active={activeTab === 'clientes'} onPress={() => setActiveTab('clientes')} />
        </View>

        {/* OVERLAYS Y SHEETS (dentro del frame, apilados como en el HTML base) */}
        {renderCarDetail()}
        {/* PageOverlay no usa zIndex: se pinta por orden, así el informe queda sobre la ficha */}
        {renderAutosaveReport()}
        {renderMotorPrecios()}
        {inspectingCar && (
          <InspectionScreen
            car={inspectingCar}
            existingReport={inspectingCar.inspeccion ?? null}
            onClose={() => setInspectingCar(null)}
            onSave={handleGuardarInspeccion}
            notify={showNotification}
          />
        )}
        {renderWizard()}
        {renderFilterSheet()}
        {renderPriceSheet()}
        {renderStatusSheet()}
        {renderAuctionBidSheet()}
        {renderAuctionPublishSheet()}
        {renderAuctionFeaturesSheet()}
        {renderNewClientSheet()}
        {renderEnvioInformeSheet()}
        {renderTransferSheet()}

        {/* NOTIFICACIÓN (siempre encima de todo) */}
        {notification && (
          <NotificationBanner message={notification.message} type={notification.type} top={insets.top + 8} />
        )}
      </View>
    </View>
  );

  /* ======================= PANTALLA INICIO ======================= */
  function renderInicio() {
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

        {/* KPIs — cada uno con una lectura en lenguaje simple */}
        <View style={{ gap: 12 }}>
          <Text style={s.sectionLabel}>Resumen</Text>
          <View style={s.kpiRow}>
            <KpiCard
              label="Margen por auto"
              value={fmtCLP(kpis.margenPromedio)}
              insight={`Ganas ${kpis.margenPct}% sobre lo que pagaste`}
              color={C.emerald600}
            />
            <KpiCard
              label="Capital en autos"
              value={fmtCLP(kpis.valorStock)}
              insight={`${kpis.totalActivos} ${kpis.totalActivos === 1 ? 'auto' : 'autos'} sin vender`}
              color={C.brand}
            />
            <KpiCard
              label="Días promedio"
              value={`${kpis.promedioDias} días`}
              insight={
                kpis.criticos.length > 0
                  ? `${kpis.pctCapitalCritico}% de tu plata lleva +60 días detenida`
                  : 'Toda tu plata rota en menos de 60 días'
              }
              color={kpis.criticos.length > 0 ? C.amber600 : C.emerald600}
            />
          </View>
        </View>

        {/* GRÁFICOS */}
        <View style={{ gap: 12 }}>
          <Text style={s.sectionLabel}>Tu stock</Text>

          <View style={s.chartCard}>
            <Text style={s.chartTitle}>¿Hace cuánto tienes cada auto?</Text>
            <BarsAntiguedad data={kpis.antiguedad} />
          </View>

          <View style={s.chartCard}>
            <Text style={s.chartTitle}>¿En qué etapa está tu stock?</Text>
            <BarsEstado data={kpis.porEstado} total={kpis.totalActivos} />
          </View>
        </View>
      </View>
    );
  }

  /* ======================= PANTALLA STOCK ======================= */
  function renderStock() {
    const chips = ['Todos', 'Pre-stock', 'En preparación', 'En venta', 'Reservado', 'Vendido'];
    return (
      <View style={{ gap: 16 }}>
        <View style={s.rowBetween}>
          <Text style={s.h2Black}>Stock de Vehículos</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setIsFilterSheetOpen(true)} style={s.filterBtn}>
            <Icon name="sliders" size={12} color={C.slate700} />
            <Text style={s.filterBtnText}>Filtros</Text>
          </TouchableOpacity>
        </View>

        {/* Buscar */}
        <View style={s.searchWrap}>
          <Icon name="magnifying-glass" size={14} color={C.slate400} style={{ marginLeft: 14 }} />
          <TextInput
            placeholder="Buscar por marca, modelo o patente..."
            placeholderTextColor={C.slate400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={s.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ paddingHorizontal: 12 }}>
              <Icon name="circle-xmark" size={16} color={C.slate400} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {chips.map((est) => {
            const cant = est === 'Todos' ? stock.length : stock.filter((c) => c.estado === est).length;
            const isSelected = filterState === est;
            return (
              <TouchableOpacity
                key={est}
                activeOpacity={0.8}
                onPress={() => setFilterState(est)}
                style={[s.chip, isSelected ? s.chipActive : s.chipInactive]}
              >
                <Text style={[s.chipText, { color: isSelected ? C.white : C.slate600 }]}>{est}</Text>
                <View style={[s.chipCount, { backgroundColor: isSelected ? C.chileanTeal : C.slate100 }]}>
                  <Text style={{ fontSize: 10, color: isSelected ? C.white : C.slate500, fontWeight: W.bold }}>{cant}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Listado */}
        <View style={{ gap: 12 }}>
          {filteredStock.length === 0 ? (
            <View style={s.emptyBox}>
              <Icon name="car-side" size={40} color={C.slate300} />
              <Text style={s.emptyText}>No encontramos autos con esos filtros</Text>
              <TouchableOpacity
                onPress={() => {
                  setFilterState('Todos');
                  setFilters({ marca: '', anio: '', precioMax: 20000000, estado: '' });
                  setSearchQuery('');
                }}
              >
                <Text style={s.resetText}>Restablecer filtros</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredStock.map((car) => {
              const badge = badgeForEstado(car.estado);
              const activeStockAuction = activeStockAuctionMap.get(car.id);
              return (
                <TouchableOpacity key={car.id} activeOpacity={0.9} onPress={() => setActiveCar(car)} style={s.carCard}>
                  <View style={s.carThumb}>
                    {car.fotos.length > 0 ? (
                      <Image source={{ uri: car.fotos[0] }} style={s.carThumbImg} />
                    ) : (
                      <View style={s.carThumbEmpty}>
                        <Icon name="car-side" size={22} color={C.slate300} />
                      </View>
                    )}
                    {car.diasStock > 60 && car.estado !== 'Vendido' && (
                      <View style={s.badge60}>
                        <Icon name="clock" size={8} color={C.white} />
                        <Text style={s.badge60Text}>+60 DÍAS</Text>
                      </View>
                    )}
                    {activeStockAuction && (
                      <View style={s.auctionThumbBadge}>
                        <Icon name="gavel" size={8} color={C.white} />
                        <Text style={s.badge60Text}>SUBASTA</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1, justifyContent: 'space-between' }}>
                    <View>
                      <View style={[s.rowBetween, { alignItems: 'flex-start' }]}>
                        <Text style={s.carTitle} numberOfLines={1}>
                          {car.marca} {car.modelo}
                        </Text>
                        <View style={s.rowCenter}>
                          <View style={s.patentePill}>
                            <Text style={s.patenteText}>{car.patente}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleEliminarAuto(car);
                            }}
                            style={s.trashSm}
                          >
                            <Wiggle>
                              <Icon name="trash-can" size={11} color={C.red600} />
                            </Wiggle>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={s.carSpecs}>
                        {car.anio} • {fmtMiles(car.km)} km • {car.transmision}
                      </Text>
                    </View>

                    <View style={[s.rowBetween, { alignItems: 'flex-end', marginTop: 8 }]}>
                      <View>
                        <Text style={s.priceLabel}>Precio Venta</Text>
                        <Text style={s.priceValue}>{fmtCLP(car.precioVenta)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={[s.estadoBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                          <Text style={{ fontSize: 10, fontWeight: W.extrabold, color: badge.color }}>{car.estado}</Text>
                        </View>
                        {activeStockAuction && (
                          <View style={s.stockAuctionPill}>
                            <Icon name="clock" size={8} color={C.amber700} />
                            <Text style={s.stockAuctionText}>En subasta</Text>
                          </View>
                        )}
                        <Text style={s.diasStock}>
                          {car.diasStock} {car.diasStock === 1 ? 'día' : 'días'} en stock
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>
    );
  }

  /* ======================= PANTALLA SUBASTAS ======================= */
  function renderSubastas() {
    const lista = auctions.filter((a) => {
      const active = !isAuctionFinal(a) && getAuctionMsLeft(a, nowTs) > 0;
      if (subastaTab === 'disponibles') return active && a.sellerType === 'externo' && !a.miOferta;
      if (subastaTab === 'ofertas') return active && a.sellerType === 'externo' && !!a.miOferta;
      if (subastaTab === 'mis_subastas') return active && a.sellerType === 'propio';
      if (subastaTab === 'finalizadas') return !active || isAuctionFinal(a);
      return false;
    });
    const counts = {
      disponibles: auctions.filter((a) => !isAuctionFinal(a) && getAuctionMsLeft(a, nowTs) > 0 && a.sellerType === 'externo' && !a.miOferta).length,
      ofertas: auctions.filter((a) => !isAuctionFinal(a) && getAuctionMsLeft(a, nowTs) > 0 && a.sellerType === 'externo' && !!a.miOferta).length,
      misSubastas: auctions.filter((a) => !isAuctionFinal(a) && getAuctionMsLeft(a, nowTs) > 0 && a.sellerType === 'propio').length,
      finalizadas: auctions.filter((a) => isAuctionFinal(a) || getAuctionMsLeft(a, nowTs) <= 0).length,
    };
    return (
      <View style={{ gap: 16 }}>
        <View style={s.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={s.h2Black}>Mesa de Subastas</Text>
            <Text style={s.subMuted}>Compra y vende stock en subastas selladas de 4 horas</Text>
          </View>
          <TouchableOpacity activeOpacity={0.85} onPress={handleAbrirPublicarSubasta} style={s.publishAuctionBtn}>
            <Icon name="plus" size={12} color={C.white} />
            <Text style={s.publishAuctionText}>Subastar</Text>
          </TouchableOpacity>
        </View>

        {/* Sub-tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {(
            [
              { key: 'disponibles', label: 'Disponibles', count: counts.disponibles },
              { key: 'ofertas', label: 'Ofertas', count: counts.ofertas },
              { key: 'mis_subastas', label: 'Mis subastas', count: counts.misSubastas },
              { key: 'finalizadas', label: 'Finalizadas', count: counts.finalizadas },
            ] as { key: SubastaTabKey; label: string; count: number }[]
          ).map((tab) => {
            const isSelected = subastaTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.8}
                onPress={() => setSubastaTab(tab.key)}
                style={[s.chip, isSelected ? s.chipActive : s.chipInactive]}
              >
                <Text style={[s.chipText, { color: isSelected ? C.white : C.slate600 }]}>{tab.label}</Text>
                <View style={[s.chipCount, { backgroundColor: isSelected ? C.chileanTeal : C.slate100 }]}>
                  <Text style={{ fontSize: 10, color: isSelected ? C.white : C.slate500, fontWeight: W.bold }}>{tab.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={{ gap: 12 }}>
          {lista.map((auc) => {
            const msLeft = getAuctionMsLeft(auc, nowTs);
            const active = !isAuctionFinal(auc) && msLeft > 0;
            const sealedCount = auc.sellerType === 'propio' ? auc.receivedOffers?.length || 0 : undefined;
            const status = getAuctionStatusCopy(auc, active);
            const stockCar = auc.stockId ? stockById.get(auc.stockId) : null;
            const auctionImageUrl = getAuctionImageUrl(auc, stockCar);
            return (
              <View key={auc.id} style={s.aucCard}>
                <View style={[s.rowBetween, { alignItems: 'flex-start' }]}>
                  <View style={s.auctionLead}>
                    <Image source={{ uri: auctionImageUrl }} style={s.auctionThumb} />
                    <View style={{ flex: 1 }}>
                      <View style={s.aucBadgeRow}>
                        <View style={s.origenPill}>
                          <Text style={s.origenText}>{auc.origen}</Text>
                        </View>
                        <View style={[s.auctionStatusPill, { backgroundColor: status.bg }]}>
                          <Text style={[s.auctionStatusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>
                      {stockCar ? (
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => setActiveCar(stockCar)}
                          style={s.auctionTitleTap}
                        >
                          <Text style={[s.aucTitle, { color: C.chileanTeal }]}>
                            {auc.marca} {auc.modelo}
                          </Text>
                          <Icon name="arrow-up-right-from-square" size={9} color={C.chileanTeal} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleAbrirCaracteristicasSubasta(auc)}
                          style={s.auctionTitleTap}
                        >
                          <Text style={[s.aucTitle, { color: C.chileanTeal }]}>
                            {auc.marca} {auc.modelo}
                          </Text>
                          <Icon name="circle-info" size={10} color={C.chileanTeal} />
                        </TouchableOpacity>
                      )}
                      <Text style={s.aucSub}>
                        {auc.anio} • {auc.version}
                      </Text>
                      {stockCar ? <Text style={s.aucStockLink}>Desde stock: {stockCar.estado}</Text> : null}
                      {!stockCar && (
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleAbrirCaracteristicasSubasta(auc)}
                          style={s.auctionFeatureHint}
                        >
                          <Icon name="list-check" size={9} color={C.chileanTeal} />
                          <Text style={s.auctionFeatureHintText}>Características</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={s.aucId}>ID: #{auc.id}</Text>
                    <View style={[s.timePill, !active && s.timePillDone]}>
                      <Icon name="clock" size={9} color={active ? C.amber700 : C.slate500} />
                      <Text style={[s.timePillText, !active && { color: C.slate500 }]}>
                        {active ? formatAuctionRemaining(msLeft) : 'Finalizada'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={s.auctionNoteBox}>
                  <Text style={s.auctionNoteLabel}>Nota del vendedor</Text>
                  <Text style={s.auctionNoteText}>{auc.sellerNote}</Text>
                </View>

                <View style={s.aucSpecs}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.aucSpecLabel}>Patente</Text>
                    <Text style={s.aucSpecValue}>{auc.patente || 'Por asignar'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.aucSpecLabel}>Kilometraje</Text>
                    <Text style={s.aucSpecValue}>{fmtMiles(auc.km)} km</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.aucSpecLabel}>Transmisión</Text>
                    <Text style={s.aucSpecValue}>{auc.transmision}</Text>
                  </View>
                </View>

                <View style={s.auctionProgressTrack}>
                  <View style={[s.auctionProgressFill, { width: `${getAuctionProgressPct(auc, nowTs)}%` }]} />
                </View>

                <View style={[s.rowBetween, { paddingTop: 8, borderTopWidth: 1, borderTopColor: C.slate100 }]}>
                  <View style={{ flex: 1 }}>
                    {auc.estado === 'Cancelada' ? (
                      <>
                        <Text style={s.aucMoneyLabel}>Estado</Text>
                        <Text style={[s.aucMoney, { color: C.red700 }]}>Subasta cancelada</Text>
                      </>
                    ) : auc.sellerType === 'propio' && active ? (
                      <>
                        <Text style={s.aucMoneyLabel}>Ofertas recibidas</Text>
                        <Text style={s.aucMoney}>{sealedCount} selladas</Text>
                      </>
                    ) : auc.estado === 'Adjudicada' ? (
                      <>
                        <Text style={s.aucMoneyLabel}>Tu oferta ganadora</Text>
                        <Text style={[s.aucMoney, { color: C.teal600 }]}>{fmtCLP(auc.miOferta || auc.costoFinal)}</Text>
                      </>
                    ) : auc.estado === 'Vendida' ? (
                      <>
                        <Text style={s.aucMoneyLabel}>Mejor oferta recibida</Text>
                        <Text style={[s.aucMoney, { color: C.teal600 }]}>{fmtCLP(auc.winningBid || auc.costoFinal)}</Text>
                      </>
                    ) : auc.miOferta ? (
                      <>
                        <Text style={s.aucMoneyLabel}>Mi oferta sellada</Text>
                        <Text style={s.aucMoney}>{fmtCLP(auc.miOferta)}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={s.aucMoneyLabel}>Modalidad</Text>
                        <Text style={s.aucMoney}>Sobre cerrado</Text>
                      </>
                    )}
                  </View>

                  {auc.estado === 'Disponible' && active && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setActiveAuction(auc);
                        setBidAmount(suggestSealedBid(auc));
                        setIsAuctionBidSheetOpen(true);
                      }}
                      style={s.ofertarBtn}
                    >
                      <Text style={s.ofertarBtnText}>Ofertar</Text>
                    </TouchableOpacity>
                  )}

                  {auc.estado === 'Mis Ofertas' && active && (
                    <View style={s.pendingPill}>
                      <Spinner size={11} color={C.amber600} />
                      <Text style={s.pendingText}>Pendiente</Text>
                    </View>
                  )}

                  {auc.estado === 'Mi Subasta' && active && (
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <View style={s.pendingPill}>
                        <Icon name="lock" size={10} color={C.amber600} />
                        <Text style={s.pendingText}>Sellada</Text>
                      </View>
                      {stockCar && (
                        <TouchableOpacity activeOpacity={0.85} onPress={() => setActiveCar(stockCar)} style={s.viewStockBtn}>
                          <Icon name="circle-info" size={10} color={C.chileanTeal} />
                          <Text style={s.viewStockText}>Ver ficha</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity activeOpacity={0.85} onPress={() => handleCancelarSubastaPropia(auc)} style={s.cancelAuctionBtn}>
                        <Icon name="ban" size={10} color={C.red700} />
                        <Text style={s.cancelAuctionText}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {auc.estado === 'Adjudicada' && (
                    <Pulse>
                      <TouchableOpacity activeOpacity={0.85} onPress={() => handleAgregarDesdeSubasta(auc)} style={s.addStockBtn}>
                        <Icon name="cloud-arrow-down" size={11} color={C.white} />
                        <Text style={s.addStockText}>Agregar al Stock</Text>
                      </TouchableOpacity>
                    </Pulse>
                  )}
                </View>
              </View>
            );
          })}

          {lista.length === 0 && (
            <View style={s.emptyBox}>
              <Icon name="gavel" size={40} color={C.slate300} />
              <Text style={[s.emptyText, { fontSize: 12 }]}>No hay subastas en esta categoría por ahora</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  /* ======================= PANTALLA CLIENTES ======================= */
  function renderClientes() {
    return (
      <View style={{ gap: 16 }}>
        <View style={s.rowBetween}>
          <View>
            <Text style={s.h2Black}>Clientes & Leads</Text>
            <Text style={s.subMuted}>Adquisición, reservas y compradores</Text>
          </View>
          <TouchableOpacity activeOpacity={0.85} onPress={handleAbrirNuevoCliente} style={s.newClientBtn}>
            <Icon name="user-plus" size={12} color={C.white} />
            <Text style={s.newClientText}>Nuevo</Text>
          </TouchableOpacity>
        </View>

        {/* Métricas */}
        <View style={s.metricRow}>
          <View style={s.metricCell}>
            <Text style={s.metricLabel}>Total</Text>
            <Text style={s.metricValue}>{customers.length}</Text>
          </View>
          <View style={s.metricCell}>
            <Text style={s.metricLabel}>Adquisición</Text>
            <Text style={s.metricValue}>{customers.filter((c) => normalizeCustomerRoles(c).includes('Adquisición')).length}</Text>
          </View>
          <View style={s.metricCell}>
            <Text style={s.metricLabel}>Venta</Text>
            <Text style={s.metricValue}>{customers.filter((c) => normalizeCustomerRoles(c).includes('Venta')).length}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {(['Todos', 'Adquisición', 'Venta'] as const).map((role) => {
            const isSelected = clienteRoleFilter === role;
            const count = role === 'Todos'
              ? customers.length
              : customers.filter((c) => normalizeCustomerRoles(c).includes(role)).length;
            return (
              <TouchableOpacity
                key={role}
                activeOpacity={0.8}
                onPress={() => setClienteRoleFilter(role)}
                style={[s.chip, isSelected ? s.chipActive : s.chipInactive]}
              >
                <Text style={[s.chipText, { color: isSelected ? C.white : C.slate600 }]}>{role}</Text>
                <View style={[s.chipCount, { backgroundColor: isSelected ? C.chileanTeal : C.slate100 }]}>
                  <Text style={{ fontSize: 10, color: isSelected ? C.white : C.slate500, fontWeight: W.bold }}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Buscador */}
        <View style={s.searchWrap}>
          <Icon name="magnifying-glass" size={14} color={C.slate400} style={{ marginLeft: 14 }} />
          <TextInput
            placeholder="Buscar por nombre, teléfono o interés..."
            placeholderTextColor={C.slate400}
            value={clienteSearch}
            onChangeText={setClienteSearch}
            style={s.searchInput}
          />
          {clienteSearch ? (
            <TouchableOpacity onPress={() => setClienteSearch('')} style={{ paddingHorizontal: 12 }}>
              <Icon name="circle-xmark" size={16} color={C.slate400} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Lista unificada de leads */}
        <View style={{ gap: 12 }}>
          {filteredCustomers.length === 0 ? (
            <View style={s.cliEmpty}>
              <Icon name="user-slash" size={18} color={C.slate400} />
              <Text style={s.cliEmptyText}>No hay clientes que coincidan con la búsqueda.</Text>
            </View>
          ) : (
            filteredCustomers.map((cli) => {
              const eb = badgeForEstadoCliente(cli.estado);
              const roles = normalizeCustomerRoles(cli);
              const vehicleLabels = getCustomerVehicleLabels(cli, stockById);
              const firstVehicleId = [...(cli.vehiculosAdquisicionIds || []), ...(cli.vehiculosVentaIds || [])][0];
              const firstVehicle = firstVehicleId ? stockById.get(firstVehicleId) : null;
              return (
                <View key={cli.id} style={s.cliCard}>
                  {/* Cabecera: nombre + estado + acciones */}
                  <View style={s.cliCardHead}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={s.cliNombre}>{cli.nombre}</Text>
                      <View style={s.cliBadgeRow}>
                        <View style={[s.cliEstadoBadge, { backgroundColor: eb.bg }]}>
                          <Text style={[s.cliEstadoText, { color: eb.color }]}>{cli.estado}</Text>
                        </View>
                        {roles.map((role) => {
                          const rb = badgeForClienteRol(role);
                          return (
                            <View key={role} style={[s.cliEstadoBadge, { backgroundColor: rb.bg }]}>
                              <Text style={[s.cliEstadoText, { color: rb.color }]}>{role}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                    <View style={s.rowCenter}>
                      <TouchableOpacity onPress={() => handleEditarCliente(cli)} style={s.cliIconBtn}>
                        <Icon name="pen-to-square" size={12} color={C.slate500} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleEliminarCliente(cli)} style={s.cliIconBtn}>
                        <Wiggle>
                          <Icon name="trash-can" size={12} color={C.red600} />
                        </Wiggle>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Grid simétrico: Teléfono | Relación con stock */}
                  <View style={s.cliGrid}>
                    <View style={s.cliGridCell}>
                      <Text style={s.cliGridLabel}>Teléfono</Text>
                      <Text style={s.cliGridValue} numberOfLines={1}>
                        {cli.telefono || '—'}
                      </Text>
                    </View>
                    <View style={[s.cliGridCell, s.cliGridCellRight]}>
                      <View style={s.rowBetween}>
                        <Text style={s.cliGridLabel}>Relación Stock</Text>
                        {firstVehicle ? (
                          <TouchableOpacity onPress={() => setActiveCar(firstVehicle)}>
                            <Text style={s.cliVerLink}>Ver</Text>
                          </TouchableOpacity>
                        ) : cli.interes ? (
                          <TouchableOpacity onPress={() => verInteresEnStock(cli.interes)}>
                            <Text style={s.cliVerLink}>Interés</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <Text style={s.cliGridValue} numberOfLines={1}>
                        {vehicleLabels.length ? vehicleLabels.join(' / ') : cli.interes || '—'}
                      </Text>
                    </View>
                  </View>

                  {/* Selector de estado táctil a ancho completo */}
                  <View style={s.cliStatusBlock}>
                    <Text style={s.cliGridLabel}>Estado del trato</Text>
                    <Dropdown
                      value={cli.estado}
                      onChange={(v) => handleUpdateClienteEstado(cli.id, v)}
                      options={ESTADO_CLIENTE_OPTIONS}
                    />
                  </View>

                  {/* Botones de contacto unificados */}
                  <View style={s.cliActions}>
                    <TouchableOpacity onPress={() => handleLlamar(cli.telefono)} style={s.cliCallBtn}>
                      <Icon name="phone" size={13} color={C.slate700} />
                      <Text style={s.cliCallText}>Llamar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleWhatsapp(cli.telefono)} style={s.cliWspBtn}>
                      <Icon name="comment-dots" size={14} color={C.white} />
                      <Text style={s.cliWspText}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  }

  /* ======================= MOTOR DE PRECIOS ======================= */
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
          <View style={{ flex: 1 }}>
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
          <Text style={s.motorResultRange}>{fmtCLP(t.ofertaMin)}</Text>
          <Text style={s.motorResultAnd}>y</Text>
          <Text style={s.motorResultRange}>{fmtCLP(t.ofertaMax)}</Text>
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

  /* ======================= WIZARD CARGAR AUTO ======================= */
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
                <Text style={s.stepPillText}>Paso {cargarStep} de 5</Text>
              </View>
            </View>

            {/* Progreso */}
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(cargarStep / 5) * 100}%` }]} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {cargarStep === 1 && renderWizardStep1()}
              {cargarStep === 2 && renderWizardStep2()}
              {cargarStep === 3 && renderWizardStep3()}
              {cargarStep === 4 && renderWizardStep4()}
              {cargarStep === 5 && renderWizardStep5()}
            </ScrollView>

            {/* Botonera */}
            <View style={[s.wizardFooter, { paddingBottom: (insets.bottom || 8) + 16 }]}>
              {cargarStep > 1 && (
                <TouchableOpacity onPress={() => setCargarStep(cargarStep - 1)} style={s.wizardBack}>
                  <Text style={s.wizardBackText}>Atrás</Text>
                </TouchableOpacity>
              )}
              {cargarStep < 5 ? (
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
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <TouchableOpacity onPress={handleCapturarFoto} style={s.captureBtn}>
              <Icon name="camera" size={12} color={C.white} />
              <Text style={s.captureText}>Capturar Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleGaleria} style={s.galleryBtn}>
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
          <Text style={s.stepTitle}>Identificación Básica</Text>
          <Text style={s.stepSub}>Datos visibles en el módulo Stock desktop para identificar la unidad.</Text>
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
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Sucursal</Text>
              <Dropdown
                value={wizardData.sucursal}
                onChange={(v) => setWizardData({ ...wizardData, sucursal: v })}
                options={SUCURSAL_OPTIONS.map((v) => ({ label: v, value: v }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Estado Inicial</Text>
              <Dropdown
                value={wizardData.estado}
                onChange={(v) => setWizardData({ ...wizardData, estado: v as EstadoAuto })}
                options={ESTADOS.map((v) => ({ label: v, value: v }))}
              />
            </View>
          </View>
          <DateField label="Fecha de Ingreso" value={wizardData.fechaIngreso} onChange={(fechaIngreso) => setWizardData({ ...wizardData, fechaIngreso })} />
          <Field label="Origen" placeholder="Ej: Retoma, Subasta, Importación" value={wizardData.origen} onChange={(t) => setWizardData({ ...wizardData, origen: t })} />
          <View style={s.inlinePanel}>
            <Text style={s.inlinePanelTitle}>Cliente de Adquisición</Text>
            <Text style={s.inlinePanelHint}>Persona o empresa desde quien ingresa esta unidad al stock.</Text>
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
            </View>
          </View>
          {requiresBuyer(wizardData.estado) ? (
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
              </View>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  function renderWizardStep3() {
    return (
      <View style={{ gap: 16 }}>
        <View>
          <Text style={s.stepTitle}>Especificaciones y Detalles</Text>
          <Text style={s.stepSub}>Datos relevantes que buscan los clientes.</Text>
        </View>
        <View style={{ gap: 12 }}>
          <Field
            label="Kilometraje (km)"
            placeholder="Ej: 58000"
            keyboardType="number-pad"
            value={wizardData.km ? String(wizardData.km) : ''}
            onChange={(t) => setWizardData({ ...wizardData, km: parseInt(t) || 0 })}
          />
          <Field label="Color" placeholder="Ej: Gris Plata" value={wizardData.color} onChange={(t) => setWizardData({ ...wizardData, color: t })} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Transmisión</Text>
              <Dropdown
                value={wizardData.transmision}
                onChange={(v) => setWizardData({ ...wizardData, transmision: v })}
                options={TRANSMISION_OPTIONS.map((v) => ({ label: v, value: v }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Combustible</Text>
              <Dropdown
                value={wizardData.combustible}
                onChange={(v) => setWizardData({ ...wizardData, combustible: v })}
                options={COMBUSTIBLE_OPTIONS.map((v) => ({ label: v, value: v }))}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Tracción</Text>
              <Dropdown
                value={wizardData.traccion}
                onChange={(v) => setWizardData({ ...wizardData, traccion: v })}
                options={TRACCION_OPTIONS.map((v) => ({ label: v, value: v }))}
              />
            </View>
            <View style={{ flex: 1 }}>
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

  function renderWizardStep4() {
    const precioBase = wizardData.precioVentaEstimado || wizardData.precioPublicacionContado || wizardData.precioVenta;
    const margen = precioBase - wizardData.costoAdquisicion;
    const pct = Math.round((margen / wizardData.costoAdquisicion) * 100) || 0;
    return (
      <View style={{ gap: 16 }}>
        <View>
          <Text style={s.stepTitle}>Precios y Finanzas</Text>
          <Text style={s.stepSub}>Define los números finales para el cálculo del margen real de rentabilidad.</Text>
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
            <View>
              <Text style={s.margenLabel}>Margen de Venta Estimado</Text>
              <Text style={s.margenValue}>{fmtCLP(margen)}</Text>
            </View>
            <View style={s.margenTag}>
              <Text style={s.margenTagText}>{pct}% Retorno</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  function renderWizardStep5() {
    return (
      <View style={{ gap: 16 }}>
        <View>
          <Text style={s.stepTitle}>Documentos y Revisión</Text>
          <Text style={s.stepSub}>
            {wizardData.id
              ? 'Confirma los cambios para actualizar la publicación existente.'
              : 'Confirma los datos para ingresar el auto en estado "En preparación".'}
          </Text>
        </View>
        <View style={s.inlinePanel}>
          <Text style={s.inlinePanelTitle}>Agregar Documento</Text>
          <View style={{ gap: 10, marginTop: 10 }}>
            <View>
              <Text style={s.fieldLabel}>Tipo de Documento</Text>
              <Dropdown
                value={documentDraft.tipo}
                placeholder="Selecciona el tipo de documento"
                onChange={(v) => setDocumentDraft({ ...documentDraft, tipo: v })}
                options={DOCUMENTO_OPTIONS.map((v) => ({ label: v, value: v }))}
              />
            </View>
            <Field
              label="Nombre del Documento"
              placeholder="Nombre personalizado (opcional)"
              value={documentDraft.nombre}
              onChange={(t) => setDocumentDraft({ ...documentDraft, nombre: t })}
            />
            <DateField
              label="Fecha de Vencimiento"
              value={documentDraft.fechaVencimiento}
              onChange={(fechaVencimiento) => setDocumentDraft({ ...documentDraft, fechaVencimiento })}
              placeholder="Seleccionar fecha"
              optional
            />
            <Field
              label="Archivo"
              placeholder="Nombre del archivo preparado"
              value={documentDraft.archivoNombre}
              onChange={(t) => setDocumentDraft({ ...documentDraft, archivoNombre: t })}
            />
            <TouchableOpacity onPress={handleAgregarDocumento} style={s.addDocBtn}>
              <Icon name="plus" size={12} color={C.white} />
              <Text style={s.addDocText}>Agregar documento</Text>
            </TouchableOpacity>
          </View>
          {wizardData.documentos.length > 0 ? (
            <View style={{ gap: 8, marginTop: 12 }}>
              {wizardData.documentos.map((doc) => (
                <View key={doc.id} style={s.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.docTitle}>{doc.nombre || doc.tipo}</Text>
                    <Text style={s.docMeta}>
                      {doc.tipo}
                      {doc.fechaVencimiento ? ` • vence ${doc.fechaVencimiento}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleQuitarDocumento(doc.id)} style={s.docRemove}>
                    <Icon name="xmark" size={10} color={C.red700} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={s.docsEmpty}>
              <Icon name="file-lines" size={18} color={C.slate300} />
              <Text style={s.docsEmptyText}>No hay documentos preparados</Text>
            </View>
          )}
        </View>
        <View style={s.reviewCard}>
          <View style={[s.rowBetween, { alignItems: 'center' }]}>
            <Text style={s.reviewTitle}>
              {wizardData.marca} {wizardData.modelo}
              {wizardData.anio ? ` (${wizardData.anio})` : ''}
            </Text>
            <View style={s.reviewPatente}>
              <Text style={s.reviewPatenteText}>{wizardData.patente || 'SIN ASIGNAR'}</Text>
            </View>
          </View>
          <View style={s.hr} />
          <View style={s.reviewGrid}>
            <Text style={s.reviewCell}>
              <Text style={s.reviewCellLabel}>Km: </Text>
              {fmtMiles(wizardData.km)} km
            </Text>
            <Text style={s.reviewCell}>
              <Text style={s.reviewCellLabel}>Color: </Text>
              {wizardData.color || '—'}
            </Text>
            <Text style={s.reviewCell}>
              <Text style={s.reviewCellLabel}>Transmisión: </Text>
              {wizardData.transmision}
            </Text>
            <Text style={s.reviewCell}>
              <Text style={s.reviewCellLabel}>Combustible: </Text>
              {wizardData.combustible}
            </Text>
            <Text style={s.reviewCell}>
              <Text style={s.reviewCellLabel}>Tracción: </Text>
              {wizardData.traccion || '—'}
            </Text>
            <Text style={s.reviewCell}>
              <Text style={s.reviewCellLabel}>Puertas: </Text>
              {wizardData.puertas || '—'}
            </Text>
          </View>
          <View style={s.hr} />
          <View style={s.reviewCommercialGrid}>
            <View style={{ flex: 1 }}>
              <Text style={s.reviewMoneyLabel}>Cliente Adquisición</Text>
              <Text style={s.reviewContactText}>{contactDisplayName(wizardData.clienteAdquisicion)}</Text>
            </View>
            {requiresBuyer(wizardData.estado) ? (
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={s.reviewMoneyLabel}>Comprador</Text>
                <Text style={[s.reviewContactText, { textAlign: 'right' }]}>{contactDisplayName(wizardData.comprador)}</Text>
              </View>
            ) : null}
          </View>
          <View style={s.hr} />
          <View style={[s.rowBetween, { alignItems: 'flex-end' }]}>
            <View>
              <Text style={s.reviewMoneyLabel}>Costo Adquisición</Text>
              <Text style={s.reviewCosto}>{fmtCLP(wizardData.costoAdquisicion)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.reviewMoneyLabel}>Precio Venta</Text>
              <Text style={s.reviewPrecio}>{fmtCLP(wizardData.precioPublicacionContado || wizardData.precioVenta)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  /* ======================= FICHA DE AUTO ======================= */
  function renderCarDetail() {
    if (!activeCar) return null;
    const car = activeCar;
    const activeStockAuction = activeStockAuctionMap.get(car.id);
    return (
      <PageOverlay>
            <View style={[s.overlayHeader, { paddingTop: insets.top + 16 }]}>
              <TouchableOpacity onPress={() => setActiveCar(null)} style={s.rowCenter}>
                <Icon name="chevron-left" size={14} color={C.slate400} />
                <Text style={s.cancelText}> Volver</Text>
              </TouchableOpacity>
              <Text style={s.overlayTitle}>Ficha del Auto</Text>
              <View style={s.stepPill}>
                <Text style={s.stepPillText}>{car.patente}</Text>
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <PhotoGallery fotos={car.fotos} />

              <View style={{ padding: 16, gap: 16 }}>
                <View style={[s.rowBetween, { alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.detailTitle}>
                      {car.marca} {car.modelo}
                    </Text>
                    <Text style={s.detailSub}>
                      {car.version} • Año {car.anio}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={s.detailEstado}>
                      <Text style={{ fontSize: 12, fontWeight: W.extrabold, color: C.teal700 }}>{car.estado}</Text>
                    </View>
                    {activeStockAuction && (
                      <View style={s.detailAuctionBadge}>
                        <Icon name="gavel" size={9} color={C.amber700} />
                        <Text style={s.detailAuctionText}>En subasta</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Margen */}
                <View style={s.detailMargenCard}>
                  <View style={s.rowBetween}>
                    <Text style={s.detailMiniLabel}>Costo Adquisición</Text>
                    <Text style={s.detailMiniValue}>{fmtCLP(car.costoAdquisicion)}</Text>
                  </View>
                  <View style={[s.rowBetween, { alignItems: 'flex-end' }]}>
                    <View>
                      <Text style={s.detailMiniLabel}>Publicación Contado</Text>
                      <Text style={s.detailPrecio}>{fmtCLP(car.precioPublicacionContado || car.precioVenta)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.detailMiniLabel, { color: C.emerald600 }]}>Margen Neto</Text>
                      <Text style={s.detailMargen}>+{fmtCLP((car.precioVentaEstimado || car.precioVenta) - car.costoAdquisicion)}</Text>
                    </View>
                  </View>
                  <View style={s.detailFinanceGrid}>
                    <TechItem label="Financiado" value={car.precioPublicacionFinanciado ? fmtCLP(car.precioPublicacionFinanciado) : '—'} />
                    <TechItem label="Venta Estimada" value={fmtCLP(car.precioVentaEstimado || car.precioVenta)} />
                  </View>
                </View>

                <View style={s.detailTechCard}>
                  <Text style={s.detailTechTitle}>Clientes del Vehículo</Text>
                  <View style={{ gap: 10 }}>
                    <VehicleContactCard
                      title="Cliente de adquisición"
                      contact={car.clienteAdquisicion}
                      emptyText="Sin cliente de adquisición registrado."
                      onCall={handleLlamar}
                      onWhatsapp={handleWhatsapp}
                    />
                    {requiresBuyer(car.estado) ? (
                      <VehicleContactCard
                        title={car.estado === 'Reservado' ? 'Comprador / reserva' : 'Comprador final'}
                        contact={car.comprador}
                        emptyText="Registra el comprador para completar este estado."
                        onCall={handleLlamar}
                        onWhatsapp={handleWhatsapp}
                      />
                    ) : null}
                  </View>
                </View>

                {/* Inspección de recepción con IA */}
                {car.inspeccion ? (
                  <TouchableOpacity onPress={() => setInspectingCar(car)} style={s.inspDoneCard} activeOpacity={0.8}>
                    <View style={s.rowBetween}>
                      <View style={s.rowCenter}>
                        <View style={s.inspDoneIcon}>
                          <Icon name="clipboard-check" size={16} color={C.teal700} />
                        </View>
                        <View style={{ marginLeft: 10 }}>
                          <Text style={s.inspTitle}>Inspección de Recepción</Text>
                          <Text style={s.inspSub}>
                            Nota {car.inspeccion.notaCondicion}/10 • Reparaciones est.{' '}
                            {fmtCLP(car.inspeccion.costoTotalEstimadoCLP)}
                          </Text>
                        </View>
                      </View>
                      <Icon name="chevron-right" size={14} color={C.slate400} />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setInspectingCar(car)} style={s.inspCtaCard} activeOpacity={0.8}>
                    <View style={s.rowCenter}>
                      <View style={s.inspCtaIcon}>
                        <Icon name="wand-magic-sparkles" size={16} color={C.white} />
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={s.inspCtaTitle}>Inspección de Recepción con IA</Text>
                        <Text style={s.inspCtaSub}>
                          {car.estado === 'Pre-stock' || car.estado === 'En preparación'
                            ? 'Recomendado: fotografía el auto al recibirlo y la IA detectará daños y generará el informe.'
                            : 'Fotografía el auto y la IA detectará hallazgos y generará el informe PDF.'}
                        </Text>
                      </View>
                      <Icon name="chevron-right" size={14} color={C.teal200} />
                    </View>
                  </TouchableOpacity>
                )}

                {/* AutoSave: historial del vehículo y transferencia notarial */}
                {renderAutosaveBlock(car)}

                {/* Identificación */}
                <View style={s.detailTechCard}>
                  <Text style={s.detailTechTitle}>Identificación</Text>
                  <View style={s.detailTechGrid}>
                    <TechItem label="VIN" value={car.vin || '—'} />
                    <TechItem label="Tipo" value={car.tipoVehiculo || '—'} />
                    <TechItem label="Sucursal" value={car.sucursal || '—'} />
                    <TechItem label="Fecha Ingreso" value={car.fechaIngreso || '—'} />
                    <TechItem label="Año Modelo" value={car.anio ? String(car.anio) : '—'} />
                    <TechItem label="Año Fabricación" value={car.anioFabricacion ? String(car.anioFabricacion) : '—'} />
                    <TechItem label="Origen" value={car.origen || '—'} />
                    <TechItem label="Días en Stock" value={`${car.diasStock} días`} warn={car.diasStock > 60} />
                  </View>
                </View>

                {/* Datos técnicos */}
                <View style={s.detailTechCard}>
                  <Text style={s.detailTechTitle}>Detalle del Vehículo</Text>
                  <View style={s.detailTechGrid}>
                    <TechItem label="Kilometraje" value={`${fmtMiles(car.km)} km`} />
                    <TechItem label="Color" value={car.color} />
                    <TechItem label="Transmisión" value={car.transmision} />
                    <TechItem label="Combustible" value={car.combustible} />
                    <TechItem label="Tracción" value={car.traccion || '—'} />
                    <TechItem label="Cilindrada" value={car.cilindrada ? `${fmtMiles(car.cilindrada)} cc` : '—'} />
                    <TechItem label="Puertas" value={car.puertas || '—'} />
                  </View>
                </View>

                <View style={s.detailTechCard}>
                  <Text style={s.detailTechTitle}>Equipamiento</Text>
                  {car.equipamiento.length > 0 ? (
                    <View style={s.equipmentList}>
                      {car.equipamiento.map((item) => (
                        <View key={item} style={s.equipmentPill}>
                          <Icon name="check" size={9} color={C.teal700} />
                          <Text style={s.equipmentText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={s.emptySectionText}>Sin equipamiento registrado.</Text>
                  )}
                  {car.otros ? (
                    <View style={s.detailNoteInset}>
                      <Text style={s.detailNoteInsetLabel}>Otros</Text>
                      <Text style={s.detailNoteInsetText}>{car.otros}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={s.detailTechCard}>
                  <Text style={s.detailTechTitle}>Documentos</Text>
                  {car.documentos.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {car.documentos.map((doc) => (
                        <View key={doc.id} style={s.docRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.docTitle}>{doc.nombre || doc.tipo}</Text>
                            <Text style={s.docMeta}>
                              {doc.tipo}
                              {doc.fechaVencimiento ? ` • vence ${doc.fechaVencimiento}` : ''}
                              {doc.archivoNombre ? ` • ${doc.archivoNombre}` : ''}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={s.emptySectionText}>No hay documentos preparados.</Text>
                  )}
                </View>

                {/* Notas */}
                <View style={s.notasBox}>
                  <Text style={s.notasLabel}>Notas de Stock:</Text>
                  <Text style={s.notasText}>{car.comentario || 'Sin notas u observaciones especiales.'}</Text>
                </View>
              </View>
            </ScrollView>

            {/* Botonera */}
            <View style={[s.detailFooter, { paddingBottom: (insets.bottom || 8) + 16 }]}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setAdjustedPrice(car.precioVenta);
                    setIsPriceSheetOpen(true);
                  }}
                  style={s.detailActionGray}
                >
                  <Icon name="dollar-sign" size={12} color={C.slate700} />
                  <Text style={s.detailActionGrayText}>Ajustar Precio</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedStatus(car.estado);
                    setStatusNote('');
                    setStatusBuyer(car.comprador || emptyContact());
                    setIsStatusSheetOpen(true);
                  }}
                  style={s.detailActionGray}
                >
                  <Icon name="rotate" size={12} color={C.slate700} />
                  <Text style={s.detailActionGrayText}>Cambiar Estado</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => handleEditarAuto(car)} style={s.detailEditBtn}>
                <Icon name="pen-to-square" size={12} color={C.white} />
                <Text style={s.detailEditText}>Editar Todo el Expediente</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleEliminarAuto(car)} style={s.detailDeleteBtn}>
                <Wiggle>
                  <Icon name="trash-can" size={12} color={C.red700} />
                </Wiggle>
                <Text style={s.detailDeleteText}>Eliminar Publicación</Text>
              </TouchableOpacity>
            </View>
      </PageOverlay>
    );
  }

  /* ======================= AUTOSAVE: BLOQUE EN LA FICHA ======================= */
  // Las dos tarjetas de AutoSave van juntas y comparten la barra cian de marca: es otra
  // empresa del grupo, y se distingue por jerarquía, no metiendo un segundo color.
  function renderAutosaveBlock(car: Car) {
    if (!activeInforme) return null;
    return (
      <View style={s.asBlock}>
        <View style={s.asBrandBar} />
        <View style={{ flex: 1, gap: 12 }}>
          {renderInformeCard(car, activeInforme)}
          {renderTransferCard(car)}
        </View>
      </View>
    );
  }

  function renderInformeCard(car: Car, informe: InformeAutosave) {
    const chips = resumenVeredictos(informe);
    const alerta = alertaPrincipal(informe);
    const envios = car.informesEnviados || [];
    const ultimoEnvio = envios[envios.length - 1];
    const alertaColor = veredictoColor(alerta ? alerta.veredicto : 'ok');

    return (
      <View style={s.detailTechCard}>
        <View style={s.asCardHead}>
          <Text style={s.asBrandLabel}>AutoSave · Informe</Text>
          <Text style={s.asFolio}>{informe.folio}</Text>
        </View>

        <View style={s.asVerdictStrip}>
          {chips.map((chip) => {
            const col = veredictoColor(chip.veredicto);
            return (
              <View key={chip.clave} style={s.asVerdictCell}>
                <View style={[s.asVerdictBar, { backgroundColor: col.color }]} />
                <Text style={s.asVerdictLabel} numberOfLines={1}>
                  {chip.label}
                </Text>
                <Icon name={chip.icono as any} size={13} color={col.color} />
                <Text style={[s.asVerdictValue, { color: col.text }]} numberOfLines={2}>
                  {chip.valor}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[s.asAlertStrip, { backgroundColor: alertaColor.bg, borderLeftColor: alertaColor.color }]}>
          <Text style={[s.asAlertTitle, { color: alertaColor.text }]}>{alerta ? alerta.titulo : 'Sin hallazgos'}</Text>
          <Text style={s.asAlertText}>{alerta ? alerta.detalle : informe.resumen}</Text>
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={() => setIsAutosaveReportOpen(true)} style={s.asLinkRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.asLinkText}>Ver informe completo</Text>
            <Text style={s.asMetaText}>
              Consultado el {fmtFecha(informe.fechaConsulta)} · {totalAntecedentes(informe)}{' '}
              {totalAntecedentes(informe) === 1 ? 'antecedente' : 'antecedentes'}
            </Text>
          </View>
          <Icon name="chevron-right" size={12} color={C.slate400} />
        </TouchableOpacity>

        <View style={s.asClientBlock}>
          <Text style={s.asClientTitle}>Para tu cliente</Text>
          <Text style={s.asClientHint}>
            Copia certificada con folio, válida 30 días. Se la puedes enviar al comprador o al vendedor del auto.
          </Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => handleAbrirEnvioInforme(car)} style={s.asCtaDark}>
            <Text style={s.asCtaDarkText}>Enviar informe al cliente</Text>
            <Text style={s.asCtaPrice}>{fmtCLP(PRECIO_COPIA_INFORME)}</Text>
          </TouchableOpacity>
          {ultimoEnvio ? (
            <Text style={s.asMetaText}>
              Enviado a {ultimoEnvio.nombre} ({ultimoEnvio.destinatario.toLowerCase()}) el {fmtFecha(ultimoEnvio.fecha)}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  function renderTransferCard(car: Car) {
    if (car.transferencia) return renderTransferTracker(car, car.transferencia);
    if (!activeInforme) return null;

    const vendido = car.estado === 'Vendido';
    const bloqueado = activeBloqueos.length > 0;
    const habilitado = vendido && !bloqueado;
    const cotizacion = cotizarTransferencia({
      precioOperacion: car.precioVenta,
      tasacionFiscal: activeInforme.tasacionFiscal,
      modalidad: 'Digital',
      copiaInformeYaPagada: false,
    });

    return (
      <View style={s.detailTechCard}>
        <View style={s.asCardHead}>
          <Text style={s.asBrandLabel}>AutoSave · Transferencia</Text>
        </View>

        {!vendido ? (
          <Text style={[s.asMetaText, { marginTop: 0, marginBottom: 12 }]}>
            Se habilita al marcar el auto como Vendido.
          </Text>
        ) : null}

        <Text style={s.asClientTitle}>Qué le ofreces al cliente</Text>
        <View style={{ gap: 6, marginTop: 8 }}>
          {PITCH_TRANSFERENCIA.map((item) => (
            <View key={item} style={s.asPitchRow}>
              <Icon name="check" size={9} color={C.teal700} />
              <Text style={s.asPitchText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={s.asQuoteRow}>
          <TechItem label="Costo estimado" value={`desde ${fmtCLP(cotizacion.total)}`} />
          <TechItem label="Plazo" value={`${cotizacion.plazoTexto} (digital)`} />
        </View>

        {bloqueado ? (
          <View style={[s.asAlertStrip, { backgroundColor: C.red50, borderLeftColor: C.red600, marginTop: 12 }]}>
            <Text style={[s.asAlertTitle, { color: C.red700 }]}>No se puede inscribir todavía</Text>
            {activeBloqueos.map((b) => (
              <Text key={b} style={s.asAlertText}>
                · {b}
              </Text>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!habilitado}
          onPress={() => handleAbrirTransferencia(car)}
          style={[s.asCtaDark, { marginTop: 12 }, !habilitado && s.asCtaDisabled]}
        >
          <Text style={[s.asCtaDarkText, !habilitado && { color: C.slate400 }]}>
            {bloqueado ? 'Bloqueada por el informe' : vendido ? 'Iniciar transferencia notarial' : 'Disponible al vender'}
          </Text>
          {habilitado ? <Icon name="arrow-right" size={12} color={C.white} /> : null}
        </TouchableOpacity>
      </View>
    );
  }

  function renderTransferTracker(car: Car, t: NonNullable<Car['transferencia']>) {
    const { paso, total } = progresoTransferencia(t);
    const idxActual = t.hitos.findIndex((h) => h.estado === t.estado);
    // Una vez inscrita el trámite terminó: el último hito va como completado, no "en curso".
    const finalizado = t.estado === 'Inscrita';

    return (
      <View style={s.detailTechCard}>
        <View style={s.asCardHead}>
          <Text style={s.asBrandLabel}>AutoSave · Transferencia</Text>
          <Text style={s.asFolio}>{t.folio}</Text>
        </View>

        <View style={{ marginTop: 4 }}>
          {t.hitos.map((hito, i) => {
            const completado = i < idxActual || (finalizado && i === idxActual);
            const actual = i === idxActual && !finalizado;
            const ultimo = i === t.hitos.length - 1;
            return (
              <View key={hito.estado} style={s.asTimelineItem}>
                <View style={s.asTimelineGutter}>
                  <View
                    style={[
                      s.asTimelineNode,
                      completado && s.asTimelineNodeDone,
                      actual && s.asTimelineNodeActive,
                    ]}
                  >
                    {actual ? <Ping color={C.teal400} size={6} /> : null}
                  </View>
                  {!ultimo ? <View style={[s.asTimelineLine, completado && { backgroundColor: C.slate800 }]} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: ultimo ? 0 : 14 }}>
                  <View style={s.rowBetween}>
                    <Text
                      style={[s.asTimelineLabel, (completado || actual) && { color: C.slate800 }]}
                      numberOfLines={1}
                    >
                      {hito.estado}
                    </Text>
                    <Text style={s.asTimelineDate}>
                      {actual ? 'En curso' : hito.fecha ? fmtFecha(hito.fecha) : 'Pendiente'}
                    </Text>
                  </View>
                  {actual ? <Text style={s.asTimelineDetail}>{hito.detalle}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={s.asTransferMeta}>
          <TransferMetaRow
            label="Traspaso"
            value={
              t.origen === 'Directo'
                ? `Directo · ${t.vendedor.nombre} → ${t.comprador.nombre}`
                : `Automotora → ${t.comprador.nombre}`
            }
          />
          <TransferMetaRow label="Notaría" value={t.notaria} />
          <TransferMetaRow label="Modalidad" value={t.modalidad} />
          <TransferMetaRow label="Entrega estimada" value={fmtFecha(t.fechaEstimadaEntrega)} />
          <TransferMetaRow label="Total" value={`${fmtCLP(t.total)} · paga ${t.responsablePago.toLowerCase()}`} strong />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity onPress={() => handleCompartirTransferencia(car)} style={s.detailActionGray}>
            <Icon name="comment-dots" size={12} color={C.slate700} />
            <Text style={s.detailActionGrayText}>Compartir</Text>
          </TouchableOpacity>
          {!finalizado ? (
            <TouchableOpacity
              onPress={() => handleAvanzarTransferencia(car)}
              style={[s.detailActionGray, { backgroundColor: C.chileanNavy }]}
            >
              <Icon name="rotate" size={12} color={C.white} />
              <Text style={[s.detailActionGrayText, { color: C.white }]}>Actualizar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={[s.asMetaText, { marginTop: 8, textAlign: 'center' }]}>
          {finalizado ? `Transferencia inscrita · padrón a nombre de ${t.comprador.nombre}` : `Paso ${paso} de ${total}`}
        </Text>
      </View>
    );
  }

  /* ======================= AUTOSAVE: VENTANA DEL INFORME ======================= */
  function renderAutosaveReport() {
    if (!activeCar || !activeInforme || !isAutosaveReportOpen) return null;
    const car = activeCar;
    const informe = activeInforme;
    const impagas = informe.multas.filter((m) => !m.pagada);
    const totalImpagas = impagas.reduce((sum, m) => sum + m.monto, 0);
    const general = veredictoColor(informe.veredictoGeneral);
    const kmMax = Math.max(informe.kmDeclaradoActual, ...informe.revisiones.map((r) => r.km), 1);

    return (
      <PageOverlay>
        <View style={[s.overlayHeader, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => setIsAutosaveReportOpen(false)} style={s.rowCenter}>
            <Icon name="chevron-left" size={14} color={C.slate400} />
            <Text style={s.cancelText}> Volver</Text>
          </TouchableOpacity>
          <Text style={s.overlayTitle}>Informe AutoSave</Text>
          <View style={s.stepPill}>
            <Text style={s.stepPillText}>{informe.folio}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 16, gap: 16 }}>
            {/* Encabezado del documento */}
            <View style={s.asReportHero}>
              <Text style={s.asReportHeroTitle}>
                {car.marca} {car.modelo} {car.version}
              </Text>
              <Text style={s.asReportHeroSub}>
                {car.patente} · {car.anio} · VIN {informe.vin}
              </Text>
              <Text style={s.asReportHeroSub}>Consultado el {fmtFecha(informe.fechaConsulta)} · vigencia 30 días</Text>
              <View style={[s.asReportBanner, { backgroundColor: general.color }]}>
                <Text style={s.asReportBannerText}>
                  {informe.veredictoGeneral === 'ok'
                    ? 'Sin observaciones'
                    : informe.veredictoGeneral === 'atencion'
                      ? 'Con observaciones'
                      : 'No recomendado sin resolver los hallazgos'}
                </Text>
              </View>
              <Text style={s.asReportResumen}>{informe.resumen}</Text>
            </View>

            {/* Resumen */}
            <View style={s.detailTechCard}>
              <Text style={s.detailTechTitle}>Resumen</Text>
              <ReportRow
                label="Encargo por robo"
                value={informe.encargo.vigente ? 'Encargo vigente' : 'Sin encargos vigentes'}
                veredicto={informe.veredictos.encargo}
              />
              <ReportRow
                label="Siniestros"
                value={informe.siniestros.length ? `${informe.siniestros.length} registrados` : 'Sin registros'}
                veredicto={informe.veredictos.siniestros}
              />
              <ReportRow
                label="Odómetro"
                value={
                  informe.alertaOdometro
                    ? `Retroceso de ${fmtMiles(informe.kmUltimaRevision - informe.kmDeclaradoActual)} km`
                    : 'Coherente con las revisiones'
                }
                veredicto={informe.veredictos.odometro}
              />
              <ReportRow
                label="Multas"
                value={
                  impagas.length
                    ? `${impagas.length} impaga${impagas.length > 1 ? 's' : ''} · ${fmtCLP(totalImpagas)}`
                    : 'Sin multas impagas'
                }
                veredicto={impagas.length ? 'atencion' : 'ok'}
              />
              <ReportRow
                label="Prenda / limitaciones"
                value={informe.prenda?.vigente ? `${informe.prenda.tipo} vigente` : 'Sin prenda vigente'}
                veredicto={informe.prenda?.vigente ? 'critico' : 'ok'}
                last
              />
            </View>

            {/* Encargo */}
            {informe.encargo.vigente ? (
              <View style={[s.detailTechCard, { borderColor: C.red100, backgroundColor: C.red50 }]}>
                <Text style={[s.detailTechTitle, { color: C.red700 }]}>Encargo por robo</Text>
                <Text style={s.asEventTitle}>Vigente desde el {fmtFecha(informe.encargo.fecha)}</Text>
                <Text style={s.asEventMeta}>{informe.encargo.juzgado}</Text>
                <Text style={[s.asAlertText, { marginTop: 6 }]}>{informe.encargo.detalle}</Text>
              </View>
            ) : null}

            {/* Identificación y origen */}
            <View style={s.detailTechCard}>
              <Text style={s.detailTechTitle}>Identificación y origen</Text>
              <View style={s.detailTechGrid}>
                <TechItem label="Importadora" value={informe.importadora} />
                <TechItem label="Primera inscripción" value={fmtFecha(informe.fechaPrimeraInscripcion)} />
                <TechItem label="Tasación fiscal (SII)" value={fmtCLP(informe.tasacionFiscal)} />
                <TechItem label="Titulares registrados" value={String(informe.titulares.length)} />
              </View>
            </View>

            {/* Siniestros */}
            <View style={s.detailTechCard}>
              <Text style={s.detailTechTitle}>Siniestros ({informe.siniestros.length})</Text>
              {informe.siniestros.length ? (
                <View style={{ gap: 10 }}>
                  {informe.siniestros.map((sn, i) => {
                    const grave = sn.gravedad === 'Grave' || sn.gravedad === 'Pérdida total';
                    const col = grave ? C.red600 : sn.gravedad === 'Moderado' ? C.amber600 : C.slate300;
                    return (
                      <View key={`${sn.fecha}-${i}`} style={[s.asEventCard, { borderLeftColor: col }]}>
                        <View style={s.rowBetween}>
                          <Text style={s.asEventTitle}>{sn.tipo}</Text>
                          <Text style={[s.asEventTag, { color: col }]}>{sn.gravedad.toUpperCase()}</Text>
                        </View>
                        <Text style={s.asEventMeta}>
                          {fmtFecha(sn.fecha)} · {sn.compania} · {fmtCLP(sn.montoReparacion)}
                        </Text>
                        <Text style={s.asEventMeta}>{sn.piezasAfectadas.join(', ')}</Text>
                        {sn.taller ? <Text style={s.asEventMeta}>Reparado en {sn.taller}</Text> : null}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={s.emptySectionText}>Sin siniestros registrados en compañías de seguro.</Text>
              )}
            </View>

            {/* Historial de odómetro */}
            <View style={s.detailTechCard}>
              <Text style={s.detailTechTitle}>Historial de odómetro</Text>
              {informe.revisiones.length ? (
                <View style={{ gap: 12 }}>
                  {informe.revisiones.map((rt, i) => (
                    <View key={`${rt.fecha}-${i}`}>
                      <View style={s.rowBetween}>
                        <Text style={s.asKmFecha}>{fmtFecha(rt.fecha)}</Text>
                        <Text style={[s.asKmValue, rt.inconsistente && { color: C.red600 }]}>
                          {fmtMiles(rt.km)} km
                        </Text>
                      </View>
                      <View style={s.asKmTrack}>
                        <View
                          style={[
                            s.asKmFill,
                            {
                              width: `${Math.max(6, Math.round((rt.km / kmMax) * 100))}%`,
                              backgroundColor: rt.inconsistente ? C.red600 : C.slate700,
                            },
                          ]}
                        />
                      </View>
                      <Text style={s.asEventMeta}>
                        {rt.planta} · {rt.resultado}
                      </Text>
                      {rt.observacion ? <Text style={s.asEventMeta}>Obs: {rt.observacion}</Text> : null}
                      {rt.inconsistente ? (
                        <View style={[s.asAlertStrip, { backgroundColor: C.red50, borderLeftColor: C.red600, marginTop: 8 }]}>
                          <Text style={s.asAlertText}>
                            Hoy el vehículo declara {fmtMiles(informe.kmDeclaradoActual)} km: retroceso de{' '}
                            {fmtMiles(rt.km - informe.kmDeclaradoActual)} km respecto de esta revisión.
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                  <View style={s.asKmActual}>
                    <Text style={s.asKmFecha}>Odómetro declarado hoy</Text>
                    <Text style={s.asKmValue}>{fmtMiles(informe.kmDeclaradoActual)} km</Text>
                  </View>
                </View>
              ) : (
                <Text style={s.emptySectionText}>El vehículo aún no registra revisiones técnicas.</Text>
              )}
            </View>

            {/* Titulares */}
            <View style={s.detailTechCard}>
              <Text style={s.detailTechTitle}>Titulares y patentes ({informe.titulares.length})</Text>
              <View style={{ gap: 10 }}>
                {informe.titulares.map((tit, i) => (
                  <View key={`${tit.desde}-${i}`} style={s.asEventCard}>
                    <View style={s.rowBetween}>
                      <Text style={s.asEventTitle}>{tit.titular}</Text>
                      <Text style={s.asEventTag}>{tit.patente}</Text>
                    </View>
                    <Text style={s.asEventMeta}>
                      {tit.desde.slice(0, 4)} – {tit.hasta ? tit.hasta.slice(0, 4) : 'hoy'} · {tit.tipo} · {tit.region}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Multas */}
            <View style={s.detailTechCard}>
              <Text style={s.detailTechTitle}>Multas ({informe.multas.length})</Text>
              {informe.multas.length ? (
                <View style={{ gap: 10 }}>
                  {informe.multas.map((m, i) => (
                    <View key={`${m.fecha}-${i}`} style={[s.asEventCard, { borderLeftColor: m.pagada ? C.slate300 : C.red600 }]}>
                      <View style={s.rowBetween}>
                        <Text style={s.asEventTitle}>{m.motivo}</Text>
                        <Text style={[s.asEventTag, !m.pagada && { color: C.red600 }]}>
                          {m.pagada ? 'PAGADA' : 'IMPAGA'}
                        </Text>
                      </View>
                      <Text style={s.asEventMeta}>
                        {fmtFecha(m.fecha)} · {m.juzgado} · {fmtCLP(m.monto)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={s.emptySectionText}>Sin multas registradas.</Text>
              )}
            </View>

            {/* Prenda */}
            <View style={s.detailTechCard}>
              <Text style={s.detailTechTitle}>Prenda y limitaciones al dominio</Text>
              {informe.prenda?.vigente ? (
                <View style={[s.asEventCard, { borderLeftColor: C.red600 }]}>
                  <Text style={s.asEventTitle}>{informe.prenda.tipo}</Text>
                  <Text style={s.asEventMeta}>
                    {informe.prenda.acreedor} · constituida el {fmtFecha(informe.prenda.fechaConstitucion)}
                  </Text>
                  <Text style={s.asEventMeta}>Saldo insoluto {fmtCLP(informe.prenda.saldoInsoluto)}</Text>
                </View>
              ) : (
                <Text style={s.emptySectionText}>Sin prenda ni limitaciones vigentes.</Text>
              )}
            </View>

            <Text style={s.asDisclaimer}>
              Informe generado localmente para demostración. Los datos no provienen de registros reales.
            </Text>
          </View>
        </ScrollView>

        <View style={[s.detailFooter, { paddingBottom: (insets.bottom || 8) + 16 }]}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                setIsAutosaveReportOpen(false);
                handleAbrirEnvioInforme(car);
              }}
              style={s.detailActionGray}
            >
              <Icon name="paper-plane" size={12} color={C.slate700} />
              <Text style={s.detailActionGrayText}>Enviar al cliente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={car.estado !== 'Vendido' || activeBloqueos.length > 0 || !!car.transferencia}
              onPress={() => {
                setIsAutosaveReportOpen(false);
                handleAbrirTransferencia(car);
              }}
              style={[
                s.detailActionGray,
                { backgroundColor: C.chileanNavy },
                (car.estado !== 'Vendido' || activeBloqueos.length > 0 || !!car.transferencia) && s.asCtaDisabled,
              ]}
            >
              <Icon
                name="file-signature"
                size={12}
                color={car.estado !== 'Vendido' || activeBloqueos.length > 0 || !!car.transferencia ? C.slate400 : C.white}
              />
              <Text
                style={[
                  s.detailActionGrayText,
                  { color: car.estado !== 'Vendido' || activeBloqueos.length > 0 || !!car.transferencia ? C.slate400 : C.white },
                ]}
              >
                Transferencia
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </PageOverlay>
    );
  }

  /* ======================= SHEET: ENVIAR INFORME AL CLIENTE ======================= */
  function renderEnvioInformeSheet() {
    if (!activeCar || !activeInforme) return null;
    const car = activeCar;
    const opciones: { key: EnvioInforme['destinatario']; label: string; disponible: boolean }[] = [
      { key: 'Comprador', label: 'Comprador', disponible: hasContactData(car.comprador) },
      { key: 'Vendedor', label: 'Vendedor', disponible: hasContactData(car.clienteAdquisicion) },
      { key: 'Otro', label: 'Otro contacto', disponible: true },
    ];

    return (
      <Sheet visible={isEnvioInformeSheetOpen && !!activeCar} onClose={() => setIsEnvioInformeSheetOpen(false)} maxHeightPct={88}>
        <View style={s.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.sheetTitle}>Enviar informe al cliente</Text>
            <Text style={s.subMuted}>
              {car.marca} {car.modelo} · Folio {activeInforme.folio}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setIsEnvioInformeSheetOpen(false)}>
            <Icon name="circle-xmark" size={18} color={C.slate400} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View>
            <Text style={s.sheetFieldLabel}>¿Quién lo recibe?</Text>
            <View style={s.asChipRow}>
              {opciones.map((op) => (
                <TouchableOpacity
                  key={op.key}
                  disabled={!op.disponible}
                  onPress={() => handleCambiarDestinatario(op.key)}
                  style={[s.asChip, envioDestinatario === op.key && s.asChipActive, !op.disponible && { opacity: 0.4 }]}
                >
                  <Text style={[s.asChipText, envioDestinatario === op.key && { color: C.white }]}>{op.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.inlinePanel}>
            <Text style={s.inlinePanelTitle}>Datos de contacto</Text>
            <Text style={s.inlinePanelHint}>La copia se envía por WhatsApp al número que registres.</Text>
            <View style={{ gap: 10, marginTop: 12 }}>
              <Field
                label="Nombre"
                placeholder="Ej: Carolina Soto"
                value={envioContacto.nombre}
                onChange={(nombre) => setEnvioContacto({ ...envioContacto, nombre })}
              />
              <Field
                label="Teléfono"
                placeholder="Ej: +56 9 1234 5678"
                keyboardType="phone-pad"
                value={envioContacto.telefono}
                onChange={(telefono) => setEnvioContacto({ ...envioContacto, telefono })}
              />
            </View>
          </View>

          <View style={s.inlinePanel}>
            <Text style={s.inlinePanelTitle}>Qué incluye la copia certificada</Text>
            <View style={{ gap: 6, marginTop: 8 }}>
              {[
                'Informe completo con folio verificable',
                'Siniestros, encargo por robo y odómetro',
                'Multas, prenda y titulares anteriores',
                'Vigencia 30 días desde la emisión',
              ].map((item) => (
                <View key={item} style={s.asPitchRow}>
                  <Icon name="check" size={9} color={C.teal700} />
                  <Text style={s.asPitchText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={[s.sheetFooter, { paddingBottom: (insets.bottom || 0) + 16 }]}>
          <TouchableOpacity onPress={() => setIsEnvioInformeSheetOpen(false)} style={s.sheetBtnGray}>
            <Text style={s.sheetBtnGrayText}>Ahora no</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEnviarInforme} style={[s.sheetBtnTeal, { backgroundColor: C.chileanNavy }]}>
            <Text style={s.sheetBtnTealText}>Enviar · {fmtCLP(PRECIO_COPIA_INFORME)}</Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    );
  }

  /* ======================= SHEET: TRANSFERENCIA NOTARIAL ======================= */
  function renderTransferSheet() {
    if (!activeCar || !activeInforme) return null;
    const car = activeCar;
    const bloqueado = activeBloqueos.length > 0;
    const copiaPagada = (car.informesEnviados || []).length > 0;
    const cotizacion = cotizarTransferencia({
      precioOperacion: car.precioVenta,
      tasacionFiscal: activeInforme.tasacionFiscal,
      modalidad: transferModalidad,
      copiaInformeYaPagada: copiaPagada,
    });
    const puedeDirecto = hasContactData(car.clienteAdquisicion);
    const vendedor =
      transferOrigen === 'Directo' && puedeDirecto
        ? (car.clienteAdquisicion as VehicleContact)
        : { clienteId: null, nombre: AUTOMOTORA.nombre, telefono: AUTOMOTORA.telefono };

    return (
      <Sheet visible={isTransferSheetOpen && !!activeCar} onClose={() => setIsTransferSheetOpen(false)} maxHeightPct={90}>
        <View style={s.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.sheetTitle}>Transferencia notarial</Text>
            <Text style={s.subMuted}>
              {car.marca} {car.modelo} · {car.patente}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setIsTransferSheetOpen(false)}>
            <Icon name="circle-xmark" size={18} color={C.slate400} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          {bloqueado ? (
            <View style={[s.asAlertStrip, { backgroundColor: C.red50, borderLeftColor: C.red600 }]}>
              <Text style={[s.asAlertTitle, { color: C.red700 }]}>El informe AutoSave bloquea la inscripción</Text>
              {activeBloqueos.map((b) => (
                <Text key={b} style={s.asAlertText}>
                  · {b}
                </Text>
              ))}
            </View>
          ) : null}

          <View>
            <Text style={s.sheetFieldLabel}>Tipo de traspaso</Text>
            <View style={s.segment}>
              <SegBtn
                label="Desde la automotora"
                active={transferOrigen === 'Automotora'}
                onPress={() => setTransferOrigen('Automotora')}
              />
              <SegBtn
                label="Directo al comprador"
                active={transferOrigen === 'Directo'}
                onPress={() => (puedeDirecto ? setTransferOrigen('Directo') : showNotification('Este auto no tiene cliente de adquisición registrado.', 'warning'))}
              />
            </View>
            <Text style={s.inlinePanelHint}>
              {transferOrigen === 'Directo'
                ? 'El dueño anterior transfiere directamente al comprador. La automotora solo gestiona.'
                : 'El vehículo se transfiere desde la automotora al comprador final.'}
            </Text>
          </View>

          <View style={s.inlinePanel}>
            <Text style={s.inlinePanelTitle}>Partes</Text>
            <View style={{ gap: 10, marginTop: 10 }}>
              <PartyRow rol="Vendedor" contacto={vendedor} />
              <PartyRow rol="Comprador" contacto={car.comprador} />
            </View>
            {!hasContactData(car.comprador) ? (
              <Text style={[s.inlinePanelHint, { color: C.red600 }]}>
                Registra al comprador en "Cambiar Estado" antes de generar la transferencia.
              </Text>
            ) : null}
          </View>

          <View>
            <Text style={s.sheetFieldLabel}>Modalidad</Text>
            <View style={s.segment}>
              <SegBtn label="Digital" active={transferModalidad === 'Digital'} onPress={() => handleCambiarModalidad('Digital')} />
              <SegBtn
                label="Presencial"
                active={transferModalidad === 'Presencial'}
                onPress={() => handleCambiarModalidad('Presencial')}
              />
            </View>
          </View>

          <View>
            <Text style={s.sheetFieldLabel}>Notaría</Text>
            <Dropdown
              small
              value={transferNotaria}
              onChange={setTransferNotaria}
              options={NOTARIAS.map((n) => ({ label: n, value: n }))}
            />
          </View>

          <View>
            <Text style={s.sheetFieldLabel}>¿Quién paga el trámite?</Text>
            <View style={s.asChipRow}>
              {(['Comprador', 'Vendedor', 'Compartido'] as ResponsablePago[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setTransferPagador(r)}
                  style={[s.asChip, transferPagador === r && s.asChipActive]}
                >
                  <Text style={[s.asChipText, transferPagador === r && { color: C.white }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.inlinePanel}>
            <Text style={s.inlinePanelTitle}>Costos del trámite</Text>
            <Text style={s.inlinePanelHint}>
              Base imponible {fmtCLP(cotizacion.baseImponible)} — el mayor entre el precio de la operación (
              {fmtCLP(car.precioVenta)}) y la tasación fiscal del SII ({fmtCLP(activeInforme.tasacionFiscal)}).
            </Text>
            <View style={{ marginTop: 12 }}>
              {cotizacion.costos.map((c) => (
                <View key={c.concepto} style={s.asCostRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={s.asCostLabel}>{c.concepto}</Text>
                    {c.nota ? <Text style={s.asCostNota}>{c.nota}</Text> : null}
                  </View>
                  <Text style={[s.asCostValue, c.monto < 0 && { color: C.emerald600 }]}>
                    {c.monto === 0 ? 'Incluida' : fmtCLP(c.monto)}
                  </Text>
                </View>
              ))}
              <View style={[s.asCostRow, s.asCostTotalRow]}>
                <Text style={s.asCostTotalLabel}>Total</Text>
                <Text style={s.asCostTotalValue}>{fmtCLP(cotizacion.total)}</Text>
              </View>
            </View>
            <Text style={[s.inlinePanelHint, { marginTop: 8 }]}>
              Entrega estimada: {fmtFecha(cotizacion.fechaEstimadaEntrega)} ({cotizacion.plazoTexto}).
            </Text>
          </View>
        </ScrollView>

        <View style={[s.sheetFooter, { paddingBottom: (insets.bottom || 0) + 16 }]}>
          <TouchableOpacity onPress={() => setIsTransferSheetOpen(false)} style={s.sheetBtnGray}>
            <Text style={s.sheetBtnGrayText}>Ahora no</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={bloqueado || transferProcesando}
            onPress={handleGenerarTransferencia}
            style={[s.sheetBtnTeal, { backgroundColor: C.chileanNavy }, (bloqueado || transferProcesando) && s.asCtaDisabled]}
          >
            {transferProcesando ? (
              <View style={s.rowCenter}>
                <Spinner size={11} color={C.white} />
                <Text style={[s.sheetBtnTealText, { marginLeft: 6 }]}>Enviando a AutoSave…</Text>
              </View>
            ) : (
              <Text style={[s.sheetBtnTealText, bloqueado && { color: C.slate400 }]}>Generar transferencia</Text>
            )}
          </TouchableOpacity>
        </View>
      </Sheet>
    );
  }

  /* ======================= SHEET: FILTROS ======================= */
  function renderFilterSheet() {
    return (
      <Sheet visible={isFilterSheetOpen} onClose={() => setIsFilterSheetOpen(false)} maxHeightPct={85}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Filtrar Vehículos</Text>
          <TouchableOpacity onPress={() => setIsFilterSheetOpen(false)}>
            <Icon name="circle-xmark" size={18} color={C.slate400} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View>
            <Text style={s.sheetFieldLabel}>Marca</Text>
            <Dropdown
              small
              value={filters.marca}
              placeholder="Todas las marcas"
              onChange={(v) => setFilters({ ...filters, marca: v })}
              options={[{ label: 'Todas las marcas', value: '' }, ...marcasDisponibles.map((m) => ({ label: m, value: m }))]}
            />
          </View>
          <View>
            <Text style={s.sheetFieldLabel}>Año</Text>
            <TextInput
              placeholder="Ej: 2021"
              placeholderTextColor={C.slate400}
              keyboardType="number-pad"
              value={filters.anio}
              onChangeText={(t) => setFilters({ ...filters, anio: t })}
              style={s.sheetInput}
            />
          </View>
          <View>
            <View style={s.rowBetween}>
              <Text style={s.sheetFieldLabel}>Precio Máximo</Text>
              <Text style={s.sheetRangeValue}>{fmtCLP(filters.precioMax)}</Text>
            </View>
            <Slider
              minimumValue={4000000}
              maximumValue={20000000}
              step={500000}
              value={filters.precioMax}
              onValueChange={(v) => setFilters({ ...filters, precioMax: v })}
              minimumTrackTintColor={C.chileanTeal}
              maximumTrackTintColor={C.slate200}
              thumbTintColor={C.chileanTeal}
            />
          </View>
        </ScrollView>
        <View style={[s.sheetFooter, { paddingBottom: (insets.bottom || 0) + 16 }]}>
          <TouchableOpacity
            onPress={() => {
              setFilters({ marca: '', anio: '', precioMax: 20000000, estado: '' });
              setIsFilterSheetOpen(false);
            }}
            style={s.sheetBtnGray}
          >
            <Text style={s.sheetBtnGrayText}>Limpiar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsFilterSheetOpen(false)} style={s.sheetBtnTeal}>
            <Text style={s.sheetBtnTealText}>Aplicar Filtros</Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    );
  }

  /* ======================= SHEET: AJUSTAR PRECIO ======================= */
  function renderPriceSheet() {
    if (!activeCar) return null;
    return (
      <Sheet visible={isPriceSheetOpen && !!activeCar} onClose={() => setIsPriceSheetOpen(false)}>
        <View style={{ padding: 16, gap: 16, paddingBottom: (insets.bottom || 0) + 16 }}>
          <View style={s.rowBetween}>
            <View>
              <Text style={s.sheetTitleSm}>Ajustar Precio de Venta</Text>
              <Text style={s.subMuted}>
                {activeCar.marca} {activeCar.modelo}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsPriceSheetOpen(false)}>
              <Icon name="circle-xmark" size={18} color={C.slate400} />
            </TouchableOpacity>
          </View>

          <View style={s.bigValueBox}>
            <Text style={s.bigValueLabel}>Nuevo Precio</Text>
            <Text style={s.bigValue}>{fmtCLP(adjustedPrice)}</Text>
          </View>

          <View style={s.stepperRow}>
            <TouchableOpacity
              onPress={() => setAdjustedPrice(Math.max(adjustedPrice - 100000, activeCar.costoAdquisicion))}
              style={s.stepperBtn}
            >
              <Icon name="minus" size={18} color={C.slate800} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[s.bigValueLabel, { color: C.emerald600 }]}>Nuevo Margen Estimado</Text>
              <Text style={s.stepperMargen}>+{fmtCLP(adjustedPrice - activeCar.costoAdquisicion)}</Text>
            </View>
            <TouchableOpacity onPress={() => setAdjustedPrice(adjustedPrice + 100000)} style={s.stepperBtn}>
              <Icon name="plus" size={18} color={C.slate800} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleGuardarPrecio} style={s.sheetPrimaryBtn}>
            <Text style={s.sheetPrimaryText}>Guardar Precio de Venta</Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    );
  }

  /* ======================= SHEET: CAMBIAR ESTADO ======================= */
  function renderStatusSheet() {
    if (!activeCar) return null;
    return (
      <Sheet visible={isStatusSheetOpen && !!activeCar} onClose={() => setIsStatusSheetOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ padding: 16, gap: 16, paddingBottom: (insets.bottom || 0) + 16 }}>
            <View style={s.rowBetween}>
              <View>
                <Text style={s.sheetTitleSm}>Cambiar Estado de Operación</Text>
                <Text style={s.subMuted}>
                  {activeCar.marca} {activeCar.modelo}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsStatusSheetOpen(false)}>
                <Icon name="circle-xmark" size={18} color={C.slate400} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <Text style={s.sheetFieldLabel}>Seleccionar Estado</Text>
              <View style={s.statusGrid}>
                {ESTADOS.map((est) => {
                  const isSelected = selectedStatus === est;
                  return (
                    <TouchableOpacity
                      key={est}
                      onPress={() => setSelectedStatus(est)}
                      style={[s.statusBtn, isSelected ? s.statusBtnActive : s.statusBtnInactive]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: W.bold, color: isSelected ? C.white : C.slate700 }}>{est}</Text>
                      {isSelected && <Icon name="circle-check" size={13} color={C.teal400} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {requiresBuyer(selectedStatus as EstadoAuto) ? (
                <View style={s.inlinePanel}>
                  <Text style={s.inlinePanelTitle}>Comprador</Text>
                  <Text style={s.inlinePanelHint}>Este contacto se registrará automáticamente como cliente de venta.</Text>
                  <View style={{ gap: 10, marginTop: 12 }}>
                    <Field
                      label="Nombre"
                      placeholder="Ej: María González"
                      value={statusBuyer.nombre}
                      onChange={(nombre) => setStatusBuyer({ ...statusBuyer, nombre })}
                    />
                    <Field
                      label="Teléfono"
                      placeholder="Ej: +56 9 1234 5678"
                      keyboardType="phone-pad"
                      value={statusBuyer.telefono}
                      onChange={(telefono) => setStatusBuyer({ ...statusBuyer, telefono })}
                    />
                  </View>
                </View>
              ) : null}

              <View>
                <Text style={s.sheetFieldLabel}>Nota Opcional</Text>
                <TextInput
                  placeholder="Ej: Se inicia proceso de detallado estético..."
                  placeholderTextColor={C.slate400}
                  value={statusNote}
                  onChangeText={setStatusNote}
                  multiline
                  numberOfLines={2}
                  style={s.textArea}
                />
              </View>
            </View>

            <TouchableOpacity onPress={handleGuardarEstado} style={s.sheetPrimaryBtn}>
              <Text style={s.sheetPrimaryText}>Cambiar Estado</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Sheet>
    );
  }

  /* ======================= SHEET: OFERTAR SUBASTA ======================= */
  function renderAuctionBidSheet() {
    if (!activeAuction) return null;
    const auc = activeAuction;
    const msLeft = getAuctionMsLeft(auc, nowTs);
    return (
      <Sheet visible={isAuctionBidSheetOpen && !!activeAuction} onClose={() => setIsAuctionBidSheetOpen(false)}>
        <View style={{ padding: 16, gap: 16, paddingBottom: (insets.bottom || 0) + 16 }}>
          <View style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitleSm}>Ingresar oferta sellada</Text>
              <Text style={s.subMuted}>
                {auc.marca} {auc.modelo} ({auc.origen})
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsAuctionBidSheetOpen(false)}>
              <Icon name="circle-xmark" size={18} color={C.slate400} />
            </TouchableOpacity>
          </View>

          <View style={s.bigValueBox}>
            <Text style={s.bigValueLabel}>Monto de tu Oferta</Text>
            <Text style={s.bigValue}>{fmtCLP(bidAmount)}</Text>
          </View>

          <View style={s.sealedInfoBox}>
            <Icon name="lock" size={14} color={C.chileanTeal} />
            <Text style={s.sealedInfoText}>
              Tu oferta queda oculta hasta el cierre. No verás ofertas de otros compradores durante la subasta.
            </Text>
          </View>

          <View style={s.stepperRow}>
            <TouchableOpacity
              onPress={() => setBidAmount(Math.max(bidAmount - 100000, 0))}
              style={s.stepperBtn}
            >
              <Icon name="minus" size={18} color={C.slate800} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.bidMinText}>Tiempo restante: {formatAuctionRemaining(msLeft)}</Text>
            </View>
            <TouchableOpacity onPress={() => setBidAmount(bidAmount + 100000)} style={s.stepperBtn}>
              <Icon name="plus" size={18} color={C.slate800} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleEnviarOfertaSubasta} style={s.sheetPrimaryBtn}>
            <Text style={s.sheetPrimaryText}>Enviar Oferta Sellada</Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    );
  }

  /* ======================= SHEET: PUBLICAR SUBASTA ======================= */
  function renderAuctionPublishSheet() {
    return (
      <Sheet visible={isAuctionPublishSheetOpen} onClose={() => setIsAuctionPublishSheetOpen(false)} maxHeightPct={86}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ padding: 16, gap: 16, paddingBottom: (insets.bottom || 0) + 16 }}>
            <View style={s.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitleSm}>Subastar vehículo del stock</Text>
                <Text style={s.subMuted}>La ventana queda activa por 4 horas desde la publicación.</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAuctionPublishSheetOpen(false)}>
                <Icon name="circle-xmark" size={18} color={C.slate400} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handlePublicarSubastaStock} style={s.publishStickyBtn}>
              <Icon name="gavel" size={12} color={C.white} />
              <Text style={s.sheetPrimaryText}>Publicar Subasta por 4 Horas</Text>
            </TouchableOpacity>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={s.sheetFieldLabel}>Vehículo</Text>
                <Dropdown
                  value={publishStockId}
                  options={stockAuctionOptions}
                  onChange={setPublishStockId}
                  placeholder={stockAuctionOptions.length ? 'Selecciona un auto del stock' : 'No hay stock disponible'}
                />
              </View>

              <View>
                <View style={s.noteHeaderRow}>
                  <Text style={s.sheetFieldLabel}>Nota abierta del vendedor</Text>
                  <TouchableOpacity activeOpacity={0.8} onPress={Keyboard.dismiss} style={s.dismissKeyboardBtn}>
                    <Icon name="check" size={10} color={C.chileanTeal} />
                    <Text style={s.dismissKeyboardText}>Listo</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  placeholder="Ej: Mantenciones al día, documentos disponibles, detalle menor en parachoques..."
                  placeholderTextColor={C.slate400}
                  value={sellerNote}
                  onChangeText={setSellerNote}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={s.auctionNoteInput}
                />
              </View>

              <View style={s.sealedInfoBox}>
                <Icon name="hourglass-half" size={14} color={C.chileanTeal} />
                <Text style={s.sealedInfoText}>
                  Los compradores ofertan sin ver otros montos. Al finalizar, se adjudica la mejor oferta recibida.
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Sheet>
    );
  }

  /* ======================= SHEET: CARACTERÍSTICAS SUBASTA ======================= */
  function renderAuctionFeaturesSheet() {
    if (!activeAuction || !isAuctionFeaturesSheetOpen) return null;
    const auc = activeAuction;
    const imageUrl = getAuctionImageUrl(auc);
    const features = getAuctionFeatures(auc);
    const msLeft = getAuctionMsLeft(auc, nowTs);
    const active = !isAuctionFinal(auc) && msLeft > 0;
    return (
      <PageOverlay>
        <View style={[s.overlayHeader, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => setIsAuctionFeaturesSheetOpen(false)} style={s.rowCenter}>
            <Icon name="chevron-left" size={14} color={C.slate400} />
            <Text style={s.cancelText}> Volver</Text>
          </TouchableOpacity>
          <Text style={s.overlayTitle}>Ficha de Subasta</Text>
          <View style={s.stepPill}>
            <Text style={s.stepPillText}>#{auc.id}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <PhotoGallery fotos={[imageUrl]} />

          <View style={{ padding: 16, gap: 16 }}>
            <View style={[s.rowBetween, { alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <View style={s.aucBadgeRow}>
                  <View style={s.origenPill}>
                    <Text style={s.origenText}>{auc.origen}</Text>
                  </View>
                  <View style={[s.auctionStatusPill, { backgroundColor: active ? C.emerald50 : C.slate100 }]}>
                    <Text style={[s.auctionStatusText, { color: active ? C.emerald700 : C.slate600 }]}>
                      {active ? 'Abierta' : 'Finalizada'}
                    </Text>
                  </View>
                </View>
                <Text style={s.detailTitle}>
                  {auc.marca} {auc.modelo}
                </Text>
                <Text style={s.detailSub}>
                  {auc.version} • Año {auc.anio}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={[s.timePill, !active && s.timePillDone]}>
                  <Icon name="clock" size={9} color={active ? C.amber700 : C.slate500} />
                  <Text style={[s.timePillText, !active && { color: C.slate500 }]}>
                    {active ? formatAuctionRemaining(msLeft) : 'Finalizada'}
                  </Text>
                </View>
                <View style={s.detailEstado}>
                  <Text style={{ fontSize: 12, fontWeight: W.extrabold, color: C.teal700 }}>Sobre cerrado</Text>
                </View>
              </View>
            </View>

            <View style={s.detailMargenCard}>
              <View style={s.rowBetween}>
                <Text style={s.detailMiniLabel}>Referencia de compra</Text>
                <Text style={s.detailMiniValue}>{fmtCLP(auc.costoFinal)}</Text>
              </View>
              <View style={[s.rowBetween, { alignItems: 'flex-end' }]}>
                <View>
                  <Text style={s.detailMiniLabel}>Venta sugerida</Text>
                  <Text style={s.detailPrecio}>{fmtCLP(auc.sugeridoVenta)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.detailMiniLabel, { color: C.emerald600 }]}>Margen estimado</Text>
                  <Text style={s.detailMargen}>+{fmtCLP(auc.sugeridoVenta - auc.costoFinal)}</Text>
                </View>
              </View>
              <View style={s.detailFinanceGrid}>
                <TechItem label="Modalidad" value="Sobre cerrado" />
                <TechItem label="Oferta visible" value="No disponible" />
              </View>
            </View>

            <View style={s.detailTechCard}>
              <Text style={s.detailTechTitle}>Identificación</Text>
              <View style={s.detailTechGrid}>
                <TechItem label="Patente" value={auc.patente || 'Por asignar'} />
                <TechItem label="Origen" value={auc.origen || '—'} />
                <TechItem label="Año Modelo" value={auc.anio ? String(auc.anio) : '—'} />
                <TechItem label="ID Subasta" value={`#${auc.id}`} />
              </View>
            </View>

            <View style={s.detailTechCard}>
              <Text style={s.detailTechTitle}>Detalle del Vehículo</Text>
              <View style={s.detailTechGrid}>
                <TechItem label="Kilometraje" value={`${fmtMiles(auc.km)} km`} />
                <TechItem label="Color" value={auc.color || '—'} />
                <TechItem label="Transmisión" value={auc.transmision || '—'} />
                <TechItem label="Combustible" value={auc.combustible || '—'} />
              </View>
            </View>

            <View style={s.detailTechCard}>
              <Text style={s.detailTechTitle}>Características declaradas</Text>
              <View style={s.equipmentList}>
                {features.map((feature) => (
                  <View key={`${feature.label}-${feature.value}`} style={s.featureDetailPill}>
                    <Icon name="check" size={9} color={C.teal700} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.featureDetailLabel}>{feature.label}</Text>
                      <Text style={s.featureDetailText}>{feature.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={s.detailTechCard}>
              <Text style={s.detailTechTitle}>Documentos</Text>
              <View style={{ gap: 8 }}>
                <View style={s.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.docTitle}>Carpeta digital de subasta</Text>
                    <Text style={s.docMeta}>Revisión documental • disponible al adjudicar</Text>
                  </View>
                </View>
                <View style={s.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.docTitle}>Inspección visual</Text>
                    <Text style={s.docMeta}>Declaración estándar • sin garantía mecánica</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={s.notasBox}>
              <Text style={s.notasLabel}>Nota del vendedor:</Text>
              <Text style={s.notasText}>{auc.sellerNote}</Text>
            </View>
          </View>
        </ScrollView>

        {auc.estado === 'Disponible' && active && (
          <View style={[s.detailFooter, { paddingBottom: (insets.bottom || 8) + 16 }]}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                setIsAuctionFeaturesSheetOpen(false);
                setActiveAuction(auc);
                setBidAmount(suggestSealedBid(auc));
                setIsAuctionBidSheetOpen(true);
              }}
              style={s.detailEditBtn}
            >
              <Icon name="gavel" size={12} color={C.white} />
              <Text style={s.detailEditText}>Ofertar en esta Subasta</Text>
            </TouchableOpacity>
          </View>
        )}
      </PageOverlay>
    );
  }

  /* ======================= SHEET: NUEVO/EDITAR CLIENTE ======================= */
  function renderNewClientSheet() {
    return (
      <Sheet visible={isNewClientSheetOpen} onClose={() => setIsNewClientSheetOpen(false)} maxHeightPct={90}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ padding: 16, gap: 16, paddingBottom: (insets.bottom || 0) + 16 }}>
            <View style={s.rowBetween}>
              <Text style={s.sheetTitleSm}>{newClient.id ? 'Editar Cliente' : 'Registrar Nuevo Lead / Cliente'}</Text>
              <TouchableOpacity onPress={() => setIsNewClientSheetOpen(false)}>
                <Icon name="circle-xmark" size={18} color={C.slate400} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={s.sheetFieldLabel}>Nombre Completo</Text>
                <TextInput
                  placeholder="Ej: Juan Pérez"
                  placeholderTextColor={C.slate400}
                  value={newClient.nombre}
                  onChangeText={(t) => setNewClient({ ...newClient, nombre: t })}
                  style={s.sheetInput}
                />
              </View>
              <View>
                <Text style={s.sheetFieldLabel}>Teléfono o Celular</Text>
                <TextInput
                  placeholder="Ej: +56 9 1234 5678"
                  placeholderTextColor={C.slate400}
                  keyboardType="phone-pad"
                  value={newClient.telefono}
                  onChangeText={(t) => setNewClient({ ...newClient, telefono: t })}
                  style={s.sheetInput}
                />
              </View>
              <View>
                <Text style={s.sheetFieldLabel}>Estado del trato</Text>
                <Dropdown
                  value={newClient.estado}
                  onChange={(v) => setNewClient({ ...newClient, estado: v })}
                  options={ESTADO_CLIENTE_OPTIONS}
                />
              </View>
              <View>
                <Text style={s.sheetFieldLabel}>Rol Comercial</Text>
                <Dropdown
                  value={newClient.rol}
                  onChange={(v) => setNewClient({ ...newClient, rol: v as NewClientData['rol'] })}
                  options={CLIENTE_ROL_OPTIONS}
                />
              </View>
              <View>
                <Text style={s.sheetFieldLabel}>Auto de Interés</Text>
                <Dropdown
                  value={newClient.interes}
                  placeholder="Selecciona un auto del stock"
                  onChange={(v) => setNewClient({ ...newClient, interes: v })}
                  options={interesOptions}
                />
              </View>
            </View>

            <TouchableOpacity onPress={handleGuardarCliente} style={s.sheetPrimaryBtn}>
              <Text style={s.sheetPrimaryText}>{newClient.id ? 'Guardar Cambios' : 'Registrar Cliente'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Sheet>
    );
  }
}

/* ============================ HELPERS / SUBCOMPONENTES ============================ */
// Estados del trato de un lead (sin emojis, tono CRM corporativo)
const ESTADO_CLIENTE_OPTIONS = [
  { label: 'Nuevo', value: 'Nuevo' },
  { label: 'Interesado', value: 'Interesado' },
  { label: 'Caliente', value: 'Caliente' },
  { label: 'Frecuente', value: 'Frecuente' },
  { label: 'Adquisición', value: 'Adquisición' },
  { label: 'Reserva', value: 'Reserva' },
  { label: 'Comprador', value: 'Comprador' },
];

const CLIENTE_ROL_OPTIONS = [
  { label: 'Cliente de venta', value: 'Venta' },
  { label: 'Cliente de adquisición', value: 'Adquisición' },
  { label: 'Ambos', value: 'Ambos' },
];

// Color del badge según el estado del lead
function badgeForEstadoCliente(estado: string) {
  switch (estado) {
    case 'Caliente':
      return { bg: C.red50, color: C.red700 };
    case 'Frecuente':
      return { bg: C.emerald50, color: C.emerald700 };
    case 'Interesado':
      return { bg: C.amber50, color: C.amber700 };
    case 'Adquisición':
      return { bg: C.teal50, color: C.teal700 };
    case 'Reserva':
      return { bg: C.blue50, color: C.blue700 };
    case 'Comprador':
      return { bg: C.emerald50, color: C.emerald700 };
    case 'Nuevo':
    default:
      return { bg: C.blue50, color: C.blue700 };
  }
}

function badgeForClienteRol(role: ClienteRol) {
  if (role === 'Adquisición') return { bg: C.teal50, color: C.teal700 };
  return { bg: C.slate100, color: C.slate600 };
}

function emptyContact(): VehicleContact {
  return { clienteId: null, nombre: '', telefono: '' };
}

function hasContactData(contact: VehicleContact | null | undefined) {
  return !!contact && (!!contact.nombre.trim() || !!contact.telefono.trim());
}

function cleanVehicleContact(contact: VehicleContact | null | undefined): VehicleContact | null {
  if (!contact) return null;
  const clean = {
    clienteId: typeof contact.clienteId === 'number' ? contact.clienteId : null,
    nombre: contact.nombre.trim(),
    telefono: contact.telefono.trim(),
  };
  return hasContactData(clean) ? clean : null;
}

function requiresBuyer(estado: EstadoAuto | string) {
  return estado === 'Reservado' || estado === 'Vendido';
}

function rolesFromForm(rol: NewClientData['rol']): ClienteRol[] {
  return rol === 'Ambos' ? ['Adquisición', 'Venta'] : [rol];
}

function roleFormFromRoles(roles: ClienteRol[] | undefined): NewClientData['rol'] {
  const normalized = normalizeRolesArray(roles);
  if (normalized.includes('Adquisición') && normalized.includes('Venta')) return 'Ambos';
  return normalized.includes('Adquisición') ? 'Adquisición' : 'Venta';
}

function normalizeCustomerRoles(customer: Customer): ClienteRol[] {
  return normalizeRolesArray(customer.roles);
}

function normalizeRolesArray(roles: ClienteRol[] | undefined): ClienteRol[] {
  if (!roles?.length) return ['Venta'];
  const clean = roles.filter((role): role is ClienteRol => role === 'Adquisición' || role === 'Venta');
  return clean.length ? Array.from(new Set(clean)) : ['Venta'];
}

function normalizePhone(telefono: string) {
  return (telefono || '').replace(/\D/g, '');
}

function getCarLabel(car: Pick<Car, 'marca' | 'modelo' | 'anio'>) {
  return `${car.marca} ${car.modelo}${car.anio ? ` ${car.anio}` : ''}`.trim();
}

function contactDisplayName(contact: VehicleContact | null | undefined) {
  if (!contact || !hasContactData(contact)) return 'Sin registrar';
  return contact.telefono ? `${contact.nombre || 'Sin nombre'} · ${contact.telefono}` : contact.nombre;
}

function getCustomerVehicleLabels(customer: Customer, stockById: Map<number, Car>) {
  const labels: string[] = [];
  (customer.vehiculosAdquisicionIds || []).forEach((id) => {
    const car = stockById.get(id);
    if (car) labels.push(`Adq. ${getCarLabel(car)}`);
  });
  (customer.vehiculosVentaIds || []).forEach((id) => {
    const car = stockById.get(id);
    if (car) labels.push(`${car.estado === 'Reservado' ? 'Reserva' : 'Venta'} ${getCarLabel(car)}`);
  });
  return labels;
}

function updateCarContactForCustomer(car: Car, customer: Customer): Car {
  return {
    ...car,
    clienteAdquisicion:
      car.clienteAdquisicion?.clienteId === customer.id
        ? { ...car.clienteAdquisicion, nombre: customer.nombre, telefono: customer.telefono }
        : car.clienteAdquisicion,
    comprador:
      car.comprador?.clienteId === customer.id
        ? { ...car.comprador, nombre: customer.nombre, telefono: customer.telefono }
        : car.comprador,
  };
}

function syncStockAndCustomers(stock: Car[], customers: Customer[]): { stock: Car[]; customers: Customer[] } {
  let nextCustomerId = Math.max(0, ...customers.map((c) => c.id)) + 1;
  const nextCustomers: Customer[] = customers.map((customer) => ({
    ...customer,
    roles: normalizeCustomerRoles(customer),
    vehiculosAdquisicionIds: [],
    vehiculosVentaIds: [],
    reservadoId: null,
  }));

  const findCustomerIndex = (contact: VehicleContact) => {
    if (typeof contact.clienteId === 'number') {
      const byId = nextCustomers.findIndex((c) => c.id === contact.clienteId);
      if (byId >= 0) return byId;
    }
    const phone = normalizePhone(contact.telefono);
    if (phone) {
      const byPhone = nextCustomers.findIndex((c) => normalizePhone(c.telefono) === phone);
      if (byPhone >= 0) return byPhone;
    }
    const name = contact.nombre.trim().toLowerCase();
    if (name) return nextCustomers.findIndex((c) => c.nombre.trim().toLowerCase() === name);
    return -1;
  };

  const upsertCustomer = (contact: VehicleContact, role: ClienteRol, car: Car): VehicleContact => {
    const idx = findCustomerIndex(contact);
    const carLabel = getCarLabel(car);
    const estado = role === 'Adquisición' ? 'Adquisición' : car.estado === 'Vendido' ? 'Comprador' : 'Reserva';
    if (idx < 0) {
      const created: Customer = {
        id: nextCustomerId++,
        nombre: contact.nombre || 'Cliente sin nombre',
        telefono: contact.telefono,
        tipo: 'Particular',
        estado,
        interes: role === 'Venta' ? carLabel : '',
        reservadoId: role === 'Venta' && car.estado === 'Reservado' ? car.id : null,
        roles: [role],
        vehiculosAdquisicionIds: role === 'Adquisición' ? [car.id] : [],
        vehiculosVentaIds: role === 'Venta' ? [car.id] : [],
      };
      nextCustomers.push(created);
      return { ...contact, clienteId: created.id };
    }

    const existing = nextCustomers[idx];
    const roles = Array.from(new Set([...normalizeCustomerRoles(existing), role]));
    const vehiculosAdquisicionIds = role === 'Adquisición'
      ? Array.from(new Set([...(existing.vehiculosAdquisicionIds || []), car.id]))
      : existing.vehiculosAdquisicionIds || [];
    const vehiculosVentaIds = role === 'Venta'
      ? Array.from(new Set([...(existing.vehiculosVentaIds || []), car.id]))
      : existing.vehiculosVentaIds || [];
    nextCustomers[idx] = {
      ...existing,
      nombre: contact.nombre || existing.nombre,
      telefono: contact.telefono || existing.telefono,
      estado: role === 'Venta' || existing.estado === 'Nuevo' ? estado : existing.estado,
      interes: role === 'Venta' ? carLabel : existing.interes,
      reservadoId: role === 'Venta' && car.estado === 'Reservado' ? car.id : existing.reservadoId,
      roles,
      vehiculosAdquisicionIds,
      vehiculosVentaIds,
    };
    return { ...contact, clienteId: existing.id };
  };

  const nextStock = stock.map((car) => {
    const clienteAdquisicion = cleanVehicleContact(car.clienteAdquisicion);
    const comprador = cleanVehicleContact(car.comprador);
    const nextCar = { ...car, clienteAdquisicion, comprador };
    if (clienteAdquisicion) {
      nextCar.clienteAdquisicion = upsertCustomer(clienteAdquisicion, 'Adquisición', nextCar);
    }
    if (requiresBuyer(nextCar.estado) && comprador) {
      nextCar.comprador = upsertCustomer(comprador, 'Venta', nextCar);
    }
    return nextCar;
  });

  return { stock: nextStock, customers: nextCustomers };
}

function makeEmptyWizard(): WizardData {
  return {
    id: null,
    patente: '',
    vin: '',
    tipoVehiculo: 'Vehículo liviano',
    marca: '',
    modelo: '',
    version: '',
    anio: 0,
    anioFabricacion: 0,
    sucursal: 'Mayorista',
    fechaIngreso: todayIsoDate(),
    km: 0,
    color: '',
    transmision: 'Manual',
    combustible: 'Bencina',
    traccion: '4x2',
    cilindrada: 0,
    puertas: '',
    equipamiento: [],
    otros: '',
    origen: 'Nacional',
    precioVenta: 0,
    precioPublicacionContado: 0,
    precioPublicacionFinanciado: 0,
    precioVentaEstimado: 0,
    costoAdquisicion: 0,
    estado: 'En preparación',
    diasStock: 1,
    fotos: [],
    comentario: '',
    documentos: [],
    clienteAdquisicion: null,
    comprador: null,
    desdeSubastaId: null,
  };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function optionsWithCurrent(current: string, base: string[]) {
  const options = base.map((value) => ({ label: value, value }));
  if (current && !base.includes(current)) {
    return [{ label: current, value: current }, ...options];
  }
  return options;
}

function badgeForEstado(estado: EstadoAuto) {
  switch (estado) {
    case 'En venta':
      return { bg: C.emerald50, color: C.emerald700, border: C.emerald200 };
    case 'En preparación':
    case 'Pre-stock':
      return { bg: C.amber50, color: C.amber700, border: C.amber200 };
    case 'Reservado':
      return { bg: C.blue50, color: C.blue700, border: C.blue100 };
    case 'Vendido':
      return { bg: C.slate100, color: C.slate500, border: C.slate200 };
    default:
      return { bg: C.slate100, color: C.slate700, border: C.slate200 };
  }
}

function isAuctionFinal(auction: Auction) {
  return ['Adjudicada', 'Perdida', 'Vendida', 'Finalizada', 'Cancelada'].includes(auction.estado);
}

function getAuctionMsLeft(auction: Auction, nowTs: number) {
  const endsAt = new Date(auction.endsAt).getTime();
  if (!Number.isFinite(endsAt)) return 0;
  return Math.max(0, endsAt - nowTs);
}

function getAuctionProgressPct(auction: Auction, nowTs: number) {
  const startedAt = new Date(auction.startedAt).getTime();
  const endsAt = new Date(auction.endsAt).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endsAt) || endsAt <= startedAt) return 100;
  const elapsed = Math.min(Math.max(nowTs - startedAt, 0), endsAt - startedAt);
  return Math.round((elapsed / (endsAt - startedAt)) * 100);
}

function formatAuctionRemaining(msLeft: number) {
  if (msLeft <= 0) return 'Finalizada';
  const totalSeconds = Math.floor(msLeft / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function mergeAuctionsWithInitial(savedAuctions: Auction[]) {
  const initialById = new Map(INITIAL_AUCTIONS.map((auction) => [auction.id, auction]));
  const savedIds = new Set(savedAuctions.map((auction) => auction.id));
  const hydratedSaved = savedAuctions.map((auction) => {
    const initial = initialById.get(auction.id);
    if (!initial) return auction;
    return {
      ...initial,
      ...auction,
      imageUrl: auction.imageUrl || initial.imageUrl,
      features: auction.features?.length ? auction.features : initial.features,
      sellerNote: auction.sellerNote || initial.sellerNote,
      startedAt: auction.startedAt || initial.startedAt,
      endsAt: auction.endsAt || initial.endsAt,
    };
  });
  const missingInitial = INITIAL_AUCTIONS.filter((auction) => !savedIds.has(auction.id));
  return [...hydratedSaved, ...missingInitial];
}

function getAuctionImageUrl(auction: Auction, stockCar?: Car | null) {
  return (
    stockCar?.fotos?.[0] ||
    auction.imageUrl ||
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80'
  );
}

function getAuctionFeatures(auction: Auction) {
  if (auction.features?.length) return auction.features;
  return [
    { label: 'Documentos', value: 'Revisión documental pendiente de comprador' },
    { label: 'Estado exterior', value: auction.color ? `Color ${auction.color}, detalles normales de uso` : 'Detalles normales de uso' },
    { label: 'Uso declarado', value: auction.km > 120000 ? 'Alto kilometraje, revisar mecánica' : 'Uso particular o flota liviana' },
    { label: 'Entrega', value: 'Coordinación posterior a adjudicación' },
  ];
}

function closeAuction(auction: Auction): Auction {
  if (auction.sellerType === 'propio') {
    const bestOffer = Math.max(0, ...(auction.receivedOffers || []));
    if (bestOffer <= 0) {
      return { ...auction, estado: 'Finalizada', winningBid: 0 };
    }
    return { ...auction, estado: 'Vendida', winningBid: bestOffer, costoFinal: bestOffer };
  }

  if (!auction.miOferta) return { ...auction, estado: 'Finalizada' };
  const competingBid = auction.hiddenBestOffer || 0;
  if (!competingBid || auction.miOferta >= competingBid) {
    return { ...auction, estado: 'Adjudicada', costoFinal: auction.miOferta, winningBid: auction.miOferta };
  }
  return { ...auction, estado: 'Perdida', winningBid: competingBid };
}

function suggestSealedBid(auction: Auction) {
  const reference = auction.costoFinal || auction.sugeridoVenta * 0.78 || 0;
  return Math.max(100000, Math.round(reference / 100000) * 100000);
}

function getAuctionStatusCopy(auction: Auction, active: boolean) {
  if (active && auction.sellerType === 'propio') return { label: 'Mi subasta', bg: C.teal50, color: C.teal700 };
  if (active && auction.miOferta) return { label: 'Ofertada', bg: C.amber50, color: C.amber700 };
  if (active) return { label: 'Abierta', bg: C.emerald50, color: C.emerald700 };
  switch (auction.estado) {
    case 'Adjudicada':
      return { label: 'Ganada', bg: C.emerald50, color: C.emerald700 };
    case 'Perdida':
      return { label: 'Perdida', bg: C.red50, color: C.red700 };
    case 'Vendida':
      return { label: 'Vendida', bg: C.emerald50, color: C.emerald700 };
    case 'Cancelada':
      return { label: 'Cancelada', bg: C.red50, color: C.red700 };
    default:
      return { label: 'Finalizada', bg: C.slate100, color: C.slate600 };
  }
}

/* ---------------- Dashboard de inicio ---------------- */
function KpiCard({ label, value, insight, color }: { label: string; value: string; insight: string; color: string }) {
  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={[s.kpiInsight, { color }]}>{insight}</Text>
    </View>
  );
}

function BarsAntiguedad({ data }: { data: { label: string; cantidad: number; color: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.cantidad));
  return (
    <View style={s.barsRow}>
      {data.map((d) => (
        <View key={d.label} style={s.barCol}>
          <Text style={s.barValue}>{d.cantidad}</Text>
          <View style={s.barTrack}>
            <View
              style={[s.barFill, { height: `${(d.cantidad / max) * 100}%`, backgroundColor: d.color }]}
            />
          </View>
          <Text style={s.barLabel}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

function BarsEstado({ data, total }: { data: { estado: string; cantidad: number }[]; total: number }) {
  const max = Math.max(1, ...data.map((d) => d.cantidad));
  return (
    <View style={{ gap: 10 }}>
      {data.map((d) => (
        <View key={d.estado} style={s.hbarRow}>
          <Text style={s.hbarLabel} numberOfLines={1}>
            {d.estado}
          </Text>
          <View style={s.hbarTrack}>
            <View style={[s.hbarFill, { width: `${(d.cantidad / max) * 100}%` }]} />
          </View>
          <Text style={s.hbarValue}>{d.cantidad}</Text>
        </View>
      ))}
      <Text style={s.chartFoot}>
        {total} {total === 1 ? 'auto activo' : 'autos activos'} en total
      </Text>
    </View>
  );
}

function NavButton({
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

function SegBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.segBtn, active && s.segBtnActive]} activeOpacity={0.8}>
      <Text style={{ fontSize: 12, fontWeight: W.bold, color: active ? C.slate800 : C.slate600 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const CAL_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CAL_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function DateField({
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

  const moveMonth = (delta: number) => {
    setCursor(new Date(year, month + delta, 1));
  };

  const selectDay = (day: number) => {
    onChange(formatIsoDate(new Date(year, month, day)));
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
          <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={StyleSheet.absoluteFillObject} />
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
              {optional && value ? (
                <TouchableOpacity activeOpacity={0.8} onPress={() => { onChange(''); setOpen(false); }} style={s.calendarClearBtn}>
                  <Text style={s.calendarClearText}>Limpiar</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flex: 1 }} />
              )}
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

function parseIsoDate(value: string) {
  if (!value) return null;
  const parts = value.split('-').map((part) => parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatIsoDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildCalendarCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < mondayOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function Field({
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

function MultilineField({
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

function ToggleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={[s.toggleChip, active && s.toggleChipActive]}>
      {active && <Icon name="check" size={9} color={C.white} />}
      <Text style={[s.toggleChipText, active && { color: C.white }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TechItem({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ width: '48%' }}>
      <Text style={s.techLabel}>{label}</Text>
      <Text style={[s.techValue, warn && { color: C.amber600 }]}>{value}</Text>
    </View>
  );
}

/* ---------------------- AutoSave ---------------------- */
// El color solo comunica semántica (veredictos y bloqueos), nunca decora.
function veredictoColor(v: VeredictoAutosave) {
  switch (v) {
    case 'critico':
      return { bg: C.red50, color: C.red600, text: C.red700 };
    case 'atencion':
      return { bg: C.amber50, color: C.amber600, text: C.amber800 };
    default:
      return { bg: C.emerald50, color: C.emerald600, text: C.emerald800 };
  }
}

function totalAntecedentes(informe: InformeAutosave) {
  return (
    informe.siniestros.length +
    informe.revisiones.length +
    informe.titulares.length +
    informe.multas.length +
    (informe.prenda?.vigente ? 1 : 0) +
    (informe.encargo.vigente ? 1 : 0)
  );
}

function contactoParaDestinatario(car: Car, destino: EnvioInforme['destinatario']): VehicleContact {
  if (destino === 'Comprador' && car.comprador) return { ...car.comprador };
  if (destino === 'Vendedor' && car.clienteAdquisicion) return { ...car.clienteAdquisicion };
  return emptyContact();
}

function ReportRow({
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

function TransferMetaRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.asMetaRow}>
      <Text style={s.asMetaRowLabel}>{label}</Text>
      <Text style={[s.asMetaRowValue, strong && { color: C.slate800, fontWeight: W.extrabold }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function PartyRow({ rol, contacto }: { rol: string; contacto: VehicleContact | null }) {
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

function VehicleContactCard({
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

function NotificationBanner({ message, type, top }: { message: string; type?: string; top: number }) {
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
function PhotoGallery({ fotos }: { fotos: string[] }) {
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

/* ============================ ESTILOS ============================ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.chileanNavy, alignItems: 'center' },
  frame: { flex: 1, width: '100%', maxWidth: 440, backgroundColor: C.chileanBg },

  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  /* Header */
  header: {
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.slate100,
  },
  logoImg: { width: 130, height: 38 },

  main: { flex: 1, backgroundColor: C.chileanBg },
  mainContent: { paddingTop: 16, paddingBottom: 24 },

  /* Nav */
  nav: {
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.slate200,
    paddingHorizontal: 8,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navBtn: { alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 12, minWidth: 56 },
  navLabel: { fontSize: 10, fontWeight: W.bold, textAlign: 'center' },
  navBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: C.teal500,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.white,
    paddingHorizontal: 2,
  },
  navBadgeText: { color: C.white, fontWeight: W.black, fontSize: 8 },
  fabWrap: { transform: [{ translateY: -20 }] },
  fab: {
    backgroundColor: C.chileanTeal,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: C.white,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  /* Notificación */
  notif: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
    backgroundColor: C.teal800,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.teal500,
    alignSelf: 'center',
    maxWidth: 440 - 32,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  notifText: { color: C.white, fontSize: 13, fontWeight: W.semibold, flex: 1 },

  /* Inicio */
  homeGreeting: { minWidth: 0 },
  h2: { fontSize: 22, fontWeight: W.bold, color: C.graphite, letterSpacing: -0.2 },
  h2Black: { fontSize: 20, fontWeight: W.black, color: C.slate800 },
  subMuted: { fontSize: 13, color: C.slate500, flexShrink: 1, marginTop: 2 },

  /* Motor de precios — botón único de acceso */
  motorBtn: {
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: C.brandDeep,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  motorBtnIcon: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  motorBtnTitle: { color: C.white, fontSize: 19, fontWeight: W.bold, letterSpacing: -0.2 },
  motorBtnSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 3 },

  /* Motor de precios — pantalla */
  motorField: { gap: 6 },
  motorDemoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  motorDemoLabel: { fontSize: 11, color: C.slate400, fontWeight: W.semibold },
  motorDemoChip: {
    backgroundColor: C.slate100,
    borderWidth: 1,
    borderColor: C.slate200,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  motorDemoChipText: { fontSize: 11, fontWeight: W.bold, color: C.slate600, letterSpacing: 0.5 },
  motorKmWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 12,
    paddingRight: 14,
  },
  motorKmInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: W.bold,
    color: C.slate800,
  },
  motorKmSuffix: { fontSize: 13, fontWeight: W.bold, color: C.slate400 },
  motorKmHint: { fontSize: 11, color: C.slate500, fontWeight: W.medium },
  motorTasarBtn: {
    backgroundColor: C.chileanTeal,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  motorTasarText: { color: C.white, fontSize: 15, fontWeight: W.black },

  motorCarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 16,
    padding: 14,
  },
  motorCarIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.teal50, alignItems: 'center', justifyContent: 'center' },
  motorCarTitle: { fontSize: 15, fontWeight: W.extrabold, color: C.slate800 },
  motorCarSub: { fontSize: 11, color: C.slate500, marginTop: 1 },
  motorConfTag: { backgroundColor: C.emerald100, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  motorConfText: { fontSize: 9, fontWeight: W.black, color: C.emerald800 },

  motorResultBox: {
    backgroundColor: C.teal900,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 2,
  },
  motorResultLabel: { color: C.teal200, fontSize: 12, fontWeight: W.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  motorResultRange: { color: C.white, fontSize: 30, fontWeight: W.black },
  motorResultAnd: { color: C.teal300, fontSize: 12, fontWeight: W.bold },
  motorResultFoot: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12 },
  motorResultFootText: { color: C.teal200, fontSize: 11, flex: 1, lineHeight: 15 },

  motorBreakdown: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  motorBreakTitle: {
    fontSize: 11,
    fontWeight: W.extrabold,
    color: C.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 10,
  },
  motorBreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.slate100,
  },
  motorBreakRowLast: { borderTopWidth: 1, borderTopColor: C.slate200 },
  motorBreakLabel: { fontSize: 12, color: C.slate600, fontWeight: W.medium, flex: 1 },
  motorBreakValue: { fontSize: 13, color: C.slate700, fontWeight: W.bold },
  motorBreakValueStrong: { fontSize: 14, color: C.slate800, fontWeight: W.extrabold },

  motorCompRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.slate100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  motorCompTitle: { fontSize: 13, fontWeight: W.bold, color: C.slate700 },
  motorCompSub: { fontSize: 10, color: C.slate400, marginTop: 1 },
  motorCompPrice: { fontSize: 13, fontWeight: W.extrabold, color: C.slate800 },

  motorTakeBtn: {
    backgroundColor: C.slate800,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  motorTakeText: { color: C.white, fontSize: 14, fontWeight: W.bold },
  motorDisclaimer: { fontSize: 10, color: C.slate400, textAlign: 'center', lineHeight: 14 },

  // Mayúsculas con tracking amplio, igual que el wordmark "AUTORED" del logo.
  sectionLabel: { fontWeight: W.bold, fontSize: 11, color: C.slate400, textTransform: 'uppercase', letterSpacing: 1.4 },

  /* ---------- AutoSave ---------- */
  // La barra cian es el único acento estructural: agrupa las dos tarjetas del socio.
  asBlock: { flexDirection: 'row', gap: 10 },
  asBrandBar: { width: 3, borderRadius: 9999, backgroundColor: C.chileanTeal },
  asCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 },
  asBrandLabel: {
    flex: 1,
    fontWeight: W.bold,
    fontSize: 10,
    color: C.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  asFolio: { fontSize: 10, fontWeight: W.extrabold, color: C.slate500, letterSpacing: 0.4 },

  asVerdictStrip: { flexDirection: 'row', gap: 6 },
  asVerdictCell: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: C.slate50,
    borderWidth: 1,
    borderColor: C.slate100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  asVerdictBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  asVerdictLabel: {
    fontSize: 9,
    fontWeight: W.bold,
    color: C.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  asVerdictValue: { fontSize: 10, fontWeight: W.extrabold, textAlign: 'center', lineHeight: 13 },

  asAlertStrip: { borderLeftWidth: 3, borderRadius: 8, padding: 10, marginTop: 12, gap: 3 },
  asAlertTitle: { fontSize: 12, fontWeight: W.extrabold },
  asAlertText: { fontSize: 11, color: C.slate600, fontWeight: W.medium, lineHeight: 16 },

  asLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.slate100,
  },
  asLinkText: { fontSize: 13, fontWeight: W.extrabold, color: C.slate800 },
  asMetaText: { fontSize: 10, color: C.slate400, fontWeight: W.medium, marginTop: 2, lineHeight: 15 },

  asClientBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.slate100 },
  asClientTitle: {
    fontSize: 10,
    fontWeight: W.bold,
    color: C.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  asClientHint: { fontSize: 11, color: C.slate500, fontWeight: W.medium, lineHeight: 16, marginTop: 4 },

  // CTAs de AutoSave en grafito: se leen como producto del socio, no como acción core de AutoRed.
  asCtaDark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.slate800,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginTop: 10,
    gap: 8,
  },
  asCtaDarkText: { color: C.white, fontWeight: W.extrabold, fontSize: 12 },
  asCtaPrice: { color: C.teal400, fontWeight: W.extrabold, fontSize: 12 },
  asCtaDisabled: { backgroundColor: C.slate100 },

  asPitchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  asPitchText: { flex: 1, fontSize: 11.5, color: C.slate600, fontWeight: W.medium, lineHeight: 17 },
  asQuoteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.slate100,
  },

  asTimelineItem: { flexDirection: 'row', gap: 10 },
  asTimelineGutter: { alignItems: 'center', width: 14 },
  asTimelineNode: {
    width: 11,
    height: 11,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: C.slate300,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  asTimelineNodeDone: { backgroundColor: C.slate800, borderColor: C.slate800 },
  asTimelineNodeActive: { backgroundColor: C.chileanTeal, borderColor: C.chileanTeal },
  asTimelineLine: { flex: 1, width: 2, backgroundColor: C.slate200, marginVertical: 2 },
  asTimelineLabel: { flex: 1, fontSize: 12, fontWeight: W.bold, color: C.slate400, paddingRight: 8 },
  asTimelineDate: { fontSize: 10, fontWeight: W.bold, color: C.slate400 },
  asTimelineDetail: { fontSize: 11, color: C.slate500, fontWeight: W.medium, lineHeight: 16, marginTop: 2 },

  asTransferMeta: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.slate100, gap: 8 },
  asMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  asMetaRowLabel: { fontSize: 11, color: C.slate400, fontWeight: W.bold, width: 108 },
  asMetaRowValue: { flex: 1, fontSize: 11.5, color: C.slate600, fontWeight: W.semibold, textAlign: 'right' },

  asChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  asChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: C.slate200,
    backgroundColor: C.slate50,
  },
  asChipActive: { backgroundColor: C.chileanNavy, borderColor: C.chileanNavy },
  asChipText: { fontSize: 12, fontWeight: W.bold, color: C.slate600 },

  asPartyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: C.slate50,
    borderWidth: 1,
    borderColor: C.slate100,
    borderRadius: 12,
    padding: 12,
  },
  asPartyRol: { fontSize: 10, fontWeight: W.bold, color: C.slate400, textTransform: 'uppercase', letterSpacing: 0.5 },
  asPartyName: { fontSize: 13, fontWeight: W.extrabold, color: C.slate800, textAlign: 'right' },
  asPartyPhone: { fontSize: 11, color: C.slate500, fontWeight: W.medium },

  asCostRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8 },
  asCostLabel: { fontSize: 12, color: C.slate600, fontWeight: W.semibold },
  asCostNota: { fontSize: 10, color: C.slate400, fontWeight: W.medium, lineHeight: 14, marginTop: 2 },
  asCostValue: { fontSize: 12, color: C.slate700, fontWeight: W.bold },
  asCostTotalRow: { borderTopWidth: 1, borderTopColor: C.slate200, marginTop: 4, paddingTop: 10 },
  asCostTotalLabel: { fontSize: 13, color: C.slate800, fontWeight: W.extrabold },
  asCostTotalValue: { fontSize: 15, color: C.slate800, fontWeight: W.black },

  // Ventana del informe completo
  asReportHero: { backgroundColor: C.slate900, borderRadius: 16, padding: 16, gap: 3 },
  asReportHeroTitle: { color: C.white, fontSize: 17, fontWeight: W.extrabold },
  asReportHeroSub: { color: C.slate400, fontSize: 11, fontWeight: W.medium },
  asReportBanner: { marginTop: 10, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12 },
  asReportBannerText: {
    color: C.white,
    fontSize: 12,
    fontWeight: W.extrabold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  asReportResumen: { color: C.slate300, fontSize: 12, fontWeight: W.medium, lineHeight: 18, marginTop: 8 },
  asReportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.slate100,
  },
  asReportRowLabel: { fontSize: 12, color: C.slate600, fontWeight: W.semibold, flexShrink: 1 },
  asReportRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' },
  asReportRowValue: { fontSize: 12, fontWeight: W.bold, textAlign: 'right', flexShrink: 1 },

  asEventCard: {
    borderLeftWidth: 3,
    borderLeftColor: C.slate300,
    backgroundColor: C.slate50,
    borderRadius: 8,
    padding: 12,
    gap: 2,
  },
  asEventTitle: { fontSize: 13, fontWeight: W.extrabold, color: C.slate800, flex: 1 },
  asEventMeta: { fontSize: 11, color: C.slate500, fontWeight: W.medium, lineHeight: 16 },
  asEventTag: { fontSize: 10, fontWeight: W.extrabold, color: C.slate500, letterSpacing: 0.5 },

  asKmFecha: { fontSize: 11, fontWeight: W.bold, color: C.slate500 },
  asKmValue: { fontSize: 13, fontWeight: W.extrabold, color: C.slate800 },
  asKmTrack: { height: 6, backgroundColor: C.slate100, borderRadius: 9999, marginVertical: 5, overflow: 'hidden' },
  asKmFill: { height: 6, borderRadius: 9999 },
  asKmActual: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.slate200,
    paddingTop: 10,
  },

  asDisclaimer: { fontSize: 10, color: C.slate400, fontWeight: W.medium, textAlign: 'center', lineHeight: 15 },

  /* KPIs */
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiCard: {
    flex: 1,
    backgroundColor: C.white,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.slate200,
  },
  kpiLabel: { fontSize: 10, fontWeight: W.semibold, color: C.slate500 },
  kpiValue: { fontSize: 17, fontWeight: W.bold, color: C.graphite, marginTop: 8, letterSpacing: -0.3 },
  kpiInsight: { fontSize: 10, fontWeight: W.medium, lineHeight: 14, marginTop: 6 },

  /* Gráficos */
  chartCard: { backgroundColor: C.white, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: C.slate200, gap: 16 },
  chartTitle: { fontSize: 14, fontWeight: W.semibold, color: C.graphite },
  chartFoot: { fontSize: 11, color: C.slate400, fontWeight: W.medium, marginTop: 2 },

  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, paddingTop: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 8 },
  barValue: { fontSize: 13, fontWeight: W.semibold, color: C.graphite },
  barTrack: {
    width: '100%',
    height: 88,
    justifyContent: 'flex-end',
    backgroundColor: C.slate50,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.slate100,
  },
  barFill: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 3 },
  barLabel: { fontSize: 10, color: C.slate500, fontWeight: W.medium },

  hbarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hbarLabel: { width: 92, fontSize: 11, color: C.slate600, fontWeight: W.medium },
  hbarTrack: { flex: 1, height: 6, backgroundColor: C.slate100, borderRadius: 3, overflow: 'hidden' },
  hbarFill: { height: '100%', backgroundColor: C.brand, borderRadius: 3 },
  hbarValue: { width: 18, fontSize: 12, fontWeight: W.semibold, color: C.graphite, textAlign: 'right' },

  /* Stock */
  filterBtn: {
    backgroundColor: C.slate200,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterBtnText: { color: C.slate700, fontWeight: W.bold, fontSize: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 12,
  },
  searchInput: { flex: 1, paddingHorizontal: 10, paddingVertical: 12, fontSize: 14, fontWeight: W.medium, color: C.slate800 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  chipActive: { backgroundColor: C.chileanNavy },
  chipInactive: { backgroundColor: C.white, borderWidth: 1, borderColor: C.slate200 },
  chipText: { fontWeight: W.bold, fontSize: 12 },
  chipCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 9999, minWidth: 18, alignItems: 'center' },

  emptyBox: { backgroundColor: C.white, padding: 32, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: C.slate200, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: W.bold, color: C.slate500, textAlign: 'center' },
  resetText: { fontSize: 12, color: C.chileanTeal, fontWeight: W.bold, marginTop: 8 },

  carCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: C.slate100,
    flexDirection: 'row',
    gap: 12,
  },
  carThumb: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: C.slate100 },
  carThumbImg: { width: '100%', height: '100%' },
  carThumbEmpty: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  badge60: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: C.amber500,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  badge60Text: { color: C.white, fontSize: 8, fontWeight: W.extrabold },
  auctionThumbBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: C.chileanTeal,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  carTitle: { fontWeight: W.bold, fontSize: 14, color: C.slate800, flex: 1 },
  patentePill: { backgroundColor: C.slate100, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: C.slate200 },
  patenteText: { fontSize: 10, fontWeight: W.bold, color: C.slate400, textTransform: 'uppercase' },
  trashSm: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.red50,
    borderWidth: 1,
    borderColor: C.red100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carSpecs: { fontSize: 11, color: C.slate500, marginTop: 2 },
  priceLabel: { fontSize: 10, fontWeight: W.semibold, color: C.slate400 },
  priceValue: { fontWeight: W.extrabold, fontSize: 16, color: C.slate800, letterSpacing: -0.3 },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, borderWidth: 1 },
  stockAuctionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.amber50, borderWidth: 1, borderColor: C.amber200, borderRadius: 9999, paddingHorizontal: 7, paddingVertical: 2 },
  stockAuctionText: { fontSize: 9, color: C.amber700, fontWeight: W.extrabold, textTransform: 'uppercase' },
  diasStock: { fontSize: 9, color: C.slate400, fontWeight: W.medium },

  /* Subastas */
  segment: { flexDirection: 'row', backgroundColor: C.slate200, padding: 4, borderRadius: 12 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnActive: { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  aucCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.slate100, gap: 12 },
  publishAuctionBtn: { backgroundColor: C.chileanTeal, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  publishAuctionText: { color: C.white, fontWeight: W.bold, fontSize: 12 },
  auctionLead: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  auctionThumb: { width: 74, height: 74, borderRadius: 12, backgroundColor: C.slate100 },
  aucBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  origenPill: { alignSelf: 'flex-start', backgroundColor: C.slate100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  origenText: { fontSize: 10, color: C.slate600, fontWeight: W.bold, textTransform: 'uppercase' },
  auctionStatusPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  auctionStatusText: { fontSize: 10, fontWeight: W.extrabold, textTransform: 'uppercase' },
  auctionTitleTap: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  aucTitle: { fontWeight: W.extrabold, fontSize: 16, color: C.slate800, marginTop: 4 },
  aucSub: { fontSize: 12, color: C.slate500 },
  aucStockLink: { fontSize: 11, color: C.chileanTeal, fontWeight: W.bold, marginTop: 2 },
  auctionFeatureHint: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 6 },
  auctionFeatureHintText: { color: C.chileanTeal, fontSize: 11, fontWeight: W.extrabold },
  aucId: { fontSize: 12, fontWeight: W.bold, color: C.slate400 },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.amber50, borderWidth: 1, borderColor: C.amber200, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9999 },
  timePillDone: { backgroundColor: C.slate100, borderColor: C.slate200 },
  timePillText: { fontSize: 10, fontWeight: W.extrabold, color: C.amber700 },
  auctionNoteBox: { backgroundColor: C.slate50, borderWidth: 1, borderColor: C.slate100, borderRadius: 12, padding: 10, gap: 3 },
  auctionNoteLabel: { fontSize: 9, color: C.slate400, fontWeight: W.bold, textTransform: 'uppercase' },
  auctionNoteText: { fontSize: 12, color: C.slate700, fontWeight: W.medium, lineHeight: 16 },
  aucSpecs: { flexDirection: 'row', gap: 8, backgroundColor: C.slate50, padding: 10, borderRadius: 12 },
  aucSpecLabel: { color: C.slate400, fontSize: 10, textTransform: 'uppercase', fontWeight: W.bold },
  aucSpecValue: { fontWeight: W.semibold, color: C.slate700, fontSize: 12 },
  auctionProgressTrack: { height: 5, borderRadius: 9999, backgroundColor: C.slate100, overflow: 'hidden' },
  auctionProgressFill: { height: '100%', borderRadius: 9999, backgroundColor: C.chileanTeal },
  aucMoneyLabel: { fontSize: 9, textTransform: 'uppercase', fontWeight: W.bold, color: C.slate400 },
  aucMoney: { fontSize: 14, fontWeight: W.extrabold, color: C.slate700 },
  ofertarBtn: { backgroundColor: C.chileanTeal, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  ofertarBtnText: { color: C.white, fontWeight: W.extrabold, fontSize: 12 },
  pendingPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.amber50, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  pendingText: { fontSize: 12, fontWeight: W.bold, color: C.amber600 },
  viewStockBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.teal50, borderWidth: 1, borderColor: C.teal100, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9999 },
  viewStockText: { fontSize: 11, color: C.chileanTeal, fontWeight: W.extrabold },
  cancelAuctionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.red50, borderWidth: 1, borderColor: C.red100, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9999 },
  cancelAuctionText: { fontSize: 11, color: C.red700, fontWeight: W.extrabold },
  addStockBtn: { backgroundColor: C.teal600, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addStockText: { color: C.white, fontWeight: W.extrabold, fontSize: 12 },

  /* Clientes */
  newClientBtn: { backgroundColor: C.chileanTeal, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  newClientText: { color: C.white, fontWeight: W.bold, fontSize: 12 },
  metricRow: { flexDirection: 'row', gap: 8, backgroundColor: C.slate100, padding: 8, borderRadius: 12 },
  metricCell: { flex: 1, backgroundColor: C.white, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  metricLabel: { fontSize: 10, color: C.slate400, fontWeight: W.bold, textTransform: 'uppercase' },
  metricValue: { fontSize: 14, fontWeight: W.extrabold, color: C.slate800 },
  cliCard: { backgroundColor: C.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.slate100, gap: 14 },
  cliCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cliNombre: { fontWeight: W.extrabold, fontSize: 16, color: C.slate800 },
  cliBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cliEstadoBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  cliEstadoText: { fontSize: 10, fontWeight: W.extrabold, textTransform: 'uppercase', letterSpacing: 0.3 },
  cliIconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.slate50, borderWidth: 1, borderColor: C.slate200, alignItems: 'center', justifyContent: 'center' },
  cliGrid: { flexDirection: 'row', borderWidth: 1, borderColor: C.slate100, borderRadius: 12, overflow: 'hidden' },
  cliGridCell: { flex: 1, padding: 12, gap: 4 },
  cliGridCellRight: { borderLeftWidth: 1, borderLeftColor: C.slate100 },
  cliGridLabel: { fontSize: 10, color: C.slate400, fontWeight: W.bold, textTransform: 'uppercase', letterSpacing: 0.3 },
  cliGridValue: { fontSize: 13, fontWeight: W.bold, color: C.slate800 },
  cliVerLink: { color: C.chileanTeal, fontWeight: W.bold, fontSize: 11 },
  cliStatusBlock: { gap: 6 },
  cliActions: { flexDirection: 'row', gap: 10 },
  cliCallBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: C.slate50, borderWidth: 1, borderColor: C.slate200 },
  cliCallText: { fontWeight: W.bold, fontSize: 13, color: C.slate700 },
  cliWspBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: C.slate800 },
  cliWspText: { fontWeight: W.bold, fontSize: 13, color: C.white },
  cliEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 10 },
  cliEmptyText: { fontSize: 13, color: C.slate400, fontWeight: W.medium, textAlign: 'center' },

  /* Overlays (wizard / detalle) */
  overlayHeader: {
    backgroundColor: C.chileanNavy,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.slate800,
  },
  cancelText: { color: C.slate400, fontWeight: W.semibold, fontSize: 12 },
  overlayTitle: { color: C.white, fontWeight: W.extrabold, fontSize: 14, letterSpacing: -0.3 },
  stepPill: { backgroundColor: C.slate800, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: C.slate700 },
  stepPillText: { fontSize: 12, fontWeight: W.bold, color: C.teal400, textTransform: 'uppercase', letterSpacing: 0.5 },
  progressTrack: { width: '100%', height: 6, backgroundColor: C.slate200 },
  progressFill: { height: '100%', backgroundColor: C.chileanTeal },

  stepTitle: { fontSize: 18, fontWeight: W.bold, color: C.slate800 },
  stepSub: { fontSize: 12, color: C.slate500, marginTop: 2 },

  /* Wizard cámara */
  cameraBox: {
    backgroundColor: C.slate800,
    borderRadius: 16,
    minHeight: 224,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: C.slate600,
    borderStyle: 'dashed',
    gap: 8,
  },
  cameraTitle: { fontSize: 14, fontWeight: W.bold, color: C.white },
  cameraSub: { fontSize: 12, color: C.slate400, textAlign: 'center' },
  captureBtn: { backgroundColor: C.chileanTeal, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  captureText: { color: C.white, fontSize: 12, fontWeight: W.bold },
  galleryBtn: { backgroundColor: C.slate700, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  galleryText: { color: C.slate200, fontSize: 12, fontWeight: W.bold },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewCell: { width: '31%', aspectRatio: 1, backgroundColor: C.slate100, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.slate200 },
  previewImg: { width: '100%', height: '100%' },
  previewBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: C.teal600, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  previewBadgeText: { color: C.white, fontSize: 8, fontWeight: W.black, textTransform: 'uppercase' },
  previewRemove: { position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(2,6,23,0.7)', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  /* Campos */
  fieldLabel: { fontSize: 12, fontWeight: W.bold, color: C.slate500, textTransform: 'uppercase', marginBottom: 4 },
  textInput: { borderWidth: 1, borderColor: C.slate200, borderRadius: 12, padding: 12, fontWeight: W.medium, color: C.slate800, fontSize: 14, backgroundColor: C.white },
  textArea: { minHeight: 96, borderWidth: 1, borderColor: C.slate200, borderRadius: 12, padding: 12, fontWeight: W.medium, color: C.slate800, fontSize: 14, backgroundColor: C.white, lineHeight: 20 },
  patenteInput: { borderWidth: 1, borderColor: C.slate200, borderRadius: 12, padding: 12, fontWeight: W.bold, color: C.slate800, textAlign: 'center', letterSpacing: 4, fontSize: 18, backgroundColor: C.white },
  moneyInput: { borderWidth: 1, borderColor: C.slate200, borderRadius: 12, padding: 12, fontWeight: W.bold, color: C.slate800, fontSize: 18, backgroundColor: C.white },
  dateField: { minHeight: 48, borderWidth: 1, borderColor: C.slate200, borderRadius: 12, backgroundColor: C.white, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateFieldText: { flex: 1, fontSize: 14, fontWeight: W.bold, color: C.slate800 },
  calendarBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 20 },
  calendarCard: { backgroundColor: C.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.slate200, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  calendarNavBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center' },
  calendarTitle: { fontSize: 16, fontWeight: W.extrabold, color: C.slate800 },
  calendarWeekRow: { flexDirection: 'row', marginBottom: 8 },
  calendarWeekText: { width: `${100 / 7}%`, textAlign: 'center', color: C.slate400, fontSize: 11, fontWeight: W.extrabold },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  calendarDay: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  calendarDaySelected: { backgroundColor: C.chileanTeal },
  calendarDayText: { fontSize: 13, fontWeight: W.bold, color: C.slate700 },
  calendarDayTextSelected: { color: C.white },
  calendarFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, borderTopWidth: 1, borderTopColor: C.slate100, paddingTop: 12 },
  calendarClearBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: C.slate100, alignItems: 'center' },
  calendarClearText: { fontSize: 12, fontWeight: W.extrabold, color: C.slate600 },
  calendarDoneBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: C.chileanNavy, alignItems: 'center' },
  calendarDoneText: { fontSize: 12, fontWeight: W.extrabold, color: C.white },
  inlinePanel: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.slate200, padding: 14 },
  inlinePanelTitle: { fontSize: 13, fontWeight: W.extrabold, color: C.slate700 },
  inlinePanelHint: { fontSize: 11, color: C.slate500, fontWeight: W.medium, marginTop: 3, lineHeight: 16 },
  inlinePanelCount: { minWidth: 24, textAlign: 'center', backgroundColor: C.teal50, color: C.teal700, borderRadius: 9999, overflow: 'hidden', fontSize: 12, fontWeight: W.extrabold, paddingVertical: 2 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  toggleChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9999, borderWidth: 1, borderColor: C.slate200, backgroundColor: C.slate50 },
  toggleChipActive: { backgroundColor: C.chileanTeal, borderColor: C.chileanTeal },
  toggleChipText: { fontSize: 11, fontWeight: W.bold, color: C.slate600 },
  addDocBtn: { backgroundColor: C.chileanTeal, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addDocText: { color: C.white, fontSize: 12, fontWeight: W.extrabold },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.slate50, borderWidth: 1, borderColor: C.slate100, borderRadius: 12, padding: 12 },
  docTitle: { fontSize: 12, fontWeight: W.extrabold, color: C.slate700 },
  docMeta: { fontSize: 10, fontWeight: W.medium, color: C.slate400, marginTop: 2 },
  docRemove: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.red50, borderWidth: 1, borderColor: C.red100 },
  docsEmpty: { marginTop: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: C.slate200, borderRadius: 12, padding: 18, alignItems: 'center', gap: 6 },
  docsEmptyText: { fontSize: 12, fontWeight: W.bold, color: C.slate400, textAlign: 'center' },
  margenBox: { backgroundColor: C.emerald50, borderWidth: 1, borderColor: C.emerald100, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  margenLabel: { fontSize: 10, color: C.emerald600, fontWeight: W.bold, textTransform: 'uppercase' },
  margenValue: { fontSize: 18, fontWeight: W.black, color: C.emerald800 },
  margenTag: { backgroundColor: C.emerald200, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  margenTagText: { fontSize: 12, color: C.emerald800, fontWeight: W.extrabold },

  reviewCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.slate200, gap: 12 },
  reviewTitle: { fontWeight: W.extrabold, fontSize: 16, color: C.slate800, flex: 1 },
  reviewPatente: { backgroundColor: C.slate100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  reviewPatenteText: { color: C.slate700, fontWeight: W.extrabold, fontSize: 12, textTransform: 'uppercase' },
  hr: { height: 1, backgroundColor: C.slate100 },
  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  reviewCell: { width: '50%', fontSize: 12, fontWeight: W.bold, color: C.slate700 },
  reviewCellLabel: { color: C.slate400, fontWeight: W.semibold },
  reviewMoneyLabel: { fontSize: 10, color: C.slate400, fontWeight: W.bold },
  reviewCosto: { fontWeight: W.bold, fontSize: 14, color: C.slate700 },
  reviewPrecio: { fontWeight: W.extrabold, fontSize: 18, color: C.teal600 },
  reviewCommercialGrid: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  reviewContactText: { marginTop: 3, fontSize: 12, color: C.slate700, fontWeight: W.bold, lineHeight: 16 },

  /* Wizard footer */
  wizardFooter: { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.slate200, padding: 16, flexDirection: 'row', gap: 12 },
  wizardBack: { flex: 1, paddingVertical: 12, backgroundColor: C.slate100, borderRadius: 12, alignItems: 'center' },
  wizardBackText: { color: C.slate700, fontWeight: W.bold, fontSize: 14 },
  wizardNext: { flex: 1, paddingVertical: 12, backgroundColor: C.chileanTeal, borderRadius: 12, alignItems: 'center' },
  wizardNextText: { color: C.white, fontWeight: W.bold, fontSize: 14 },

  /* Ficha detalle */
  gallery: { width: '100%', height: 224, backgroundColor: C.slate200 },
  galleryEmpty: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  galleryEmptyText: { fontSize: 12, fontWeight: W.semibold, color: C.slate400 },
  galleryCount: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(2,6,23,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  galleryCountText: { color: C.white, fontSize: 12, fontWeight: W.bold },
  galleryDots: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  galleryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  galleryDotActive: { backgroundColor: C.white, width: 14 },
  detailTitle: { fontSize: 20, fontWeight: W.extrabold, color: C.slate800 },
  detailSub: { fontSize: 14, color: C.slate500, fontWeight: W.medium },
  detailEstado: { backgroundColor: C.teal50, borderWidth: 1, borderColor: C.teal200, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  detailAuctionBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.amber50, borderWidth: 1, borderColor: C.amber200, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9999 },
  detailAuctionText: { color: C.amber700, fontSize: 10, fontWeight: W.extrabold, textTransform: 'uppercase' },
  detailMargenCard: { backgroundColor: C.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.slate100, gap: 8 },
  detailMiniLabel: { fontSize: 10, color: C.slate400, fontWeight: W.bold, textTransform: 'uppercase' },
  detailMiniValue: { fontSize: 12, fontWeight: W.bold, color: C.slate600 },
  detailPrecio: { fontSize: 18, fontWeight: W.black, color: C.slate800 },
  detailMargen: { fontSize: 16, fontWeight: W.extrabold, color: C.emerald600 },
  detailFinanceGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 16, borderTopWidth: 1, borderTopColor: C.slate100, paddingTop: 10, marginTop: 2 },
  detailTechCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.slate100 },
  detailTechTitle: { fontWeight: W.bold, fontSize: 12, color: C.slate400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  detailTechGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 16 },
  techLabel: { color: C.slate400, fontWeight: W.bold, fontSize: 12 },
  techValue: { fontWeight: W.semibold, color: C.slate800, fontSize: 12 },
  vehicleContactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.slate50, borderWidth: 1, borderColor: C.slate100, borderRadius: 12, padding: 12 },
  vehicleContactLabel: { fontSize: 10, color: C.slate400, fontWeight: W.bold, textTransform: 'uppercase', marginBottom: 4 },
  vehicleContactName: { fontSize: 13, color: C.slate800, fontWeight: W.extrabold },
  vehicleContactPhone: { fontSize: 12, color: C.slate500, fontWeight: W.medium, marginTop: 2 },
  vehicleContactActions: { flexDirection: 'row', gap: 8 },
  vehicleContactBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.slate200, alignItems: 'center', justifyContent: 'center' },
  equipmentList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  equipmentPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.teal50, borderWidth: 1, borderColor: C.teal100, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9999 },
  equipmentText: { color: C.teal700, fontSize: 11, fontWeight: W.bold },
  emptySectionText: { color: C.slate400, fontSize: 12, fontWeight: W.medium },
  detailNoteInset: { marginTop: 12, backgroundColor: C.slate50, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.slate100 },
  detailNoteInsetLabel: { fontSize: 10, color: C.slate400, fontWeight: W.bold, textTransform: 'uppercase', marginBottom: 4 },
  detailNoteInsetText: { color: C.slate600, fontSize: 12, fontWeight: W.medium, lineHeight: 18 },
  // Inspección de recepción con IA (ficha del auto)
  inspCtaCard: {
    backgroundColor: C.chileanNavy,
    borderRadius: 16,
    padding: 16,
  },
  inspCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.chileanTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspCtaTitle: { fontSize: 14, fontWeight: W.extrabold, color: C.white },
  inspCtaSub: { fontSize: 11, color: C.slate300, marginTop: 3, lineHeight: 15 },
  inspDoneCard: {
    backgroundColor: C.teal50,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.teal200,
  },
  inspDoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.teal100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspTitle: { fontSize: 14, fontWeight: W.extrabold, color: C.slate900 },
  inspSub: { fontSize: 12, color: C.teal800, marginTop: 2, fontWeight: W.semibold },

  notasBox: { backgroundColor: C.slate100, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.slate200 },
  notasLabel: { fontWeight: W.bold, color: C.slate500, fontSize: 12, marginBottom: 4 },
  notasText: { color: C.slate600, fontSize: 12, fontWeight: W.medium, lineHeight: 18 },
  detailFooter: { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.slate200, padding: 16, gap: 10 },
  detailActionGray: { flex: 1, paddingVertical: 12, backgroundColor: C.slate100, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  detailActionGrayText: { color: C.slate700, fontWeight: W.extrabold, fontSize: 12 },
  detailEditBtn: { backgroundColor: C.chileanNavy, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  detailEditText: { color: C.white, fontWeight: W.extrabold, fontSize: 12 },
  detailDeleteBtn: { backgroundColor: C.red50, borderWidth: 1, borderColor: C.red100, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  detailDeleteText: { color: C.red700, fontWeight: W.extrabold, fontSize: 12 },

  /* Sheets */
  sheetHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.slate100 },
  sheetTitle: { fontWeight: W.extrabold, fontSize: 14, color: C.slate800 },
  sheetTitleSm: { fontWeight: W.bold, fontSize: 14, color: C.slate800 },
  sheetFieldLabel: { fontSize: 12, fontWeight: W.bold, color: C.slate400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  sheetInput: { borderWidth: 1, borderColor: C.slate200, borderRadius: 12, padding: 10, fontSize: 12, fontWeight: W.semibold, color: C.slate700, backgroundColor: C.white },
  sheetRangeValue: { fontSize: 12, fontWeight: W.extrabold, color: C.chileanTeal },
  sheetFooter: { padding: 16, borderTopWidth: 1, borderTopColor: C.slate100, flexDirection: 'row', gap: 8 },
  sheetBtnGray: { flex: 1, paddingVertical: 12, backgroundColor: C.slate100, borderRadius: 12, alignItems: 'center' },
  sheetBtnGrayText: { color: C.slate600, fontWeight: W.bold, fontSize: 12 },
  sheetBtnTeal: { flex: 1, paddingVertical: 12, backgroundColor: C.chileanTeal, borderRadius: 12, alignItems: 'center' },
  sheetBtnTealText: { color: C.white, fontWeight: W.bold, fontSize: 12 },
  sheetPrimaryBtn: { paddingVertical: 14, backgroundColor: C.chileanTeal, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  sheetPrimaryText: { color: C.white, fontWeight: W.extrabold, fontSize: 12 },
  publishStickyBtn: { paddingVertical: 13, backgroundColor: C.chileanTeal, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  noteHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  dismissKeyboardBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.teal50, borderWidth: 1, borderColor: C.teal100, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9999 },
  dismissKeyboardText: { color: C.chileanTeal, fontSize: 11, fontWeight: W.extrabold },
  auctionNoteInput: { minHeight: 86, maxHeight: 118, borderWidth: 1, borderColor: C.slate200, borderRadius: 12, padding: 12, fontWeight: W.medium, color: C.slate800, fontSize: 14, backgroundColor: C.white, lineHeight: 20 },
  featureHeroImg: { width: '100%', height: 150, borderRadius: 14, backgroundColor: C.slate100 },
  featureQuickGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 16, backgroundColor: C.slate50, borderWidth: 1, borderColor: C.slate100, borderRadius: 14, padding: 12 },
  featureListCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.slate100, borderRadius: 14, padding: 14 },
  featureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.slate100 },
  featureLabel: { flex: 0.42, fontSize: 11, color: C.slate400, fontWeight: W.bold, textTransform: 'uppercase' },
  featureValue: { flex: 0.58, fontSize: 12, color: C.slate700, fontWeight: W.semibold, textAlign: 'right', lineHeight: 17 },
  featureDetailPill: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.teal50, borderWidth: 1, borderColor: C.teal100, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9 },
  featureDetailLabel: { fontSize: 10, color: C.teal700, fontWeight: W.extrabold, textTransform: 'uppercase', marginBottom: 2 },
  featureDetailText: { fontSize: 12, color: C.slate700, fontWeight: W.semibold, lineHeight: 17 },

  bigValueBox: { backgroundColor: C.slate50, padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: C.slate100 },
  bigValueLabel: { fontSize: 10, color: C.slate400, fontWeight: W.bold, textTransform: 'uppercase' },
  bigValue: { fontSize: 24, fontWeight: W.black, color: C.slate800 },
  sealedInfoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.teal50, borderWidth: 1, borderColor: C.teal100, borderRadius: 12, padding: 12 },
  sealedInfoText: { flex: 1, fontSize: 12, lineHeight: 16, color: C.slate700, fontWeight: W.medium },
  stepperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  stepperBtn: { width: 56, height: 56, backgroundColor: C.slate100, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  stepperMargen: { fontSize: 16, fontWeight: W.extrabold, color: C.emerald600 },
  bidMinText: { fontSize: 12, fontWeight: W.semibold, color: C.slate500, textAlign: 'center' },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: { width: '47%', flexGrow: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBtnActive: { backgroundColor: C.chileanNavy, borderColor: C.chileanNavy },
  statusBtnInactive: { backgroundColor: C.slate50, borderColor: C.slate200 },
});
