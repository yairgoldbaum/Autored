import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Keyboard,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { C, fmtCLP } from './src/theme';
import {
  Car,
  Auction,
  Customer,
  RelacionClienteVehiculo,
  EstadoAuto,
  EnvioInforme,
  ModalidadTransferencia,
  ResponsablePago,
  TraspasoOrigen,
  VehicleContact,
  VehicleDocument,
  INITIAL_STOCK_DATA,
  INITIAL_AUCTIONS,
  INITIAL_CUSTOMERS,
  INITIAL_RELACIONES,
  ESTADOS,
  costoBase,
  diasEnStock,
} from './src/data';
import { Icon } from './src/ui';
import { s } from './src/styles';
import { loadState, saveState } from './src/storage';
import { Tasacion, buscarPatente, normalizarPatente, tasar } from './src/pricing';
import {
  AUTOMOTORA,
  NOTARIAS,
  PRECIO_COPIA_INFORME,
  avanzarTransferencia,
  bloqueosTransferencia,
  crearTransferencia,
  generarInformeAutosave,
  textoWhatsappInforme,
  textoWhatsappTransferencia,
} from './src/autosave';
import { InspectionScreen } from './src/inspection/InspectionScreen';
import { InspectionReport } from './src/inspection/types';
import {
  AUCTION_DURATION_MS,
  ClienteFiltro,
  FiltroDias,
  NewClientData,
  StockFilters,
  SubastaTabKey,
  TabKey,
  WizardData,
  cleanVehicleContact,
  closeAuction,
  contactoParaDestinatario,
  cumpleFiltroCliente,
  cumpleFiltroDias,
  emptyContact,
  emptyNewClient,
  busquedaFromForm,
  getAuctionMsLeft,
  getCustomerVehicleLabels,
  hasContactData,
  isAuctionFinal,
  makeEmptyWizard,
  mergeAuctionsWithInitial,
  periodosConVentas,
  requiresBuyer,
  rolesDeCliente,
  syncStockAndCustomers,
  todayIsoDate,
  updateCarContactForCustomer,
} from './src/helpers';
import { NavButton, NotificationBanner } from './components/shared';
import { KpisScreen } from './screens/Kpis';
import { FilterSheet, StockScreen } from './screens/Stock';
import {
  AuctionBidSheet,
  AuctionFeaturesSheet,
  AuctionPublishSheet,
  SubastasScreen,
} from './screens/Subastas';
import { ClientesScreen, NewClientSheet } from './screens/Clientes';
import { MotorPreciosOverlay } from './screens/MotorPrecios';
import { AltaVehiculoWizard } from './screens/AltaVehiculo';
import { FichaAuto, PriceSheet, StatusSheet } from './screens/FichaAuto';
import { EnvioInformeSheet, InformeAutosaveOverlay, TransferSheet } from './screens/InformeAutosave';

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
    () => syncStockAndCustomers(INITIAL_STOCK_DATA, INITIAL_CUSTOMERS, INITIAL_RELACIONES),
    [],
  );

  // Core state
  const [stock, setStock] = useState<Car[]>(initialSyncedState.stock);
  const [auctions, setAuctions] = useState<Auction[]>(INITIAL_AUCTIONS);
  const [customers, setCustomers] = useState<Customer[]>(initialSyncedState.customers);
  // Las relaciones cliente-vehículo viven acá, al lado de stock y customers, no
  // adentro de ninguno de los dos.
  const [relaciones, setRelaciones] = useState<RelacionClienteVehiculo[]>(initialSyncedState.relaciones);

  // La app abre en la bandeja del stock: es lo que el mayorista entra a ver
  // todos los días (David, punto 4). Los KPIs pasaron al final de la barra.
  const [activeTab, setActiveTab] = useState<TabKey>('stock');
  const [filtroDias, setFiltroDias] = useState<FiltroDias>(null);
  // Mes que muestran los KPIs. Arranca en el actual.
  const [periodoKpi, setPeriodoKpi] = useState(() => new Date().toISOString().slice(0, 7));

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
  // La bandeja abre en "En venta": son los autos que el mayorista monitorea a
  // diario (David, punto 9). "Restablecer filtros" sí vuelve a Todos, porque
  // esa acción significa "muéstrame todo". Los tabs son los cinco estados del
  // auto más Todos; si David define tabs nuevos en la reunión (punto 10), se
  // agregan a `chips` en screens/Stock.tsx.
  const [filterState, setFilterState] = useState('En venta');
  const [filters, setFilters] = useState<StockFilters>({
    marca: '',
    anio: '',
    precioMax: 20000000,
    estado: '',
    tenencia: '',
  });

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
  const [clienteFiltro, setClienteFiltro] = useState<ClienteFiltro>('Todos');
  const [isNewClientSheetOpen, setIsNewClientSheetOpen] = useState(false);
  const [newClientExtrasOpen, setNewClientExtrasOpen] = useState(false);
  const [newClient, setNewClient] = useState<NewClientData>(emptyNewClient());

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
        const synced = syncStockAndCustomers(saved.stock, saved.customers, saved.relaciones);
        setStock(synced.stock);
        setAuctions(mergeAuctionsWithInitial(saved.auctions));
        setCustomers(synced.customers);
        setRelaciones(synced.relaciones);
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState({ stock, auctions, customers, relaciones });
  }, [hydrated, stock, auctions, customers, relaciones]);

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
      activos.length > 0 ? Math.round(activos.reduce((sum, c) => sum + diasEnStock(c), 0) / activos.length) : 0;
    // El margen se mide contra costoBase, no contra costoAdquisicion: en un auto
    // consignado no hubo compra y restar 0 devolvía el precio completo como utilidad.
    // valorStock, en cambio, sí es costoAdquisicion, porque mide capital propio metido.
    const margenPromedio =
      activos.length > 0
        ? Math.round(activos.reduce((sum, c) => sum + (c.precioVenta - costoBase(c)), 0) / activos.length)
        : 0;
    const costoPromedio =
      activos.length > 0 ? activos.reduce((sum, c) => sum + costoBase(c), 0) / activos.length : 0;
    const margenPct = costoPromedio > 0 ? Math.round((margenPromedio / costoPromedio) * 100) : 0;

    // Autos que llevan demasiado tiempo sin venderse y cuánto capital tienen inmovilizado
    const criticos = activos.filter((c) => diasEnStock(c) > 60);
    const capitalCritico = criticos.reduce((sum, c) => sum + c.costoAdquisicion, 0);
    const pctCapitalCritico = valorStock > 0 ? Math.round((capitalCritico / valorStock) * 100) : 0;

    // Gráfico 1: cuántos autos hay en cada tramo de antigüedad
    const antiguedad = [
      { label: '0–30 d', cantidad: activos.filter((c) => diasEnStock(c) <= 30).length, color: C.teal600 },
      {
        label: '31–60 d',
        cantidad: activos.filter((c) => diasEnStock(c) > 30 && diasEnStock(c) <= 60).length,
        color: C.amber500,
      },
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

  const periodosDisponibles = useMemo(() => periodosConVentas(stock), [stock]);

  /* Los cuatro números del mes que pidió David. Las tarjetas de arriba describen el
     stock que existe ahora, que es una foto; estas describen lo que pasó en un mes,
     que es una película. Se calculan sobre los autos con fechaVenta dentro del
     período, con costoBase para el margen y financiado para la penetración. */
  const kpisMes = useMemo(() => {
    const vendidos = stock.filter((c) => c.fechaVenta && c.fechaVenta.startsWith(periodoKpi));
    const margenTotal = vendidos.reduce((sum, c) => sum + (c.precioVenta - costoBase(c)), 0);
    const financiados = vendidos.filter((c) => c.financiado === true).length;
    const consignados = vendidos.filter((c) => c.tenencia === 'Consignado').length;
    return {
      ventas: vendidos.length,
      margenTotal,
      margenPromedio: vendidos.length > 0 ? Math.round(margenTotal / vendidos.length) : 0,
      penetracionFinanciamiento: vendidos.length > 0 ? Math.round((financiados / vendidos.length) * 100) : 0,
      financiados,
      consignados,
    };
  }, [stock, periodoKpi]);

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
      const matchesTenencia = !filters.tenencia || car.tenencia === filters.tenencia;
      const matchesDias = cumpleFiltroDias(car, filtroDias);
      return (
        matchesSearch &&
        matchesChip &&
        matchesMarca &&
        matchesAnio &&
        matchesPrecio &&
        matchesEstado &&
        matchesTenencia &&
        matchesDias
      );
    });
  }, [stock, searchQuery, filterState, filters, filtroDias]);

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

  // Las relaciones de cada cliente, indexadas una vez para no recorrer la lista entera
  // por cada tarjeta.
  const relacionesPorCliente = useMemo(() => {
    const map = new Map<number, RelacionClienteVehiculo[]>();
    relaciones.forEach((rel) => {
      const previas = map.get(rel.clienteId);
      if (previas) previas.push(rel);
      else map.set(rel.clienteId, [rel]);
    });
    return map;
  }, [relaciones]);

  // Clientes filtrados por el chip activo y el buscador.
  const filteredCustomers = useMemo(() => {
    const q = clienteSearch.trim().toLowerCase();
    return customers.filter((c) => {
      const rels = relacionesPorCliente.get(c.id) || [];
      // Los archivados no salen en los otros chips salvo que se los busque por nombre.
      if (clienteFiltro !== 'Archivados' && c.archivado && !q) return false;
      if (!cumpleFiltroCliente(c, rels, clienteFiltro)) return false;
      if (!q) return true;
      const vehicleLabels = getCustomerVehicleLabels(rels, stockById).join(' ').toLowerCase();
      const busca = `${c.busca?.modelo || ''} ${c.busca?.comentario || ''}`.toLowerCase();
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.telefono.toLowerCase().includes(q) ||
        busca.includes(q) ||
        rolesDeCliente(rels).join(' ').toLowerCase().includes(q) ||
        vehicleLabels.includes(q)
      );
    });
  }, [customers, clienteSearch, clienteFiltro, stockById, relacionesPorCliente]);

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
      fotos: [],
      comentario: `Procedente de ${auction.origen}.`,
      documentos: [],
      clienteAdquisicion: null,
      comprador: null,
      desdeSubastaId: auction.id,
      tenencia: 'Propio', // un auto adjudicado en subasta se compró
      consignante: null,
      precioPisoConsignacion: 0,
      fechaVenta: null,
      financiado: null,
      visitas: [],
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
    const synced = syncStockAndCustomers(nextStock, customers, relaciones);
    const savedAuto = synced.stock.find((c) => c.id === nuevoAuto.id) || nuevoAuto;

    if (isEditing) {
      setStock(synced.stock);
      setCustomers(synced.customers);
      setRelaciones(synced.relaciones);
      setActiveCar(savedAuto);
      showNotification(`Publicación de ${savedAuto.marca} ${savedAuto.modelo} actualizada correctamente.`);
    } else {
      setStock(synced.stock);
      setCustomers(synced.customers);
      setRelaciones(synced.relaciones);
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
            const synced = syncStockAndCustomers(nextStock, customers, relaciones);
            setStock(synced.stock);
            setCustomers(synced.customers);
            setRelaciones(synced.relaciones);
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
    const synced = syncStockAndCustomers(nextStock, customers, relaciones);
    const updatedCar = synced.stock.find((c) => c.id === activeCar.id) || activeCar;
    setStock(synced.stock);
    setCustomers(synced.customers);
    setRelaciones(synced.relaciones);
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
    const synced = syncStockAndCustomers(nextStock, customers, relaciones);
    setStock(synced.stock);
    setCustomers(synced.customers);
    setRelaciones(synced.relaciones);
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
    setNewClient(emptyNewClient());
    setNewClientExtrasOpen(false);
    setIsNewClientSheetOpen(true);
  };

  const handleEditarCliente = (client: Customer) => {
    setNewClient({
      id: client.id,
      nombre: client.nombre,
      telefono: client.telefono,
      tipo: client.tipo,
      estado: client.estado,
      buscaModelo: client.busca?.modelo || '',
      buscaComentario: client.busca?.comentario || '',
    });
    // Al editar se abre desplegado, si no lo cargado queda escondido detrás del toggle.
    setNewClientExtrasOpen(!!client.busca || client.tipo === 'Empresa');
    setIsNewClientSheetOpen(true);
  };

  const handleGuardarCliente = () => {
    // Nombre y teléfono son los dos únicos obligatorios.
    if (!newClient.nombre.trim() || !newClient.telefono.trim()) return;
    if (newClient.id) {
      const existing = customers.find((c) => c.id === newClient.id);
      const updated: Customer = {
        id: newClient.id,
        nombre: newClient.nombre,
        telefono: newClient.telefono,
        tipo: newClient.tipo,
        estado: newClient.estado,
        canal: existing?.canal ?? 'Carga manual',
        busca: busquedaFromForm(newClient),
        archivado: existing?.archivado ?? false,
      };
      const nextCustomers = customers.map((c) => (c.id === updated.id ? updated : c));
      const nextStock = stock.map((car) => updateCarContactForCustomer(car, updated));
      const synced = syncStockAndCustomers(nextStock, nextCustomers, relaciones);
      setStock(synced.stock);
      setCustomers(synced.customers);
      setRelaciones(synced.relaciones);
      setActiveCar((prev) => (prev ? synced.stock.find((car) => car.id === prev.id) || prev : prev));
      setIsNewClientSheetOpen(false);
      setNewClient(emptyNewClient());
      showNotification('Cliente actualizado correctamente.');
      return;
    }
    const client: Customer = {
      id: Math.max(0, ...customers.map((c) => c.id)) + 1,
      nombre: newClient.nombre,
      telefono: newClient.telefono,
      tipo: newClient.tipo,
      estado: newClient.estado || 'Nuevo',
      canal: 'Carga manual',
      busca: busquedaFromForm(newClient),
      archivado: false,
    };
    setCustomers([...customers, client]);
    setIsNewClientSheetOpen(false);
    setNewClient(emptyNewClient());
    showNotification('Cliente registrado con éxito.');
  };

  /* Archivar es reversible desde el chip de Archivados, así que no pide confirmación.
     El tarro de basura se queda para lo que se cargó mal. Nada se archiva solo por
     antigüedad: lo decide el usuario. */
  const handleToggleArchivadoCliente = (client: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === client.id ? { ...c, archivado: !c.archivado } : c)));
    showNotification(
      client.archivado ? `${client.nombre} volvió a la lista.` : `${client.nombre} archivado.`,
    );
  };

  const handleEliminarCliente = (client: Customer) => {
    Alert.alert('Eliminar cliente', `¿Seguro que quieres eliminar a ${client.nombre}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setCustomers((prev) => prev.filter((c) => c.id !== client.id));
          setRelaciones((prev) => prev.filter((r) => r.clienteId !== client.id));
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
          {/* Lo que salió de la barra inferior pero sigue en la app: el Motor de
              Precios (era la pantalla de Inicio) y Subastas, que espera la
              decisión de Autored sobre si sale de la app (punto 46). */}
          <View style={s.headerActions}>
            <TouchableOpacity activeOpacity={0.8} onPress={handleAbrirMotor} style={s.headerIconBtn}>
              <Icon name="gauge-high" size={16} color={C.slate600} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('subastas')}
              style={s.headerIconBtn}
            >
              <View>
                <Icon name="gavel" size={16} color={activeTab === 'subastas' ? C.chileanTeal : C.slate600} />
                {adjudicadasCount > 0 ? (
                  <View style={s.navBadge}>
                    <Text style={s.navBadgeText}>{adjudicadasCount}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          </View>
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
          {activeTab === 'stock' && (
            <StockScreen
              stock={stock}
              filteredStock={filteredStock}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterState={filterState}
              setFilterState={setFilterState}
              filtroDias={filtroDias}
              setFiltroDias={setFiltroDias}
              setFilters={setFilters}
              activeStockAuctionMap={activeStockAuctionMap}
              setActiveCar={setActiveCar}
              setIsFilterSheetOpen={setIsFilterSheetOpen}
              handleEliminarAuto={handleEliminarAuto}
            />
          )}
          {activeTab === 'subastas' && (
            <SubastasScreen
              auctions={auctions}
              nowTs={nowTs}
              subastaTab={subastaTab}
              setSubastaTab={setSubastaTab}
              stockById={stockById}
              setActiveCar={setActiveCar}
              setActiveAuction={setActiveAuction}
              setBidAmount={setBidAmount}
              setIsAuctionBidSheetOpen={setIsAuctionBidSheetOpen}
              handleAbrirPublicarSubasta={handleAbrirPublicarSubasta}
              handleAbrirCaracteristicasSubasta={handleAbrirCaracteristicasSubasta}
              handleCancelarSubastaPropia={handleCancelarSubastaPropia}
              handleAgregarDesdeSubasta={handleAgregarDesdeSubasta}
            />
          )}
          {activeTab === 'clientes' && (
            <ClientesScreen
              customers={customers}
              filteredCustomers={filteredCustomers}
              relacionesPorCliente={relacionesPorCliente}
              clienteSearch={clienteSearch}
              setClienteSearch={setClienteSearch}
              clienteFiltro={clienteFiltro}
              setClienteFiltro={setClienteFiltro}
              stockById={stockById}
              setActiveCar={setActiveCar}
              handleAbrirNuevoCliente={handleAbrirNuevoCliente}
              handleEditarCliente={handleEditarCliente}
              handleToggleArchivadoCliente={handleToggleArchivadoCliente}
              handleEliminarCliente={handleEliminarCliente}
              handleLlamar={handleLlamar}
              handleWhatsapp={handleWhatsapp}
              handleUpdateClienteEstado={handleUpdateClienteEstado}
            />
          )}
          {activeTab === 'kpis' && (
            <KpisScreen
              kpis={kpis}
              kpisMes={kpisMes}
              periodoKpi={periodoKpi}
              setPeriodoKpi={setPeriodoKpi}
              periodosDisponibles={periodosDisponibles}
              setFilterState={setFilterState}
              setFiltroDias={setFiltroDias}
              setActiveTab={setActiveTab}
            />
          )}
        </ScrollView>

        {/* NAV INFERIOR */}
        <View
          style={[
            s.nav,
            { paddingBottom: insets.bottom || 8, paddingLeft: 8 + insets.left, paddingRight: 8 + insets.right },
          ]}
        >
          {/* El orden de David (punto 44): Stock, Clientes y al final los KPIs.
              Cuando Autored decida si la transferencia digital entra al alcance
              (punto 48), Transferencias se suma entre Clientes y KPIs. */}
          <NavButton icon="warehouse" label="Stock" active={activeTab === 'stock'} onPress={() => setActiveTab('stock')} />
          <NavButton icon="user-group" label="Clientes" active={activeTab === 'clientes'} onPress={() => setActiveTab('clientes')} />

          {/* Botón + flotante */}
          <View style={s.fabWrap}>
            <TouchableOpacity activeOpacity={0.85} onPress={handleAbrirCargaManual} style={s.fab}>
              <Icon name="plus" size={20} color={C.white} />
            </TouchableOpacity>
          </View>

          <NavButton icon="chart-simple" label="KPIs" active={activeTab === 'kpis'} onPress={() => setActiveTab('kpis')} />
        </View>

        {/* OVERLAYS Y SHEETS (dentro del frame, apilados como en el HTML base) */}
        <FichaAuto
          activeCar={activeCar}
          setActiveCar={setActiveCar}
          activeStockAuctionMap={activeStockAuctionMap}
          activeInforme={activeInforme}
          activeBloqueos={activeBloqueos}
          setInspectingCar={setInspectingCar}
          setIsAutosaveReportOpen={setIsAutosaveReportOpen}
          handleAbrirEnvioInforme={handleAbrirEnvioInforme}
          handleAbrirTransferencia={handleAbrirTransferencia}
          handleAvanzarTransferencia={handleAvanzarTransferencia}
          handleCompartirTransferencia={handleCompartirTransferencia}
          handleLlamar={handleLlamar}
          handleWhatsapp={handleWhatsapp}
          setAdjustedPrice={setAdjustedPrice}
          setIsPriceSheetOpen={setIsPriceSheetOpen}
          setSelectedStatus={setSelectedStatus}
          setStatusNote={setStatusNote}
          setStatusBuyer={setStatusBuyer}
          setIsStatusSheetOpen={setIsStatusSheetOpen}
          handleEditarAuto={handleEditarAuto}
          handleEliminarAuto={handleEliminarAuto}
        />
        {/* PageOverlay no usa zIndex: se pinta por orden, así el informe queda sobre la ficha */}
        <InformeAutosaveOverlay
          activeCar={activeCar}
          activeInforme={activeInforme}
          activeBloqueos={activeBloqueos}
          isAutosaveReportOpen={isAutosaveReportOpen}
          setIsAutosaveReportOpen={setIsAutosaveReportOpen}
          handleAbrirEnvioInforme={handleAbrirEnvioInforme}
          handleAbrirTransferencia={handleAbrirTransferencia}
        />
        <MotorPreciosOverlay
          isMotorOpen={isMotorOpen}
          setIsMotorOpen={setIsMotorOpen}
          motorPatente={motorPatente}
          setMotorPatente={setMotorPatente}
          motorKm={motorKm}
          setMotorKm={setMotorKm}
          motorCalculando={motorCalculando}
          tasacion={tasacion}
          setTasacion={setTasacion}
          handleTasar={handleTasar}
          handleTomarAuto={handleTomarAuto}
        />
        {inspectingCar && (
          <InspectionScreen
            car={inspectingCar}
            existingReport={inspectingCar.inspeccion ?? null}
            onClose={() => setInspectingCar(null)}
            onSave={handleGuardarInspeccion}
            notify={showNotification}
          />
        )}
        <AltaVehiculoWizard
          isCargarAutoOpen={isCargarAutoOpen}
          setIsCargarAutoOpen={setIsCargarAutoOpen}
          cargarStep={cargarStep}
          setCargarStep={setCargarStep}
          wizardData={wizardData}
          setWizardData={setWizardData}
          showNotification={showNotification}
          handleGuardarAutoWizard={handleGuardarAutoWizard}
          handleCapturarFoto={handleCapturarFoto}
          handleGaleria={handleGaleria}
          handleQuitarFoto={handleQuitarFoto}
          toggleEquipamiento={toggleEquipamiento}
        />
        <FilterSheet
          isFilterSheetOpen={isFilterSheetOpen}
          setIsFilterSheetOpen={setIsFilterSheetOpen}
          filters={filters}
          setFilters={setFilters}
          marcasDisponibles={marcasDisponibles}
        />
        <PriceSheet
          activeCar={activeCar}
          isPriceSheetOpen={isPriceSheetOpen}
          setIsPriceSheetOpen={setIsPriceSheetOpen}
          adjustedPrice={adjustedPrice}
          setAdjustedPrice={setAdjustedPrice}
          handleGuardarPrecio={handleGuardarPrecio}
        />
        <StatusSheet
          activeCar={activeCar}
          isStatusSheetOpen={isStatusSheetOpen}
          setIsStatusSheetOpen={setIsStatusSheetOpen}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          statusNote={statusNote}
          setStatusNote={setStatusNote}
          statusBuyer={statusBuyer}
          setStatusBuyer={setStatusBuyer}
          handleGuardarEstado={handleGuardarEstado}
        />
        <AuctionBidSheet
          activeAuction={activeAuction}
          nowTs={nowTs}
          isAuctionBidSheetOpen={isAuctionBidSheetOpen}
          setIsAuctionBidSheetOpen={setIsAuctionBidSheetOpen}
          bidAmount={bidAmount}
          setBidAmount={setBidAmount}
          handleEnviarOfertaSubasta={handleEnviarOfertaSubasta}
        />
        <AuctionPublishSheet
          isAuctionPublishSheetOpen={isAuctionPublishSheetOpen}
          setIsAuctionPublishSheetOpen={setIsAuctionPublishSheetOpen}
          publishStockId={publishStockId}
          setPublishStockId={setPublishStockId}
          stockAuctionOptions={stockAuctionOptions}
          sellerNote={sellerNote}
          setSellerNote={setSellerNote}
          handlePublicarSubastaStock={handlePublicarSubastaStock}
        />
        <AuctionFeaturesSheet
          activeAuction={activeAuction}
          isAuctionFeaturesSheetOpen={isAuctionFeaturesSheetOpen}
          setIsAuctionFeaturesSheetOpen={setIsAuctionFeaturesSheetOpen}
          nowTs={nowTs}
          setActiveAuction={setActiveAuction}
          setBidAmount={setBidAmount}
          setIsAuctionBidSheetOpen={setIsAuctionBidSheetOpen}
        />
        <NewClientSheet
          isNewClientSheetOpen={isNewClientSheetOpen}
          setIsNewClientSheetOpen={setIsNewClientSheetOpen}
          newClient={newClient}
          setNewClient={setNewClient}
          newClientExtrasOpen={newClientExtrasOpen}
          setNewClientExtrasOpen={setNewClientExtrasOpen}
          handleGuardarCliente={handleGuardarCliente}
        />
        <EnvioInformeSheet
          activeCar={activeCar}
          activeInforme={activeInforme}
          isEnvioInformeSheetOpen={isEnvioInformeSheetOpen}
          setIsEnvioInformeSheetOpen={setIsEnvioInformeSheetOpen}
          envioDestinatario={envioDestinatario}
          envioContacto={envioContacto}
          setEnvioContacto={setEnvioContacto}
          handleCambiarDestinatario={handleCambiarDestinatario}
          handleEnviarInforme={handleEnviarInforme}
        />
        <TransferSheet
          activeCar={activeCar}
          activeInforme={activeInforme}
          activeBloqueos={activeBloqueos}
          isTransferSheetOpen={isTransferSheetOpen}
          setIsTransferSheetOpen={setIsTransferSheetOpen}
          transferOrigen={transferOrigen}
          setTransferOrigen={setTransferOrigen}
          transferModalidad={transferModalidad}
          transferNotaria={transferNotaria}
          setTransferNotaria={setTransferNotaria}
          transferPagador={transferPagador}
          setTransferPagador={setTransferPagador}
          transferProcesando={transferProcesando}
          handleCambiarModalidad={handleCambiarModalidad}
          handleGenerarTransferencia={handleGenerarTransferencia}
          showNotification={showNotification}
        />

        {/* NOTIFICACIÓN (siempre encima de todo) */}
        {notification && (
          <NotificationBanner message={notification.message} type={notification.type} top={insets.top + 8} />
        )}
      </View>
    </View>
  );
}
