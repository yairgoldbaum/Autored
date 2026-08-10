# Lee esto primero

**Antes de tocar cualquier cosa, lee [`CONTEXTO-P1.md`](./CONTEXTO-P1.md).** Está en la raíz del
repo y es autosuficiente: qué es la app, qué se implementó en agosto de 2026, qué cambios del
modelo rompen código que ya existía, qué quedó a medias, y qué falta por hacer.

Sin ese archivo vas a tropezar con al menos tres cosas: que `App.tsx` son ~6.350 líneas en un solo
archivo y hay un plan para partirlo; que `diasStock`, `Customer.interes` y `Customer.roles` fueron
eliminados a propósito y reemplazados; y que el margen de un auto **nunca** se calcula restando
`costoAdquisicion` a mano, sino con `costoBase(car)`.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Ramas

- `sdk57` — la rama de trabajo. Expo SDK 57 + todo lo implementado.
- `sdk54-p2` — el mismo código sobre base SDK 54, para abrir con el Expo Go del App Store.
- `main` — **no es la app.** Es el HTML viejo del challenge original de este repo.

## Antes de commitear

`npx tsc --noEmit` tiene que dar limpio.
