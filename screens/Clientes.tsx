import React from 'react';
import {
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
import { Dropdown, Icon, Sheet, Wiggle } from '../src/ui';
import { s } from '../src/styles';
import { Car, Customer, RelacionClienteVehiculo } from '../src/data';
import {
  CLIENTE_FILTROS,
  ClienteFiltro,
  ESTADO_CLIENTE_OPTIONS,
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
  handleUpdateClienteEstado: (id: number, estado: string) => void;
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
  handleUpdateClienteEstado,
}: ClientesScreenProps) {
  const contarFiltro = (filtro: ClienteFiltro) =>
    customers.filter(
      (c) =>
        (filtro === 'Archivados' || !c.archivado) &&
        cumpleFiltroCliente(c, relacionesPorCliente.get(c.id) || [], filtro),
    ).length;

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

      {/* Las tres tarjetas de Total / Adquisición / Venta que estaban acá se sacaron:
          contaban roles que ya no existen y ocupaban la mejor parte de la pantalla
          sin accionar nada. Los chips ya traen el conteo. */}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
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
            const rels = relacionesPorCliente.get(cli.id) || [];
            const roles = rolesDeCliente(rels);
            const linea = lineaCliente(cli, rels, stockById);
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
                    <TouchableOpacity onPress={() => handleToggleArchivadoCliente(cli)} style={s.cliIconBtn}>
                      <Icon
                        name={cli.archivado ? 'rotate-left' : 'box-archive'}
                        size={12}
                        color={cli.archivado ? C.chileanTeal : C.slate500}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEliminarCliente(cli)} style={s.cliIconBtn}>
                      <Wiggle>
                        <Icon name="trash-can" size={12} color={C.red600} />
                      </Wiggle>
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
                    <View style={s.rowBetween}>
                      <Text style={s.cliGridLabel} numberOfLines={1}>
                        {linea.etiqueta}
                      </Text>
                      {linea.vehiculo ? (
                        <TouchableOpacity onPress={() => setActiveCar(linea.vehiculo as Car)}>
                          <Text style={s.cliVerLink}>Ver</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={s.cliGridValue} numberOfLines={1}>
                      {linea.valor}
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
            {/* Todo lo demás es opcional y va plegado: el alta se cierra con nombre
                y teléfono. El estado del trato no se pregunta acá, se marca después
                desde la tarjeta. */}
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
          </View>

          <TouchableOpacity
            onPress={handleGuardarCliente}
            disabled={!clienteFormListo}
            style={[s.sheetPrimaryBtn, !clienteFormListo && { opacity: 0.45 }]}
          >
            <Text style={s.sheetPrimaryText}>{newClient.id ? 'Guardar Cambios' : 'Registrar Cliente'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Sheet>
  );
}
