import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Keyboard,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
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
  VehicleContact,
  VehicleDocument,
  INITIAL_STOCK_DATA,
  INITIAL_AUCTIONS,
  INITIAL_CUSTOMERS,
  INITIAL_RELACIONES,
  INITIAL_INFORMES,
  INITIAL_TRANSFERENCIAS,
  ESTADOS,
  costoBase,
  tenenciaSegunEstado,
  diasEnStock,
} from './src/data';
import { Icon } from './src/ui';
import { s } from './src/styles';
import { loadState, saveState } from './src/storage';
import {
  TasacionAutored,
  buscarFichaPatente,
  buscarPatente,
  leerPatenteEnFoto,
  normalizarPatente,
  tasarAutored,
} from './src/pricing';
import {
  PRECIO_COPIA_INFORME,
  generarInformeAutosave,
  textoWhatsappInforme,
} from './src/autosave';
import {
  InformeComprado,
  TipoInforme,
  autoParaPatente,
  estaEnStock,
} from './src/informes';
import {
  EstadoTransferencia,
  SolicitudTransferencia,
  TipoTransferencia,
} from './src/transferencias';
/* La Inspección con IA salió de la app el 1-09 (ronda 3, punto 3). David:
   "yo sacaría el de inspección y agregamos esto otro". El módulo sigue en
   `src/inspection/` sin enchufar; el argumento fue de alcance, no de que
   estuviera mal. Ver src/inspection/README.md. */
import {
  AUCTION_DURATION_MS,
  ClienteFiltro,
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
  emptyStockFilters,
  busquedaFromForm,
  getAuctionMsLeft,
  getCustomerVehicleLabels,
  hasContactData,
  isAuctionFinal,
  leadsDeVehiculo,
  makeBusquedaPatente,
  makeEmptyWizard,
  makeLecturaPatente,
  mergeAuctionsWithInitial,
  OrdenStock,
  periodosConVentas,
  requiresBuyer,
  syncStockAndCustomers,
  todayIsoDate,
  updateCarContactForCustomer,
} from './src/helpers';
import { NOTIF_MS, NavButton, NotificationBanner } from './components/shared';
import { KpisScreen } from './screens/Kpis';
import { InformesScreen } from './screens/Informes';
import { NuevaSolicitudOverlay, TransferenciasScreen } from './screens/Transferencias';
import { FilterSheet, StockScreen } from './screens/Stock';
import {
  AuctionBidSheet,
  AuctionFeaturesSheet,
  AuctionPublishSheet,
  SubastasScreen,
} from './screens/Subastas';
import { ClientesScreen, NewClientSheet } from './screens/Clientes';
import { MotorPreciosScreen } from './screens/MotorPrecios';
import { AltaVehiculoWizard } from './screens/AltaVehiculo';
import { FichaAuto, PriceSheet, StatusSheet } from './screens/FichaAuto';
import { EnvioInformeSheet, InformeAutosaveOverlay } from './screens/InformeAutosave';

const STOCK_FAB_SIZE = 60;
const STOCK_FAB_GAP = 18;
const STOCK_FAB_SIDE_OFFSET = 20;
const STOCK_SCROLL_BOTTOM_PADDING = STOCK_FAB_SIZE + STOCK_FAB_GAP + 40;

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
  // Historial de informes de la sección nueva (ronda 3, punto 4)
  const [informes, setInformes] = useState<InformeComprado[]>(INITIAL_INFORMES);
  const [informePatente, setInformePatente] = useState('');
  const [informeTipo, setInformeTipo] = useState<TipoInforme>('Autored Completo');
  const [informeBusqueda, setInformeBusqueda] = useState('');
  /* El informe que se está mirando desde la sección. Es aparte de `activeCar`
     porque acá la patente puede no ser de ningún auto del patio. */
  const [informeAbierto, setInformeAbierto] = useState<{ car: Car; tipo: TipoInforme } | null>(null);
  // Solicitudes de transferencia de la sección nueva (ronda 3, punto 5)
  const [transferencias, setTransferencias] = useState<SolicitudTransferencia[]>(INITIAL_TRANSFERENCIAS);
  const [trPatente, setTrPatente] = useState('');
  const [trEstado, setTrEstado] = useState<EstadoTransferencia | 'Todos'>('Todos');
  const [isNuevaSolicitudOpen, setIsNuevaSolicitudOpen] = useState(false);
  const [trTipoElegido, setTrTipoElegido] = useState<TipoTransferencia | null>(null);

  // La app abre en la bandeja del stock: es lo que el mayorista entra a ver
  // todos los días (David, punto 4). Los KPIs pasaron al final de la barra.
  const [activeTab, setActiveTab] = useState<TabKey>('stock');
  // Mes que muestran los KPIs. Arranca en el actual.
  const [periodoKpi, setPeriodoKpi] = useState(() => new Date().toISOString().slice(0, 7));

  // Modales / sheets
  const [activeCar, setActiveCar] = useState<Car | null>(null);
  /* Modo cliente (punto 24): oculta el costo y el margen mientras el mayorista
     muestra el auto desde su teléfono. Es LA bandera compartida (cruce 4): si
     otra pantalla llega a mostrar precios delante del cliente, usa esta misma.
     No se persiste: al reabrir la app se vuelve al modo de gestión. */
  const [modoCliente, setModoCliente] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isPriceSheetOpen, setIsPriceSheetOpen] = useState(false);
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);
  /* El sheet de estado se abre desde dos lados: la ficha del auto y el botón
     "Agregar al Stock" de la bandeja de pre-stock. Por eso trabaja sobre su
     propio auto y no sobre activeCar, que en la bandeja no existe. */
  const [statusCar, setStatusCar] = useState<Car | null>(null);
  const [statusConsignante, setStatusConsignante] = useState<VehicleContact>(emptyContact());
  const [statusPiso, setStatusPiso] = useState('');
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
  const [filters, setFilters] = useState<StockFilters>(emptyStockFilters());
  const [ordenStock, setOrdenStock] = useState<OrdenStock>('ingreso');

  // Ajuste de precio
  const [adjustedPrice, setAdjustedPrice] = useState(0);

  // Cambio de estado
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState('');
  const [statusBuyer, setStatusBuyer] = useState<VehicleContact>(emptyContact());
  // Si la venta fue financiada: alimenta la penetración de financiamiento de
  // los KPIs del mes (el dato que P2 necesita desde esta ficha).
  const [statusFinanciado, setStatusFinanciado] = useState(false);

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

  // AutoSafe: informe (derivado, no se persiste) y transferencia notarial
  const [isAutosaveReportOpen, setIsAutosaveReportOpen] = useState(false);
  const [isEnvioInformeSheetOpen, setIsEnvioInformeSheetOpen] = useState(false);
  const [envioDestinatario, setEnvioDestinatario] = useState<EnvioInforme['destinatario']>('Comprador');
  const [envioContacto, setEnvioContacto] = useState<VehicleContact>(emptyContact());
  const [bottomNavHeight, setBottomNavHeight] = useState(0);

  // Motor de precios (tasación rápida, datos simulados)
  const [motorPatente, setMotorPatente] = useState('');
  const [motorKm, setMotorKm] = useState('');
  const [motorCalculando, setMotorCalculando] = useState(false);
  const [tasacion, setTasacion] = useState<TasacionAutored | null>(null);

  // Wizard cargar auto
  const [isCargarAutoOpen, setIsCargarAutoOpen] = useState(false);
  const [cargarStep, setCargarStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>(makeEmptyWizard());
  const [busquedaPatente, setBusquedaPatente] = useState(makeBusquedaPatente());
  const [lecturaPatente, setLecturaPatente] = useState(makeLecturaPatente());
  const [documentDraft, setDocumentDraft] = useState<Omit<VehicleDocument, 'id'>>({
    tipo: '',
    nombre: '',
    fechaVencimiento: '',
    archivoNombre: '',
  });

  // Notificación
  const [notification, setNotification] = useState<{ id: number; message: string; type: string } | null>(null);
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
        // Vacía significa "guardado antes de que existiera": se siembra el
        // historial de fábrica en vez de dejar la sección en blanco.
        setInformes(saved.informes.length ? saved.informes : INITIAL_INFORMES);
        setTransferencias(saved.transferencias.length ? saved.transferencias : INITIAL_TRANSFERENCIAS);
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState({ stock, auctions, customers, relaciones, informes, transferencias });
  }, [hydrated, stock, auctions, customers, relaciones, informes, transferencias]);

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
      if (isCargarAutoOpen) { setIsCargarAutoOpen(false); return true; }
      if (isNuevaSolicitudOpen) { setIsNuevaSolicitudOpen(false); return true; }
      // El informe se apila sobre la ficha: hay que cerrarlo antes que ella.
      if (isAutosaveReportOpen) { setIsAutosaveReportOpen(false); return true; }
      // El de la sección de Informes no tiene ficha debajo, pero sí es una pantalla.
      if (informeAbierto) { setInformeAbierto(null); return true; }
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
    isCargarAutoOpen,
    isNuevaSolicitudOpen,
    isAutosaveReportOpen,
    informeAbierto,
    activeCar,
  ]);

  const showNotification = (message: string, type = 'success') => {
    setNotification({ id: Date.now(), message, type });
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    notifTimeout.current = setTimeout(() => setNotification(null), NOTIF_MS);
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
    // Año y precio como rangos desde-hasta (puntos 18 y 19). Vacío = sin
    // límite, así ningún filtro esconde autos si el usuario no lo pidió.
    const anioDesde = parseInt(filters.anioDesde, 10) || 0;
    const anioHasta = parseInt(filters.anioHasta, 10) || 0;
    const precioDesde = parseInt(filters.precioDesde, 10) || 0;
    const precioHasta = parseInt(filters.precioHasta, 10) || 0;
    const filtrados = stock.filter((car) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        car.marca.toLowerCase().includes(query) ||
        car.modelo.toLowerCase().includes(query) ||
        car.patente.toLowerCase().includes(query);
      const matchesChip = filterState === 'Todos' || car.estado === filterState;
      const matchesMarca = !filters.marca || car.marca === filters.marca;
      const matchesModelo = !filters.modelo || car.modelo === filters.modelo;
      const matchesAnio = (!anioDesde || car.anio >= anioDesde) && (!anioHasta || car.anio <= anioHasta);
      const matchesPrecio =
        (!precioDesde || car.precioVenta >= precioDesde) && (!precioHasta || car.precioVenta <= precioHasta);
      const matchesSucursal = !filters.sucursal || car.sucursal === filters.sucursal;
      const matchesTenencia = !filters.tenencia || car.tenencia === filters.tenencia;
      const matchesDias = cumpleFiltroDias(car, filters.dias);
      return (
        matchesSearch &&
        matchesChip &&
        matchesMarca &&
        matchesModelo &&
        matchesAnio &&
        matchesPrecio &&
        matchesSucursal &&
        matchesTenencia &&
        matchesDias
      );
    });

    // El orden lo elige el usuario (punto 22). 'ingreso' conserva el orden de
    // carga, que ya deja lo más nuevo arriba.
    switch (ordenStock) {
      case 'dias':
        return [...filtrados].sort((a, b) => diasEnStock(b) - diasEnStock(a));
      case 'leads':
        return [...filtrados].sort(
          (a, b) => leadsDeVehiculo(relaciones, b.id) - leadsDeVehiculo(relaciones, a.id),
        );
      case 'precio-asc':
        return [...filtrados].sort((a, b) => a.precioVenta - b.precioVenta);
      case 'precio-desc':
        return [...filtrados].sort((a, b) => b.precioVenta - a.precioVenta);
      default:
        return filtrados;
    }
  }, [stock, searchQuery, filterState, filters, ordenStock, relaciones]);

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

  // El informe AutoSafe no es estado: se deriva del auto y siempre da lo mismo para la
  // misma patente. La automotora tiene acceso libre; lo que se cobra es la copia al cliente.
  const activeInforme = useMemo(() => (activeCar ? generarInformeAutosave(activeCar) : null), [activeCar]);
  /* El de la sección de Informes: mismo generador, otro auto. Si la patente está en
     el stock, `autoParaPatente` devuelve ESE auto, así que el informe es idéntico al
     que muestra su ficha y la demo no se contradice sola. */
  const informeDeLaSeccion = useMemo(
    () => (informeAbierto ? generarInformeAutosave(informeAbierto.car) : null),
    [informeAbierto],
  );

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
      const notas = c.notas.toLowerCase();
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.telefono.toLowerCase().includes(q) ||
        notas.includes(q) ||
        busca.includes(q) ||
        vehicleLabels.includes(q)
      );
    });
  }, [customers, clienteSearch, clienteFiltro, stockById, relacionesPorCliente]);

  /* ------------------- Motor de precios ------------------- */
  /* El Motor es una pestaña desde la ronda 3 (punto 1): tocarlo en la barra limpia lo
     de la consulta anterior y lleva a su pantalla, no abre una ventana encima. */
  const handleAbrirMotor = () => {
    setMotorPatente('');
    setMotorKm('');
    setTasacion(null);
    setMotorCalculando(false);
    setActiveTab('motor');
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
      setTasacion(tasarAutored(vehiculo, km, motorPatente));
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
      // El motor de Autored no da rango de oferta: lo que propone pagar es el precio
      // de toma, que es justamente el dato exclusivo de ellos.
      costoAdquisicion: tasacion.precioToma,
      comentario: `Tasado con el Motor de Precios. Precio de toma ${fmtCLP(tasacion.precioToma)}, rango ${fmtCLP(tasacion.rangoToma.min)} – ${fmtCLP(tasacion.rangoToma.max)}.`,
    });
    setBusquedaPatente(makeBusquedaPatente());
    setLecturaPatente(makeLecturaPatente());
    setCargarStep(1);
    setIsCargarAutoOpen(true);
  };

  /* ------------------- Handlers wizard ------------------- */
  const handleAbrirCargaManual = () => {
    setWizardData(makeEmptyWizard());
    setBusquedaPatente(makeBusquedaPatente());
    setLecturaPatente(makeLecturaPatente());
    setDocumentDraft({ tipo: '', nombre: '', fechaVencimiento: '', archivoNombre: '' });
    setCargarStep(1);
    setIsCargarAutoOpen(true);
  };

  /* Consulta de patente del paso 1. Sin backend: la ficha sale del registro
     ficticio de pricing.ts y la espera es para que se vea que fue a buscarla. */
  const handleBuscarPatente = () => {
    const patente = normalizarPatente(wizardData.patente);
    if (patente.length < 5) {
      showNotification('Escribe la patente completa (ej: KDPT45).', 'warning');
      return;
    }
    setBusquedaPatente({ estado: 'buscando', patente, ficha: null });
    setTimeout(() => {
      const ficha = buscarFichaPatente(patente);
      setBusquedaPatente({ estado: ficha ? 'ok' : 'sin_registro', patente, ficha });
    }, 900);
  };

  /* Pasa la ficha encontrada al formulario y deja al vendedor en el paso 2 para
     que la revise. Se respeta lo que ya haya cargado (las fotos, sobre todo). */
  const handleTomarFichaPatente = () => {
    const ficha = busquedaPatente.ficha;
    if (busquedaPatente.estado !== 'ok' || !ficha) return;
    setWizardData((prev) => ({
      ...prev,
      patente: busquedaPatente.patente,
      vin: ficha.vin,
      tipoVehiculo: ficha.tipoVehiculo,
      marca: ficha.marca,
      modelo: ficha.modelo,
      version: ficha.version,
      anio: ficha.anio,
      anioFabricacion: ficha.anioFabricacion,
      color: ficha.color,
      transmision: ficha.transmision,
      combustible: ficha.combustible,
      traccion: ficha.traccion,
      puertas: ficha.puertas,
      cilindrada: ficha.cilindrada,
      // El km del permiso es de la última renovación: sirve de punto de partida,
      // pero no pisa el que el vendedor haya escrito mirando el tablero.
      km: prev.km || ficha.kmPermiso,
    }));
    setCargarStep(2);
    showNotification(`Datos de ${ficha.marca} ${ficha.modelo} cargados. Revísalos antes de seguir.`);
  };

  /* Lector de patente de la foto. Corre solo mientras el auto no tenga patente:
     una vez que está, no hay nada que leer y releer sería pisarla. */
  const leerPatenteDeFoto = (foto: string) => {
    if (wizardData.id !== null) return;
    if (normalizarPatente(wizardData.patente).length >= 5) return;
    setLecturaPatente({ estado: 'leyendo', patente: '', foto });
    setTimeout(() => {
      const patente = leerPatenteEnFoto(foto);
      setLecturaPatente({
        estado: patente ? 'propuesta' : 'sin_lectura',
        patente: patente || '',
        foto,
      });
    }, 1200);
  };

  // La patente leída entra al formulario solo cuando el vendedor dice que sí
  const handleConfirmarLectura = () => {
    if (lecturaPatente.estado !== 'propuesta') return;
    setWizardData((prev) => ({ ...prev, patente: lecturaPatente.patente }));
    setBusquedaPatente(makeBusquedaPatente());
    setLecturaPatente(makeLecturaPatente());
  };

  const handleDescartarLectura = () => setLecturaPatente(makeLecturaPatente());

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
    });
    setDocumentDraft({ tipo: '', nombre: '', fechaVencimiento: '', archivoNombre: '' });
    setBusquedaPatente(makeBusquedaPatente());
    setLecturaPatente(makeLecturaPatente());
    setCargarStep(1);
    setIsCargarAutoOpen(true);
  };

  const handleGuardarAutoWizard = () => {
    const isEditing = stock.some((c) => c.id === wizardData.id);
    if (requiresBuyer(wizardData.estado) && !hasContactData(wizardData.comprador)) {
      showNotification('Registra el comprador antes de dejar el auto reservado o vendido.', 'warning');
      return;
    }
    if (wizardData.estado === 'Consignado' && !hasContactData(wizardData.consignante)) {
      showNotification('Registra al dueño del auto para dejarlo en consignación.', 'warning');
      return;
    }
    const nuevoAuto: Car = {
      ...wizardData,
      id: wizardData.id || Math.max(0, ...stock.map((c) => c.id)) + 1,
      patente: wizardData.patente.toUpperCase(),
      tenencia: tenenciaSegunEstado(wizardData.estado, wizardData.tenencia),
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
    setBusquedaPatente(makeBusquedaPatente());
    setLecturaPatente(makeLecturaPatente());
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
    const title = 'Eliminar auto del stock';
    const message = `¿Estás seguro de que quieres eliminar el ${car.marca} ${car.modelo} (${car.patente}) del stock? Esta acción no se puede deshacer.`;
    const eliminarAuto = () => {
      const nextStock = stock.filter((c) => c.id !== car.id);
      const synced = syncStockAndCustomers(nextStock, customers, relaciones);
      setStock(synced.stock);
      setCustomers(synced.customers);
      setRelaciones(synced.relaciones);
      setActiveCar((prev) => (prev && prev.id === car.id ? null : prev));
      showNotification(`${car.marca} ${car.modelo} eliminado del stock.`);
    };

    if (Platform.OS === 'web') {
      const webConfirm = (globalThis as typeof globalThis & { confirm?: (message?: string) => boolean }).confirm;
      if (webConfirm ? webConfirm(`${title}\n\n${message}`) : true) {
        eliminarAuto();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: eliminarAuto },
    ]);
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

  /* Abre el selector de estado para un auto. `estadoInicial` lo usa la bandeja
     de pre-stock: llega con "En preparación" propuesto, que es donde cae un auto
     que recién entra, pero el vendedor puede elegir otro. */
  const handleAbrirEstado = (car: Car, estadoInicial?: EstadoAuto) => {
    setStatusCar(car);
    setSelectedStatus(estadoInicial || car.estado);
    setStatusNote('');
    setStatusBuyer(car.comprador || emptyContact());
    setStatusConsignante(car.consignante || emptyContact());
    setStatusPiso(car.precioPisoConsignacion ? String(car.precioPisoConsignacion) : '');
    setStatusFinanciado(car.financiado ?? false);
    setIsStatusSheetOpen(true);
  };

  const handleAgregarAStock = (car: Car) => handleAbrirEstado(car, 'En preparación');

  const handleGuardarEstado = () => {
    const car = statusCar || activeCar;
    if (!car) return;
    const nextStatus = selectedStatus as EstadoAuto;
    if (requiresBuyer(nextStatus) && !hasContactData(statusBuyer)) {
      showNotification('Registra el comprador para reservar o vender este auto.', 'warning');
      return;
    }
    if (nextStatus === 'Consignado' && !hasContactData(statusConsignante)) {
      showNotification('Registra al dueño del auto para dejarlo en consignación.', 'warning');
      return;
    }
    const nextStock = stock.map((c) => {
      if (c.id !== car.id) return c;
      return {
        ...c,
        estado: nextStatus,
        // Marcar Consignado enciende la tenencia; pasar a En venta no la apaga
        tenencia: tenenciaSegunEstado(nextStatus, c.tenencia),
        consignante: nextStatus === 'Consignado' ? cleanVehicleContact(statusConsignante) : c.consignante,
        precioPisoConsignacion:
          nextStatus === 'Consignado' ? Number(statusPiso) || 0 : c.precioPisoConsignacion,
        comprador: requiresBuyer(nextStatus) ? cleanVehicleContact(statusBuyer) : c.comprador,
        comentario: statusNote || c.comentario,
        // Sin fechaVenta la venta no existe para los KPIs del mes (nota de
        // CONTEXTO-P1). Se conserva la fecha si el auto ya estaba vendido, y
        // ambos campos se limpian si el estado deja de ser Vendido.
        fechaVenta: nextStatus === 'Vendido' ? c.fechaVenta || todayIsoDate() : null,
        financiado: nextStatus === 'Vendido' ? statusFinanciado : null,
      };
    });
    const synced = syncStockAndCustomers(nextStock, customers, relaciones);
    const updatedCar = synced.stock.find((c) => c.id === car.id) || car;
    setStock(synced.stock);
    setCustomers(synced.customers);
    setRelaciones(synced.relaciones);
    // La ficha solo se refresca si es este mismo auto el que está abierto
    setActiveCar((prev) => (prev && prev.id === car.id ? updatedCar : prev));
    setStatusCar(null);
    setIsStatusSheetOpen(false);
    showNotification(`Estado cambiado a "${selectedStatus}"`);

    /* Antes, marcar Vendido abría solo el sheet de transferencia notarial. Salió
       con el punto 7 de la ronda 3: el flujo ahora corta al elegir el tipo, así
       que no hay formulario que prellenar. El vendedor entra a Transferencias
       cuando quiere, desde la barra o desde el acceso directo de la ficha. */
  };

  /* ------------------- AutoSafe ------------------- */
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

  /* Acá vivían handleAbrirTransferencia, handleCambiarModalidad,
     handleGenerarTransferencia, handleAvanzarTransferencia y
     handleCompartirTransferencia: el trámite notarial simulado que se generaba
     desde la ficha. Salieron el 1-09 (ronda 3, punto 7), junto con el estado del
     sheet. El TransferSheet sigue en screens/InformeAutosave.tsx sin enchufar.
     Ver el README de src/inspection/ para el mismo criterio. */

  /* ------------------- Informes (ronda 3, punto 4) ------------------- */
  /* Sacar el informe no le cuesta nada al compraventero: la regla ya estaba en el
     código —la automotora tiene acceso libre, lo que se cobra es la copia al
     cliente— y la sección la respeta. Si la patente ya está en el historial no se
     duplica la fila: se actualiza la fecha, que es lo que hace un sistema real. */
  const handleSacarInforme = () => {
    const car = autoParaPatente(informePatente, stock);
    if (!car) {
      showNotification('Escribe una patente completa, por ejemplo KDPT45.', 'warning');
      return;
    }
    /* Normalizada, sin guiones: los autos del patio la guardan como "PL-GR-88" y
       una patente ajena llega como "PLGR88". Si no se empareja acá, el historial
       muestra dos formatos y la misma patente puede entrar dos veces. */
    const patente = normalizarPatente(car.patente);
    const hoy = todayIsoDate();
    setInformes((prev) => {
      const yaEsta = prev.find((i) => i.patente === patente && i.tipo === informeTipo);
      if (yaEsta) {
        return [{ ...yaEsta, fecha: hoy }, ...prev.filter((i) => i.id !== yaEsta.id)];
      }
      const nuevoId = prev.reduce((max, i) => Math.max(max, i.id), 0) + 1;
      return [{ id: nuevoId, patente, tipo: informeTipo, fecha: hoy }, ...prev];
    });
    setInformeAbierto({ car, tipo: informeTipo });
    setInformePatente('');
  };

  const handleVerInforme = (informe: InformeComprado) => {
    const car = autoParaPatente(informe.patente, stock);
    if (!car) return;
    setInformeAbierto({ car, tipo: informe.tipo });
  };

  /* ------------------- Transferencias (ronda 3, punto 5) ------------------- */
  const handleAbrirNuevaSolicitud = () => {
    setTrTipoElegido(null);
    setIsNuevaSolicitudOpen(true);
  };

  // El acceso directo del punto 7: cierra la ficha y abre el módulo nuevo.
  const handleIrATransferencias = () => {
    setIsAutosaveReportOpen(false);
    setInformeAbierto(null);
    setActiveCar(null);
    setActiveTab('transferencias');
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
      notas: client.notas,
      buscaMarca: client.busca?.marca || '',
      buscaModelo: client.busca?.modelo || '',
      buscaPrecioMin: client.busca?.precioMin ? String(client.busca.precioMin) : '',
      buscaPrecioMax: client.busca?.precioMax ? String(client.busca.precioMax) : '',
      buscaComentario: client.busca?.comentario || '',
      buscaVehiculoId: client.busca?.vehiculoId ?? null,
    });
    // Al editar se abre desplegado, si no lo cargado queda escondido detrás del toggle.
    setNewClientExtrasOpen(!!client.busca || client.tipo === 'Empresa');
    setIsNewClientSheetOpen(true);
  };

  /* El auto que el cliente eligió del stock queda como una relación de
     oportunidad, que es lo que hace que ese auto cuente un lead en la bandeja.
     Solo se toca la del auto anterior de este mismo cliente: las oportunidades
     que vengan de otro lado no se pisan. */
  const sincronizarOportunidad = (
    rels: RelacionClienteVehiculo[],
    clienteId: number,
    anterior: number | null,
    nuevo: number | null,
  ): RelacionClienteVehiculo[] => {
    let out = rels;
    if (anterior && anterior !== nuevo) {
      out = out.filter(
        (r) => !(r.tipo === 'oportunidad' && r.clienteId === clienteId && r.vehiculoId === anterior),
      );
    }
    if (nuevo && !out.some((r) => r.tipo === 'oportunidad' && r.clienteId === clienteId && r.vehiculoId === nuevo)) {
      out = [
        ...out,
        {
          id: Math.max(0, ...out.map((r) => r.id)) + 1,
          clienteId,
          vehiculoId: nuevo,
          tipo: 'oportunidad',
          fecha: todayIsoDate(),
        },
      ];
    }
    return out;
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
        notas: newClient.notas.trim(),
        canal: existing?.canal ?? 'Carga manual',
        busca: busquedaFromForm(newClient),
        archivado: existing?.archivado ?? false,
      };
      const nextCustomers = customers.map((c) => (c.id === updated.id ? updated : c));
      const nextStock = stock.map((car) => updateCarContactForCustomer(car, updated));
      const nextRels = sincronizarOportunidad(
        relaciones,
        updated.id,
        existing?.busca?.vehiculoId ?? null,
        updated.busca?.vehiculoId ?? null,
      );
      const synced = syncStockAndCustomers(nextStock, nextCustomers, nextRels);
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
      notas: newClient.notas.trim(),
      canal: 'Carga manual',
      busca: busquedaFromForm(newClient),
      archivado: false,
    };
    setCustomers([...customers, client]);
    setRelaciones((prev) => sincronizarOportunidad(prev, client.id, null, client.busca?.vehiculoId ?? null));
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
    const title = 'Eliminar cliente';
    const message = `¿Seguro que quieres eliminar a ${client.nombre}?`;
    const limpiarContacto = (contact: VehicleContact | null) => (contact?.clienteId === client.id ? null : contact);
    const limpiarReferenciasCliente = (car: Car): Car => ({
      ...car,
      clienteAdquisicion: limpiarContacto(car.clienteAdquisicion),
      comprador: limpiarContacto(car.comprador),
      consignante: limpiarContacto(car.consignante),
    });
    const eliminarCliente = () => {
      setCustomers((prev) => prev.filter((c) => c.id !== client.id));
      setRelaciones((prev) => prev.filter((r) => r.clienteId !== client.id));
      setStock((prev) => prev.map(limpiarReferenciasCliente));
      setActiveCar((prev) => (prev ? limpiarReferenciasCliente(prev) : prev));
      showNotification(`Cliente ${client.nombre} eliminado.`);
    };

    if (Platform.OS === 'web') {
      const webConfirm = (globalThis as typeof globalThis & { confirm?: (message?: string) => boolean }).confirm;
      if (webConfirm ? webConfirm(`${title}\n\n${message}`) : true) {
        eliminarCliente();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: eliminarCliente },
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

  const handleUpdateClienteNotas = (id: number, notas: string) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, notas } : c)));
  };

  /* El estado del cliente se mueve desde su tarjeta, sin abrir el editor: es lo
     que más cambia y antes había que entrar a Editar para tocarlo. */
  const handleCambiarEstadoCliente = (cliente: Customer, estado: string) => {
    if (estado === cliente.estado) return;
    setCustomers((prev) => prev.map((c) => (c.id === cliente.id ? { ...c, estado } : c)));
    showNotification(`${cliente.nombre} pasó a "${estado}".`);
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
      const uri = result.assets[0].uri;
      setWizardData((prev) => ({ ...prev, fotos: [uri, ...prev.fotos] }));
      showNotification('Foto capturada con éxito.');
      leerPatenteDeFoto(uri);
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
      leerPatenteDeFoto(uris[0]);
    }
  };

  const handleQuitarFoto = (idx: number) => {
    setWizardData((prev) => ({ ...prev, fotos: prev.fotos.filter((_, i) => i !== idx) }));
  };

  /* ============================ RENDER ============================ */
  const adjudicadasCount = auctions.filter((a) => a.estado === 'Adjudicada').length;
  const bottomNavOffset = bottomNavHeight || (64 + (insets.bottom || 8));
  const stockFabBottom = bottomNavOffset + STOCK_FAB_GAP;
  const hasOpenSurface =
    !!activeCar ||
    isFilterSheetOpen ||
    isPriceSheetOpen ||
    isStatusSheetOpen ||
    isAuctionBidSheetOpen ||
    isAuctionPublishSheetOpen ||
    isAuctionFeaturesSheetOpen ||
    isNewClientSheetOpen ||
    isEnvioInformeSheetOpen ||
    isCargarAutoOpen ||
    isNuevaSolicitudOpen ||
    !!informeAbierto ||
    isAutosaveReportOpen;
  const showStockFab = activeTab === 'stock' && !hasOpenSurface;
  const handleBottomNavLayout = (event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setBottomNavHeight((prevHeight) => (prevHeight === nextHeight ? prevHeight : nextHeight));
  };

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
          {/* Lo que no está en la barra pero sigue en la app: KPIs, que David sacó de
              abajo el 21-08 ("los gallos lo hacen una vez al año cuando pagan
              impuestos"), y Subastas, que espera la decisión de Autored sobre si
              sale de la app (punto 46). El Motor de Precios se fue a la barra. */}
          <View style={s.headerActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('kpis')}
              style={s.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel="KPIs"
            >
              <Icon name="chart-simple" size={16} color={activeTab === 'kpis' ? C.chileanTeal : C.slate600} />
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
            {
              paddingLeft: 16 + insets.left,
              paddingRight: 16 + insets.right,
              paddingBottom: activeTab === 'stock' ? STOCK_SCROLL_BOTTOM_PADDING : 24,
            },
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
              filters={filters}
              setFilters={setFilters}
              activeStockAuctionMap={activeStockAuctionMap}
              relaciones={relaciones}
              setActiveCar={setActiveCar}
              setIsFilterSheetOpen={setIsFilterSheetOpen}
              handleEliminarAuto={handleEliminarAuto}
              handleAgregarAStock={handleAgregarAStock}
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
              handleUpdateClienteNotas={handleUpdateClienteNotas}
              handleCambiarEstadoCliente={handleCambiarEstadoCliente}
            />
          )}
          {activeTab === 'informes' && (
            <InformesScreen
              informes={informes}
              stock={stock}
              informePatente={informePatente}
              setInformePatente={setInformePatente}
              informeTipo={informeTipo}
              setInformeTipo={setInformeTipo}
              informeBusqueda={informeBusqueda}
              setInformeBusqueda={setInformeBusqueda}
              handleSacarInforme={handleSacarInforme}
              handleVerInforme={handleVerInforme}
            />
          )}
          {activeTab === 'transferencias' && (
            <TransferenciasScreen
              transferencias={transferencias}
              stock={stock}
              trPatente={trPatente}
              setTrPatente={setTrPatente}
              trEstado={trEstado}
              setTrEstado={setTrEstado}
              handleAbrirNuevaSolicitud={handleAbrirNuevaSolicitud}
            />
          )}
          {activeTab === 'motor' && (
            <MotorPreciosScreen
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
          )}
          {activeTab === 'kpis' && (
            <KpisScreen
              kpis={kpis}
              kpisMes={kpisMes}
              periodoKpi={periodoKpi}
              setPeriodoKpi={setPeriodoKpi}
              periodosDisponibles={periodosDisponibles}
              setFilterState={setFilterState}
              setFiltroDias={(dias) => setFilters((prev) => ({ ...prev, dias }))}
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
          onLayout={handleBottomNavLayout}
        >
          {/* Los cinco que cerró David el 21-08: "la del stock, la de cliente,
              informe, transferencia, motor de precio, eso es 5". Van sin etiqueta
              porque con cinco el texto no entra en pantalla de teléfono; el label
              se sigue pasando para el lector de pantalla. Si los compraventeros
              dudan de dónde tocar, se prende `showLabel` y listo. */}
          <NavButton
            icon="warehouse"
            label="Stock"
            showLabel={false}
            active={activeTab === 'stock'}
            onPress={() => setActiveTab('stock')}
          />
          <NavButton
            icon="user-group"
            label="Clientes"
            showLabel={false}
            active={activeTab === 'clientes'}
            onPress={() => setActiveTab('clientes')}
          />
          <NavButton
            icon="file-lines"
            label="Informes"
            showLabel={false}
            active={activeTab === 'informes'}
            onPress={() => setActiveTab('informes')}
          />
          <NavButton
            icon="right-left"
            label="Transferencias"
            showLabel={false}
            active={activeTab === 'transferencias'}
            onPress={() => setActiveTab('transferencias')}
          />
          <NavButton
            icon="gauge-high"
            label="Motor de Precios"
            showLabel={false}
            active={activeTab === 'motor'}
            onPress={handleAbrirMotor}
          />
        </View>

        {showStockFab ? (
          <View
            pointerEvents="box-none"
            style={[
              s.stockFabWrap,
              {
                right: STOCK_FAB_SIDE_OFFSET + insets.right,
                bottom: stockFabBottom,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleAbrirCargaManual}
              style={s.fab}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Agregar vehículo"
            >
              <Icon name="plus" size={22} color={C.white} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* OVERLAYS Y SHEETS (dentro del frame, apilados como en el HTML base) */}
        <FichaAuto
          activeCar={activeCar}
          setActiveCar={setActiveCar}
          modoCliente={modoCliente}
          setModoCliente={setModoCliente}
          activeStockAuctionMap={activeStockAuctionMap}
          activeInforme={activeInforme}
          setIsAutosaveReportOpen={setIsAutosaveReportOpen}
          handleAbrirEnvioInforme={handleAbrirEnvioInforme}
          handleIrATransferencias={handleIrATransferencias}
          handleLlamar={handleLlamar}
          handleWhatsapp={handleWhatsapp}
          setAdjustedPrice={setAdjustedPrice}
          setIsPriceSheetOpen={setIsPriceSheetOpen}
          handleAbrirEstado={handleAbrirEstado}
          handleEditarAuto={handleEditarAuto}
          handleEliminarAuto={handleEliminarAuto}
        />
        {/* PageOverlay no usa zIndex: se pinta por orden, así el informe queda sobre la ficha */}
        {/* Un solo visor para dos entradas: la ficha del auto, que abre siempre el
            informe completo con sus acciones, y la sección de Informes, que abre el
            tipo que se sacó y sin acciones si la patente no es del patio. */}
        <InformeAutosaveOverlay
          car={informeAbierto ? informeAbierto.car : activeCar}
          informe={informeAbierto ? informeDeLaSeccion : activeInforme}
          tipo={informeAbierto ? informeAbierto.tipo : 'Autored Completo'}
          abierto={!!informeAbierto || isAutosaveReportOpen}
          onCerrar={() => {
            setInformeAbierto(null);
            setIsAutosaveReportOpen(false);
          }}
          mostrarAcciones={informeAbierto ? estaEnStock(informeAbierto.car.patente, stock) : true}
          handleAbrirEnvioInforme={handleAbrirEnvioInforme}
          handleIrATransferencias={handleIrATransferencias}
        />
        <NuevaSolicitudOverlay
          abierto={isNuevaSolicitudOpen}
          onCerrar={() => setIsNuevaSolicitudOpen(false)}
          tipoElegido={trTipoElegido}
          setTipoElegido={setTrTipoElegido}
        />
        <AltaVehiculoWizard
          isCargarAutoOpen={isCargarAutoOpen}
          setIsCargarAutoOpen={setIsCargarAutoOpen}
          cargarStep={cargarStep}
          setCargarStep={setCargarStep}
          wizardData={wizardData}
          setWizardData={setWizardData}
          busquedaPatente={busquedaPatente}
          setBusquedaPatente={setBusquedaPatente}
          handleBuscarPatente={handleBuscarPatente}
          handleTomarFichaPatente={handleTomarFichaPatente}
          lecturaPatente={lecturaPatente}
          handleConfirmarLectura={handleConfirmarLectura}
          handleDescartarLectura={handleDescartarLectura}
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
          stock={stock}
          ordenStock={ordenStock}
          setOrdenStock={setOrdenStock}
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
          activeCar={statusCar || activeCar}
          isStatusSheetOpen={isStatusSheetOpen}
          setIsStatusSheetOpen={setIsStatusSheetOpen}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          statusNote={statusNote}
          setStatusNote={setStatusNote}
          statusBuyer={statusBuyer}
          setStatusBuyer={setStatusBuyer}
          statusConsignante={statusConsignante}
          setStatusConsignante={setStatusConsignante}
          statusPiso={statusPiso}
          setStatusPiso={setStatusPiso}
          statusFinanciado={statusFinanciado}
          setStatusFinanciado={setStatusFinanciado}
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
          stock={stock}
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

        {/* NOTIFICACIÓN (siempre encima de todo) */}
        {notification && (
          <NotificationBanner
            key={notification.id}
            message={notification.message}
            type={notification.type}
            top={insets.top + 76}
          />
        )}
      </View>
    </View>
  );
}
