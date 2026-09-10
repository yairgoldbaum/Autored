# autored-vendor

> **¿Recién llegas al proyecto?** Empieza por **[`AGENTS.md`](./AGENTS.md)**, que dice en qué rama
> se trabaja y qué hay que revisar antes de commitear, y sigue con
> **[`CONTEXTO-P1.md`](./CONTEXTO-P1.md)** para el detalle de qué hace la app y cómo está armado el
> modelo de datos. Este README solo explica cómo levantarla.
>
> **Ojo con la rama.** La app vive en **`sdk54`** (Expo SDK 54), que es la rama de trabajo, y en
> **`sdk57-r3`**, que es la misma app en Expo SDK 57 para los Expo Go actualizados. La rama `main`
> es el HTML viejo del challenge original, no la app.

Una app simplificada para las compra y ventas de autos pequeños.

App móvil hecha con **React Native + Expo**: SDK 54 en `sdk54` y SDK 57 en `sdk57-r3`, con React 19
y TypeScript en las dos.

## Requisitos

- Node.js 20 o superior
- **pnpm**
- La app **Expo Go** instalada en tu teléfono ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

> Este proyecto usa **pnpm**. El archivo `.npmrc` fija `node-linker=hoisted`, necesario para que Metro/Expo funcione con pnpm.

## Configurar la API key de Claude

La función de **inspección con IA** analiza las fotos usando Claude (Anthropic) y necesita una API key. La key **no viene en el repo**: cada persona usa la suya.

> Desde el 1-09-2026 esta función está **desconectada de la app**: Autored pidió sacarla del flujo,
> porque el auto ya está comprado cuando entra a esta app. El módulo sigue completo en
> `src/inspection/` y estos pasos sirven si se vuelve a enchufar.

1. Consigue una API key en [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) (empieza con `sk-ant-...`).
2. Copia el archivo de ejemplo y pega tu key:
   ```bash
   cp .env.example .env
   ```
3. Edita `.env` y deja tu key en la variable:
   ```
   EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-tu-key-aqui
   ```
4. Si el servidor ya estaba corriendo, reinícialo limpiando la caché para que tome el cambio:
   ```bash
   pnpm start -c
   ```

> 🔒 `.env` está en `.gitignore`, así que tu key **no se sube a git**. Nunca la pegues en el código ni la comitees.
>
> ⚠️ Las variables `EXPO_PUBLIC_*` quedan embebidas en el bundle de la app: sirven para desarrollo/demos, pero para producción la llamada a la IA debería ir por un backend propio que guarde la key en el servidor.

## Cómo correrla

### Paso a paso

```bash
pnpm install     # 1. instala las dependencias
pnpm start       # 2. levanta el servidor de Expo y muestra un QR
```

**1. `pnpm install`**
Lee `package.json` + `pnpm-lock.yaml` y descarga todas las dependencias a `node_modules`.
Solo necesitas correrlo **la primera vez**, o cuando:
- clonas el repo de nuevo,
- borras `node_modules`,
- cambian las dependencias (alguien editó `package.json`).

**2. `pnpm start`**
Arranca el **Metro bundler**: el servidor que compila tu código JavaScript/TypeScript en tiempo real y se lo sirve a la app. Mientras corre, te muestra:
- un **QR** para abrir la app en tu teléfono,
- un **menú de teclas** en la terminal (presiona `i` para iOS, `a` para Android, `w` para web, `r` para recargar, `?` para ver todo).

Déjalo corriendo mientras trabajas: cada vez que guardas un archivo, la app se recarga sola (*hot reload*).

### Abrir la app en tu teléfono (lo más fácil)

Con `pnpm start` corriendo:

- **iPhone**: abre la app **Cámara**, apunta al QR → toca la notificación → se abre en Expo Go.
- **Android**: abre **Expo Go** → "Scan QR code" → escanea el QR.

> ⚠️ Tu teléfono y tu computador deben estar en la **misma red WiFi**.
> Si no conectan (WiFi corporativa, redes que aíslan dispositivos), lo natural sería
> `pnpm start --tunnel`, pero hoy falla siempre con `remote gone away`. Lo que sí funciona es
> levantar un túnel aparte contra el puerto de Metro —por ejemplo `cloudflared tunnel --url
> http://localhost:8081`— y arrancar Metro con `EXPO_PACKAGER_PROXY_URL` apuntando a esa URL, para
> que el QR sirva fuera de la red local.
>
> ⚠️ Desde el 10-09-2026, el Expo Go de iPhone (SDK 57) exige que el computador que sirve la app y
> el teléfono tengan sesión iniciada **con la misma cuenta de Expo**: `npx expo login` en el
> computador y la misma cuenta en Expo Go. Si no, la app no abre y avisa cuál de los dos falta.

### Otros comandos

```bash
pnpm run ios      # compila y abre en el Simulador de iOS  (requiere Xcode, solo en Mac)
pnpm run android  # compila y abre en un emulador de Android (requiere Android Studio)
pnpm run web      # abre la app en el navegador
```

Estos son atajos definidos en `package.json` que equivalen a `expo start --ios`, `--android` y `--web`. Hacen lo mismo que presionar `i` / `a` / `w` en el menú de `pnpm start`.

### Comandos útiles para arreglar problemas

```bash
pnpm start -c              # arranca limpiando la caché de Metro (útil si ves errores raros)
rm -rf node_modules && pnpm install   # reinstala todo desde cero
npx expo-doctor            # revisa que las versiones de las dependencias sean compatibles
```

## Estructura

- `App.tsx` — el armazón: el estado de la app, la navegación entre las cinco secciones y los overlays.
- `screens/` — una pantalla por archivo: Stock, Clientes, Informes, Transferencias, MotorPrecios,
  FichaAuto, AltaVehiculo, InformeAutosave, Kpis y Subastas.
- `components/shared.tsx` — las piezas que se repiten entre pantallas.
- `src/` — modelo y lógica: `data.ts` (tipos y datos semilla), `helpers.ts`, `pricing.ts`,
  `informes.ts`, `transferencias.ts`, `autosave.ts`, `storage.ts`, `styles.ts`, `theme.ts`, `ui.tsx`.
- `src/inspection/` — el módulo de inspección con IA, hoy desconectado de la app.
- `app.json` — configuración de Expo. `index.ts` — punto de entrada.
