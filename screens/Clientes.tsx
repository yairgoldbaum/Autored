import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
  NewClientData,
  TIPO_CLIENTE_OPTIONS,
  badgeForClienteRol,
  badgeForEstadoCliente,
  cumpleFiltroCliente,
  lineaCliente,
  rolesDeCliente,
} from '../src/helpers';
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
            const eb = badgeForEstadoCliente(cli.estado);
            const rels = relacionesPorCliente.get(cli.id) || [];
            const roles = rolesDeCliente(rels);
            const linea = lineaCliente(cli, rels, stockById);
            return (
              <View key={cli.id} style={s.cliCard}>
                {/* Cabecera: nombre + estado + acciones */}
                <View style={s.cliCardHead}>
                  <View style={s.cliTitleBlock}>
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
  const cerrarSheet = () => {
    Keyboard.dismiss();
    setIsNewClientSheetOpen(false);
  };
  const guardarCliente = () => {
    Keyboard.dismiss();
    handleGuardarCliente();
  };

  return (
    <Sheet visible={isNewClientSheetOpen} onClose={cerrarSheet} maxHeightPct={90}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
        style={{ maxHeight: '100%', flexShrink: 1 }}
      >
        <View style={{ maxHeight: '100%', flexShrink: 1 }}>
          <View style={[s.rowBetween, { gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.slate100 }]}>
            <Text style={[s.sheetTitleSm, { flex: 1 }]}>{newClient.id ? 'Editar Cliente' : 'Registrar Nuevo Lead / Cliente'}</Text>
            <View style={s.rowCenter}>
              <TouchableOpacity activeOpacity={0.8} onPress={Keyboard.dismiss} style={s.dismissKeyboardBtn}>
                <Icon name="check" size={10} color={C.chileanTeal} />
                <Text style={s.dismissKeyboardText}>Listo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cerrarSheet}>
                <Icon name="circle-xmark" size={18} color={C.slate400} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View>
              <Text style={s.sheetFieldLabel}>Nombre Completo</Text>
              <TextInput
                placeholder="Ej: Juan Pérez"
                placeholderTextColor={C.slate400}
                value={newClient.nombre}
                onChangeText={(t) => setNewClient({ ...newClient, nombre: t })}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                blurOnSubmit
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
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                blurOnSubmit
                style={s.sheetInput}
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
                numberOfLines={4}
                textAlignVertical="top"
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
                  modelo={newClient.buscaModelo}
                  comentario={newClient.buscaComentario}
                  onChangeModelo={(v) => setNewClient({ ...newClient, buscaModelo: v })}
                  onChangeComentario={(v) => setNewClient({ ...newClient, buscaComentario: v })}
                />
              </>
            ) : null}
          </ScrollView>

          <View style={[s.sheetFooter, { paddingBottom: (insets.bottom || 0) + 16 }]}>
            <TouchableOpacity
              onPress={guardarCliente}
              disabled={!clienteFormListo}
              style={[s.sheetPrimaryBtn, { flex: 1 }, !clienteFormListo && { opacity: 0.45 }]}
            >
              <Text style={s.sheetPrimaryText}>{newClient.id ? 'Guardar Cambios' : 'Registrar Cliente'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Sheet>
  );
}
