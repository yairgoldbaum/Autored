import React from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, W } from '../src/theme';
import { Dropdown, Icon, Sheet } from '../src/ui';
import { s } from '../src/styles';
import { Car, Customer, RelacionClienteVehiculo } from '../src/data';
import {
  CLIENTE_FILTROS,
  ClienteFiltro,
  ESTADO_CLIENTE_OPTIONS,
  NewClientData,
  TIPO_CLIENTE_OPTIONS,
  cumpleFiltroCliente,
  haceCuanto,
  lineaCliente,
} from '../src/helpers';
import { fmtFecha } from '../src/autosave';
import { ModeloBuscadoField } from '../components/shared';

interface ClientesScreenProps {
  customers: Customer[];
  filteredCustomers: Customer[];
  relacionesPorCliente: Map<number, RelacionClienteVehiculo[]>;
  clienteSearch: string;
  setClienteSearch: React.Dispatch<React.SetStateAction<string>>;
  clienteFiltro: ClienteFiltro;
  setClienteFiltro: React.Dispatch<React.SetStateAction<ClienteFiltro>>;
  stockById: Map<number, Car>;
  setActiveCar: (car: Car | null) => void;
  handleAbrirNuevoCliente: () => void;
  handleCambiarEstadoCliente: (cliente: Customer, estado: string) => void;
  handleEditarCliente: (client: Customer) => void;
  handleToggleArchivadoCliente: (client: Customer) => void;
  handleEliminarCliente: (client: Customer) => void;
  handleLlamar: (telefono: string) => void;
  handleWhatsapp: (telefono: string) => void;
  handleUpdateClienteNotas: (id: number, notas: string) => void;
}

/* ======================= PANTALLA CLIENTES ======================= */
export function ClientesScreen({
  customers,
  filteredCustomers,
  relacionesPorCliente,
  clienteSearch,
  setClienteSearch,
  clienteFiltro,
  setClienteFiltro,
  stockById,
  setActiveCar,
  handleAbrirNuevoCliente,
  handleCambiarEstadoCliente,
  handleEditarCliente,
  handleToggleArchivadoCliente,
  handleEliminarCliente,
  handleLlamar,
  handleWhatsapp,
  handleUpdateClienteNotas,
}: ClientesScreenProps) {
  const contarFiltro = (filtro: ClienteFiltro) =>
    customers.filter(
      (c) =>
        (filtro === 'Archivados' || !c.archivado) &&
        cumpleFiltroCliente(c, relacionesPorCliente.get(c.id) || [], filtro),
    ).length;

  return (
    <View style={{ gap: 16 }}>
      <View style={s.screenHead}>
        <View style={s.screenHeadText}>
          <Text style={s.h2Black}>Clientes</Text>
          <Text style={s.subMuted}>Adquisición, reservas y compradores</Text>
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={handleAbrirNuevoCliente} style={[s.newClientBtn, s.screenHeadAction]}>
          <Icon name="user-plus" size={12} color={C.white} />
          <Text style={s.newClientText} numberOfLines={1}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Las tres tarjetas de Total / Adquisición / Venta que estaban acá se sacaron:
          contaban roles que ya no existen y ocupaban la mejor parte de la pantalla
          sin accionar nada. Los chips ya traen el conteo. */}

      <View style={s.chipWrap}>
        {CLIENTE_FILTROS.map((filtro) => {
          const isSelected = clienteFiltro === filtro;
          return (
            <TouchableOpacity
              key={filtro}
              activeOpacity={0.8}
              onPress={() => setClienteFiltro(filtro)}
              style={[s.chip, isSelected ? s.chipActive : s.chipInactive]}
            >
              <Text style={[s.chipText, { color: isSelected ? C.white : C.slate600 }]}>{filtro}</Text>
              <View style={[s.chipCount, { backgroundColor: isSelected ? C.chileanTeal : C.slate100 }]}>
                <Text style={{ fontSize: 10, color: isSelected ? C.white : C.slate500, fontWeight: W.bold }}>
                  {contarFiltro(filtro)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

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

      {/* Lista unificada de clientes */}
      <View style={{ gap: 12 }}>
        {filteredCustomers.length === 0 ? (
          <View style={s.cliEmpty}>
            <Icon name="user-slash" size={18} color={C.slate400} />
            <Text style={s.cliEmptyText}>No hay clientes que coincidan con la búsqueda.</Text>
          </View>
        ) : (
          filteredCustomers.map((cli) => {
            const rels = relacionesPorCliente.get(cli.id) || [];
            const linea = lineaCliente(cli, rels, stockById);
            return (
              <View key={cli.id} style={s.cliCard}>
                {/* Cabecera: nombre + estado + acciones */}
                <View style={s.cliCardHead}>
                  <View style={s.cliTitleBlock}>
                    <Text style={s.cliNombre}>{cli.nombre}</Text>
                    {/* El último contacto en relativo (punto 10): es lo que sirve
                        para ver de un vistazo quién se está enfriando. La fecha de
                        registro va abajo, en el detalle. */}
                    <Text style={s.cliUltimoContacto}>
                      Último contacto {haceCuanto(cli.fechaUltimoContacto)}
                    </Text>
                  </View>
                  <View style={s.rowCenter}>
                    <TouchableOpacity onPress={() => handleEditarCliente(cli)} style={s.cliIconBtn}>
                      <Icon name="pen-to-square" size={12} color={C.slate500} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleToggleArchivadoCliente(cli)} style={s.cliIconBtn}>
                      <Icon
                        name={cli.archivado ? 'rotate-left' : 'box-archive'}
                        size={12}
                        color={cli.archivado ? C.chileanTeal : C.slate500}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleEliminarCliente(cli);
                      }}
                      activeOpacity={0.75}
                      hitSlop={8}
                      style={s.cliIconBtn}
                    >
                      <Icon name="trash-can" size={12} color={C.red600} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* En qué va el trato. Es un desplegable y no un badge: el estado
                    cambia todo el tiempo y antes había que entrar a editar el
                    cliente para moverlo. Los roles con el auto (adquisición,
                    venta) salieron de acá: se leen en la línea de abajo. */}
                <View style={s.cliEstadoField}>
                  <Text style={s.cliGridLabel}>Estado</Text>
                  <Dropdown
                    value={cli.estado}
                    onChange={(v) => handleCambiarEstadoCliente(cli, v)}
                    options={ESTADO_CLIENTE_OPTIONS}
                  />
                </View>

                {/* Grid simétrico: Teléfono | lo que es este cliente */}
                <View style={s.cliGrid}>
                  <View style={s.cliGridCell}>
                    <Text style={s.cliGridLabel}>Teléfono</Text>
                    <Text style={s.cliGridValue} numberOfLines={1}>
                      {cli.telefono || '—'}
                    </Text>
                  </View>
                  <View style={[s.cliGridCell, s.cliGridCellRight]}>
                    <View style={s.cliGridLabelRow}>
                      <Text style={[s.cliGridLabel, { flex: 1, minWidth: 0 }]} numberOfLines={2}>
                        {linea.etiqueta}
                      </Text>
                      {linea.vehiculo ? (
                        <TouchableOpacity onPress={() => setActiveCar(linea.vehiculo as Car)}>
                          <Text style={s.cliVerLink}>Ver</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={s.cliGridValue} numberOfLines={2}>
                      {linea.valor}
                    </Text>
                  </View>
                </View>

                <Text style={s.cliRegistro}>Cliente desde el {fmtFecha(cli.fechaRegistro)}</Text>

                {/* Notas editables: reemplazan el antiguo control de estado del trato. */}
                <View style={s.cliStatusBlock}>
                  <Text style={s.cliGridLabel}>Notas del cliente</Text>
                  <TextInput
                    placeholder="Escribe detalles, acuerdos o cuidados al tratar con este cliente..."
                    placeholderTextColor={C.slate400}
                    value={cli.notas}
                    onChangeText={(notas) => handleUpdateClienteNotas(cli.id, notas)}
                    multiline
                    style={[s.sheetInput, s.cliNotesInput]}
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

interface NewClientSheetProps {
  stock: Car[];
  isNewClientSheetOpen: boolean;
  setIsNewClientSheetOpen: (open: boolean) => void;
  newClient: NewClientData;
  setNewClient: React.Dispatch<React.SetStateAction<NewClientData>>;
  newClientExtrasOpen: boolean;
  setNewClientExtrasOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleGuardarCliente: () => void;
}

/* ======================= SHEET: NUEVO/EDITAR CLIENTE ======================= */
export function NewClientSheet({
  stock,
  isNewClientSheetOpen,
  setIsNewClientSheetOpen,
  newClient,
  setNewClient,
  newClientExtrasOpen,
  setNewClientExtrasOpen,
  handleGuardarCliente,
}: NewClientSheetProps) {
  const insets = useSafeAreaInsets();
  const clienteFormListo = !!newClient.nombre.trim() && !!newClient.telefono.trim();
  return (
    <Sheet visible={isNewClientSheetOpen} onClose={() => setIsNewClientSheetOpen(false)} maxHeightPct={90}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
              <Text style={s.sheetFieldLabel}>Estado</Text>
              <Dropdown
                value={newClient.estado}
                onChange={(v) => setNewClient({ ...newClient, estado: v })}
                options={ESTADO_CLIENTE_OPTIONS}
              />
            </View>
            <View>
              <Text style={s.sheetFieldLabel}>Notas del cliente</Text>
              <TextInput
                placeholder="Ej: horarios, preferencias, objeciones, acuerdos pendientes"
                placeholderTextColor={C.slate400}
                value={newClient.notas}
                onChangeText={(t) => setNewClient({ ...newClient, notas: t })}
                multiline
                style={[s.sheetInput, s.sheetNotesInput]}
              />
            </View>
            {/* Todo lo demás es opcional y va plegado: el alta se cierra con nombre
                y teléfono. Las notas quedan visibles porque son el espacio libre
                principal para tratar con el cliente. */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setNewClientExtrasOpen((v) => !v)}
              style={s.sheetToggleRow}
            >
              <Text style={s.sheetToggleText}>Qué busca y tipo de cliente (opcional)</Text>
              <Icon name={newClientExtrasOpen ? 'chevron-up' : 'chevron-down'} size={12} color={C.slate400} />
            </TouchableOpacity>
            {newClientExtrasOpen ? (
              <>
                <View>
                  <Text style={s.sheetFieldLabel}>Tipo de cliente</Text>
                  <Dropdown
                    value={newClient.tipo}
                    onChange={(v) => setNewClient({ ...newClient, tipo: v as NewClientData['tipo'] })}
                    options={TIPO_CLIENTE_OPTIONS}
                  />
                </View>
                <ModeloBuscadoField
                  marca={newClient.buscaMarca}
                  modelo={newClient.buscaModelo}
                  precioMin={newClient.buscaPrecioMin}
                  precioMax={newClient.buscaPrecioMax}
                  comentario={newClient.buscaComentario}
                  stock={stock}
                  vehiculoId={newClient.buscaVehiculoId}
                  /* Van con la forma de función (`prev => …`) y no con `{ ...newClient }`
                     porque elegir marca dispara DOS de estos seguidos —la marca y el
                     modelo que se limpia— y con el objeto de la clausura el segundo
                     escribía sobre el estado viejo: la marca se perdía sin avisar. */
                  onChangeMarca={(v) => setNewClient((prev) => ({ ...prev, buscaMarca: v }))}
                  onChangeModelo={(v) => setNewClient((prev) => ({ ...prev, buscaModelo: v }))}
                  onChangePrecioMin={(v) => setNewClient((prev) => ({ ...prev, buscaPrecioMin: v }))}
                  onChangePrecioMax={(v) => setNewClient((prev) => ({ ...prev, buscaPrecioMax: v }))}
                  onChangeComentario={(v) => setNewClient((prev) => ({ ...prev, buscaComentario: v }))}
                  /* Enganchar un auto del stock ya NO llena marca ni modelo: son cosas
                     distintas y pisarlas borraba lo que el vendedor había elegido. */
                  onPickVehiculo={(car) =>
                    setNewClient((prev) => ({ ...prev, buscaVehiculoId: car ? car.id : null }))
                  }
                />
              </>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={handleGuardarCliente}
            disabled={!clienteFormListo}
            style={[s.sheetPrimaryBtn, !clienteFormListo && { opacity: 0.45 }]}
          >
            <Text style={s.sheetPrimaryText}>{newClient.id ? 'Guardar Cambios' : 'Registrar Cliente'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Sheet>
  );
}
