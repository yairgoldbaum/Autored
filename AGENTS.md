# Lee esto primero

**Antes de tocar cualquier cosa, lee [`CONTEXTO-P1.md`](./CONTEXTO-P1.md).** Está en la raíz del
repo y es autosuficiente: qué es la app, qué se implementó en agosto de 2026, qué cambios del
modelo rompen código que ya existía, qué quedó a medias, y qué falta por hacer.

Sin ese archivo vas a tropezar con al menos tres cosas: que `App.tsx` ya se partió en un archivo por
pantalla (hoy son ~1.780 líneas y el resto vive en `screens/`); que `diasStock`, `Customer.interes` y `Customer.roles` fueron
eliminados a propósito y reemplazados; y que el margen de un auto **nunca** se calcula restando
`costoAdquisicion` a mano, sino con `costoBase(car)`.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.
Desde el 10-09-2026 este repo sirve **SDK 54 y SDK 57**: ese día el Expo Go del App Store se
actualizó a 57 y dejó de abrir el 54, que queda para quien no actualizó. Ojo: el Expo Go 57 de
iPhone exige que el Mac y el teléfono tengan sesión con la **misma cuenta de Expo**, así que para
mostrarle la app a alguien de afuera va la versión web por la URL del túnel, no el QR.

## Ramas

- `sdk54` — **la rama de trabajo desde el 21-08-2026.** Expo SDK 54. La Ronda 3 (doce puntos, un
  commit por punto) está acá desde el 2-09-2026, y sus dos pendientes (H5 y H6) se cerraron el
  10-09-2026.
- `sdk57-r3` — la misma app en Expo SDK 57, en el worktree `repos/autored-vendor-sdk57`. Solo
  cambian las dependencias, `app.json` y `absoluteFillObject` → `absoluteFill` (RN 0.86 lo sacó de
  los tipos). **Se trabaja en `sdk54` y lo nuevo se trae acá con `git cherry-pick`.**
- `sdk54-p2` y `sdk57` — la Ronda 2, 14 commits que divergieron el 16-08 en `ea11605`. No están en
  `sdk54` y no se perdieron. Juntarlas es un merge real: 6 archivos, ~167 líneas.
- `main` — **no es la app.** Es el HTML viejo del challenge original de este repo.

## Antes de commitear

`./node_modules/.bin/tsc --noEmit` tiene que dar limpio.

**No uses `npx tsc`**: en la máquina de Eitan el wrapper de nvm hace que devuelva **exit 1 sin
imprimir ningún error**, y parece que el proyecto está roto cuando no lo está. El binario directo
da exit 0 de verdad.

Cuatro cosas que el compilador **no** atrapa y conviene revisar a mano:

- **Dos `setState` seguidos en el mismo handler se pisan si los escribes con el objeto del render.**
  `setX({ ...x, a: 1 })` seguido de `setX({ ...x, b: 2 })` usa el `x` de la clausura las dos veces,
  así que el segundo descarta lo del primero. No hay error ni warning: el campo simplemente no
  queda. Pasó en la Ronda 3 y **la marca de "qué busca el cliente" nunca se pudo elegir**, porque
  elegirla también limpia el modelo. Cuando un handler escribe más de una vez, va la forma de
  función: `setX(prev => ({ ...prev, a: 1 }))`, o una sola escritura con los dos campos.

- **Una pantalla con dos entradas necesita UN estado que las dos llenen.** El visor del informe se
  abre desde la ficha del auto y desde la sección de Informes, pero el sheet de "enviar la copia"
  leía `activeCar`, que solo existe con la ficha abierta: entrando por la sección salía temprano y
  **el botón no hacía nada**, sin error ni aviso. Se arregló con un `envioCar` propio que el handler
  deja puesto venga de donde venga. Cuando agregues una segunda entrada a algo que ya existía,
  revisa de qué estado cuelga lo que hay adentro, y probá **las dos entradas**, no la nueva sola.

- **Un `s.<estilo>` mal escrito se ignora en silencio.** No falla, simplemente no aplica el estilo.
  Vale la pena cruzar los `s.algo` de la pantalla que tocaste contra `src/styles.ts`.
- **Cambiar los datos semilla de `src/data.ts` no basta.** El estado guardado en el teléfono pisa a
  `data.ts`, así que hay que **subir `STORAGE_KEY` en `src/storage.ts`** (va en `v4` desde la Ronda
  3) o las semillas nuevas no aparecen nunca. Subirla descarta lo que el usuario haya movido
  probando. Y si el cambio agrega un campo al modelo, hay que **normalizarlo en `storage.ts`**: un
  estado guardado con la forma vieja se sigue leyendo y llega sin ese campo.

- **Cuidado con la semilla de los datos simulados.** Toda la simulación es determinista y sale de
  `hash(texto)`, que multiplica por 31 acumulando. Eso quiere decir que **dos semillas que solo se
  diferencian al final dan hashes casi iguales**: `hash('ABC123pub0')` y `hash('ABC123pub1')`
  difieren en 1, así que cualquier cosa que después desplace bits (`h >>> 5`, `h >>> 11`) devuelve
  **el mismo valor para las dos**. Pasó en la Ronda 3: las ocho publicaciones del Motor de Precios
  salieron con idéntico kilometraje y ubicación, y parecía un bug de render. **El índice va al
  principio de la semilla** (`hash(\`${i}|${patente}|pub\`)`), para que se propague por todas las
  multiplicaciones.

  El mismo cuidado con la granularidad: un factor de `((h >>> 2) % 8) / 100` tiene ocho valores
  posibles y en una demo de cuatro patentes ya repite. Pasos de medio punto (`% 17 / 200`) y no de
  uno entero.

- **Lo simulado se mira, no se deduce.** Las dos cosas de arriba compilan, no tiran error en
  consola y se ven perfectas en el código. Solo aparecen abriendo la pantalla y mirando las filas.
  Antes de dar por buena una pantalla con datos generados, ábrela en el navegador
  (`http://localhost:8083` con Metro arriba) y revisa **más de un caso**.

  Y si la revisas con un script (Playwright contra el navegador anda bien, con
  `channel="chrome"`): **lo que está adentro de un campo no aparece en el texto de la página.** Un
  `TextInput` es un `<input>` en web y su valor vive en la propiedad `value`, no en el
  `innerText`, así que buscar la patente en el texto del paso 2 dice que no está aunque esté
  escrita en pantalla. Se lee con
  `document.querySelectorAll('input')` y su `.value`. Pasó el 2-09-2026 y por un rato pareció un
  bug de la app que no existía: el falso negativo de la verificación cuesta lo mismo que el bug
  de verdad, y encima manda a arreglar lo que está bien.
