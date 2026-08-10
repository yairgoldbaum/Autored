# Contexto para P1 — AutoRed Vendor

Este documento es para **Cris**, que toma la mitad de "P1" del trabajo y arranca **desde esta
versión, no desde la original**. Lo escribió Eitan (P2) el 10-08-2026, después de implementar sus
21 pasos. Si eres Cris y estás abriendo el repo por primera vez, este archivo es lo primero que
tienes que leer y alcanza para empezar.

---

## 1. Qué es la app

App móvil de gestión de stock para **compraventas de autos** en Chile, hecha para Autored. Expo +
React Native. Es una **maqueta funcional**: los datos son de referencia y no hay nada conectado a
sistemas reales. Cuatro pestañas originales (Inicio, Stock, Subastas, Clientes) más el motor de
precios y el bloque AutoSafe. Ahora hay una quinta, KPIs.

El cliente es la compraventa: gente que trabaja en la calle y en el patio, no en un escritorio.
Todo el criterio de diseño sale de ahí.

## 2. De dónde viene este trabajo

Cuatro personas de Autored —David Ventura (CTO), Jorge Facusse, Mauro Gandolfo y Nicolás Gil—
mandaron feedback escrito el 09-08. Se recorrió la app pantalla por pantalla y salieron 49 pedidos
concretos, que se repartieron en dos mitades:

- **P2 (Eitan): clientes, el alta de vehículos y los KPIs.** Son 21 pasos y **están todos hechos**.
- **P1 (tú): el stock — navegación, bandeja y ficha.** Son 14 pasos y **no está tocado nada**.

Resumen del feedback en una línea: nadie criticó el diseño. Lo que piden es cambiar la **jerarquía**
de la app (el stock como portada en vez de los KPIs) y la **profundidad de los datos**, con Clientes
como la sección de más valor sin explotar.

## 3. Lo primero que tienes que saber

**`App.tsx` sigue siendo un solo archivo de ~6.350 líneas.** Partirlo es tu paso 2 y era el
bloqueo de todo lo demás. El plan original decía que tú lo partías *antes* de que P2 tocara nada,
justamente para no chocar. **No pasó así**: Eitan decidió avanzar igual el 10-08, así que los 21
pasos de P2 están escritos sobre el archivo único.

Lo que eso significa para ti, concretamente:

- Tu refactor **sale de estos commits**, no del commit inicial. Si partes del original, pierdes
  todo el trabajo de P2 o te comes un merge feo.
- Hay **un commit por paso** justamente para que puedas leerlos de a uno y entender qué se movió.
- El diff contra el original es **+1.328 / −537** líneas en tres archivos: `App.tsx`, `src/data.ts`
  y `src/storage.ts`. No se tocó nada más.

## 4. Las ramas, y cuál usar

| Rama | Qué es |
|---|---|
| `main` | La app original, Expo **SDK 54**. Congelada en el commit inicial. |
| `sdk57` | SDK 57 + los 21 pasos de P2. **Es la rama de trabajo.** |
| `sdk54-p2` | Los 12 commits de código de P2 sobre la base SDK 54, sin la subida de SDK. Se hizo solo para que Eitan pudiera ver la app en su Expo Go. **No es "el port"**, es una rama para mirar. |

**Por qué hay dos SDK:** el Expo Go del App Store solo abre SDK 54 y el de David es 57. Por eso
conviven. Llevar todo a SDK 54 es tu paso 14 y es tarea permanente: cada cambio nuevo va en las dos.

`sdk54-p2` te sirve de referencia de que el código de P2 **tipea limpio contra SDK 54** (se
verificó), pero no reemplaza tu port: falta comprobar que no rompa nada en runtime, que es otra cosa.

## 5. Lo que cambió en el modelo (esto sí te afecta)

Son cuatro cambios que **sacan o reemplazan** campos que las pantallas del stock leían. Si algo
tuyo deja de compilar, es por acá.

### `diasStock` ya no existe

Era un número guardado que se escribía **1** al crear el auto y no se movía nunca. El distintivo
"+60 DÍAS", el promedio de días y el gráfico de antigüedad mentían a la semana de uso real.

Lo reemplaza `diasEnStock(car)` en `src/data.ts`, que resta `fechaIngreso` contra hoy. Es una
función, no un campo: llámala donde necesites el número.

### `Customer.interes` ya no existe

Era un dropdown que se llenaba **con el stock propio**. El punto entero de registrar un interés es
poder anotar un auto que **no** tienes. Ahora el cliente tiene `busca: { modelo, comentario } | null`,
texto libre con sugerencias desde `MODELOS_BUSCADOS`.

También ganó `canal: 'Carga manual' | 'Tasador web'` (para recibir los leads del tasador web de
Autored cuando abran la integración) y `archivado: boolean`.

### La relación cliente-vehículo es una lista aparte

Antes vivía partida en tres campos del cliente —`vehiculosAdquisicionIds`, `vehiculosVentaIds`,
`reservadoId`— más los contactos embebidos en el auto, y una función mantenía las dos direcciones
cuadradas a mano. **Esos tres campos ya no existen.** Ahora:

```ts
type TipoRelacion = 'adquisicion' | 'venta' | 'consignacion' | 'oportunidad';

interface RelacionClienteVehiculo {
  id: number;
  clienteId: number;
  vehiculoId: number;
  tipo: TipoRelacion;
  fecha: string; // YYYY-MM-DD
}
```

Vive en el estado global al lado de `stock` y `customers`, y se persiste como **tercera colección**
en `src/storage.ts`.

Dos cosas que conviene tener claras:

- **La reserva no es un tipo de relación.** Se deriva: un cliente con relación de `venta` a un auto
  en estado `Reservado`.
- **Los contactos embebidos del auto se quedan donde estaban** (`clienteAdquisicion`, `comprador`,
  `consignante`). Sirven para mostrar el nombre sin ir a buscarlo a otra lista y ya traen
  `clienteId`. Lo que se eliminó es la duplicación en la dirección contraria.

`syncStockAndCustomers()` sigue existiendo pero quedó reducida a: crear el cliente que falta cuando
un auto trae un contacto nuevo, sincronizar nombre y teléfono en los contactos embebidos, y rearmar
las relaciones derivables desde esos contactos conservando id y fecha. Las de tipo `oportunidad` no
cuelgan de ningún contacto, se cargan a mano y solo se conservan.

### `Customer.roles` ya no existe

El rol comercial se elegía a mano en el formulario y quedaba desalineado con los autos que el
cliente realmente tenía. Ahora se **deduce** de las relaciones: quien tiene una de adquisición o
consignación es de adquisición, quien tiene una de venta es de venta. Está en
`esClienteDeAdquisicion()` y `esClienteDeVenta()`.

### Campos que se agregaron (no rompen nada)

`Car` ganó: `tenencia` (`'Propio' | 'Consignado'`) con `consignante` y `precioPisoConsignacion`;
`fechaVenta` y `financiado`; y `visitas[]` con fecha y cliente opcional.

**Ojo con el margen.** En un auto consignado no hubo compra, así que `costoAdquisicion` es 0 y la
resta devolvía el precio completo del auto como si fuera utilidad. Usa siempre **`costoBase(car)`**
de `src/data.ts`, nunca restes `costoAdquisicion` a mano. Está aislado en una función porque
Autored **todavía no define cómo se calcula la comisión de consignación**: hoy se asume precio piso
pactado, y si responden que es un porcentaje se cambia esa función y ninguna pantalla.

## 6. Lo que se hizo, pantalla por pantalla

**Clientes.** Los chips pasaron de rol comercial a seis derivados: Todos, Clientes, Leads,
Intereses, Oportunidades, Archivados. Se pisan a propósito (un lead del tasador con un interés
anotado sale en los dos) y Archivados es el único distinto: sus clientes no aparecen en los otros
salvo que se los busque. La tarjeta ahora dice **lo que es cada persona** —el interesado qué busca,
el consignante qué auto tuyo tiene, el comprador qué se llevó— en vez de una línea genérica igual
para todos. Se puede archivar. El alta bajó a nombre y teléfono obligatorios más un bloque plegado
opcional. Y se sacaron las tres métricas de arriba, que contaban roles que ya no existen.

**Alta de vehículo.** De cinco pasos a los tres de David: fotos, información del vehículo, y precios
más estado más cliente. El criterio del corte conviene respetarlo: **la fecha de ingreso y el estado
no son datos del auto sino de la operación**, y por eso van con los precios. El bloque de cliente
aparece solo si el auto entra Reservado o Vendido. El paso de documentos salió del flujo: nadie
carga el padrón parado en el patio con el auto recién llegado, se suben después desde la ficha
(tuya). Y el motor de precios entró al paso de precios.

**KPIs.** Dejaron de ser la portada y son pestaña propia. Cuatro números del mes —ventas, margen
promedio, margen total, penetración de financiamiento— con filtro de período. Las tres tarjetas
viejas describían el stock que existe ahora, que es una foto; estas describen lo que pasó en un mes,
que es una película. Capital en autos y días promedio conviven abajo porque siguen sirviendo. Las
barras de los gráficos abren el Stock filtrado.

**Inicio** quedó con el Motor de Precios como único protagonista.

## 7. Tres cosas que quedaron en tu territorio

Están marcadas en el código con el comentario `NOTA PARA P1`. Búscalas con grep.

1. **El filtro por rango de días** (tu paso 7, el cruce 1). Era tuyo y no estaba en tu lista. La
   barra de antigüedad de los KPIs necesita abrir el Stock filtrado por tramo, así que se
   implementó lo mínimo: un estado `filtroDias` en `filteredStock` y un aviso visible en Stock para
   poder sacarlo. **Cuando armes el filtro de verdad, esto se reemplaza.**

2. **La pestaña de KPIs en la barra inferior.** Se agregó al final, que es donde va. Pero
   reordenar la navegación es tu paso 3, así que cuando lo hagas, tenla en cuenta: ahora son cinco
   pestañas más el botón flotante.

3. **El motor de precios como componente.** `MotorPreciosPublicacion` ya está escrito **aparte**
   para que lo reuses en la ficha (era el sexto cruce). Recibe patente, km y el vehículo, y no toca
   estado de nadie. Ojo con la diferencia: en la ficha y en el alta el auto **ya es tuyo**, así que
   muestra precio sugerido y comparables, y **no** el rango de oferta ni el margen al piso o al
   techo, que son de la decisión de compra. La versión completa vive en `renderMotorPrecios`,
   entrando desde el Inicio.

## 8. Tus 14 pasos

Ninguno está hecho. El detalle largo de cada uno lo tiene Eitan en su `plan-trabajo.md`; esto es el
índice para que sepas de qué se habla.

1. Arreglar los montos que se cortan en dos líneas *(en las tarjetas de KPI ya está hecho; en las
   tuyas no)*
2. **Partir `App.tsx` en un archivo por pantalla** — empieza por acá
3. Reordenar la navegación
4. Tabs de la bandeja
5. Marcar propio contra consignación *(el dato ya existe en el modelo, falta pintarlo)*
6. Qué se muestra en la tarjeta de la bandeja
7. Filtros y ordenamiento *(incluye el filtro por rango de días del punto 7 de arriba)*
8. Ficha con secciones colapsables
9. Modo cliente en la ficha
10. Motor de precios dentro de la ficha *(el componente ya está listo)*
11. Detalle de la subasta en el auto — **bloqueado**, esperando a Autored
12. Pre-stock alimentado por subastas — **bloqueado**, esperando a Autored
13. Definir qué va en "Clientes del vehículo"
14. Llevar todo a la rama SDK 54 — tarea permanente

**Dos datos que se guardan desde tu ficha y que P2 necesita:** la fecha de venta y si fue
financiado (sin eso los KPIs del mes no existen), y el botón de marcar visita. Coordínalo con Eitan.

## 9. Cómo levantarla

Usa **pnpm**, no npm. En el Mac de Eitan hay wrappers de nvm que rompen `node`, de ahí el `export`:

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
unset -f node npm npx pnpm nvm 2>/dev/null
pnpm install
pnpm start
```

Abre con **Expo Go** escaneando el QR. Tiene que ser la versión de Expo Go que corresponde al SDK
de la rama: SDK 54 abre con el Expo Go del App Store, SDK 57 no.

**Verificar que de verdad sirve:** que Metro diga "running" no prueba nada. La prueba real es bajar
el bundle y que dé 200 con varios MB:

```bash
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" \
  "http://localhost:8081/index.bundle?platform=ios&dev=true"
```

Y antes de commitear, `npx tsc --noEmit` limpio.

**La inspección con IA** necesita `EXPO_PUBLIC_ANTHROPIC_API_KEY` en un `.env`. No está puesta y es
API que cobra. El resto de la app anda sin llave.

## 10. Lo que está abierto y no depende de nosotros

- **Cómo se calcula la comisión de un auto en consignación.** La pregunta exacta para Autored no es
  "cómo la calculan" sino "¿es porcentaje o es piso pactado?". En el kickoff hablaron de 3-4%, que
  es una fórmula distinta a la implementada. Mientras tanto, cada consignado que se venda entra al
  margen del mes con un supuesto nuestro, y la pantalla lo dice en vez de esconderlo.
- **Si la página de Subastas sale de la app** (David dice que sí, Mauro que no). Bloquea tus pasos
  11 y 12.
- **Quién paga la IA y con qué llave.** Es una sola decisión de la que dependen la carga por voz, la
  inspección con IA y la lectura de patente por foto.
- **Qué se oculta exactamente en modo cliente** (¿los días en stock también?).
- **Los tres estados del trato del cliente.** Se implementó la propuesta —Nuevo, Caliente,
  Frecuente— pero falta el OK de Eitan. Si cambian, se tocan `ESTADO_CLIENTE_OPTIONS`,
  `badgeForEstadoCliente` y `normalizeEstadoCliente`.

## 11. Fuera de alcance, ya decidido

No hace falta re-discutirlo: la carga de clientes por voz queda pospuesta (no descartada), el aviso
automático cuando entra un auto que calza con un interés no entra en esta versión aunque es donde
está el valor real de la idea, los vendedores y sus permisos esperan la definición de roles con
David, los leads por canal esperan que Autored abra la integración (la estructura ya está lista con
el campo `canal`), y la lectura de patente desde la foto depende de la llave de IA.

---
*Escrito el 10-08-2026, después de cerrar los 21 pasos de P2 en la rama `sdk57`.*
