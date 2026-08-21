# Lee esto primero

**Antes de tocar cualquier cosa, lee [`CONTEXTO-P1.md`](./CONTEXTO-P1.md).** Está en la raíz del
repo y es autosuficiente: qué es la app, qué se implementó en agosto de 2026, qué cambios del
modelo rompen código que ya existía, qué quedó a medias, y qué falta por hacer.

Sin ese archivo vas a tropezar con al menos tres cosas: que `App.tsx` ya se partió en un archivo por
pantalla (hoy son ~1.700 líneas y el resto vive en `screens/`); que `diasStock`, `Customer.interes` y `Customer.roles` fueron
eliminados a propósito y reemplazados; y que el margen de un auto **nunca** se calcula restando
`costoAdquisicion` a mano, sino con `costoBase(car)`.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.
Desde el 21-08-2026 este repo sirve **solo SDK 54**: es el único que abre en el Expo Go del App Store.

## Ramas

- `sdk54` — **la rama de trabajo desde el 21-08-2026.** Expo SDK 54.
- `sdk54-p2` y `sdk57` — la Ronda 2, 14 commits que divergieron el 16-08 en `ea11605`. No están en
  `sdk54` y no se perdieron. Juntarlas es un merge real: 6 archivos, ~167 líneas.
- `main` — **no es la app.** Es el HTML viejo del challenge original de este repo.

## Antes de commitear

`./node_modules/.bin/tsc --noEmit` tiene que dar limpio.

**No uses `npx tsc`**: en la máquina de Eitan el wrapper de nvm hace que devuelva **exit 1 sin
imprimir ningún error**, y parece que el proyecto está roto cuando no lo está. El binario directo
da exit 0 de verdad.

Dos cosas que el compilador **no** atrapa y conviene revisar a mano:

- **Un `s.<estilo>` mal escrito se ignora en silencio.** No falla, simplemente no aplica el estilo.
  Vale la pena cruzar los `s.algo` de la pantalla que tocaste contra `src/styles.ts`.
- **Cambiar los datos semilla de `src/data.ts` no basta.** El estado guardado en el teléfono pisa a
  `data.ts`, así que hay que **subir `STORAGE_KEY` en `src/storage.ts`** (va en `v3`) o las semillas
  nuevas no aparecen nunca. Subirla descarta lo que el usuario haya movido probando.
