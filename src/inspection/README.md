# Inspección de Recepción con IA — módulo desconectado

**Está en el repo pero no es alcanzable desde la app desde el 1-09-2026** (ronda 3, punto 3).

## Por qué salió

Lo pidió David Ventura (CTO de Autored) en la reunión del 21-08: *"la que podéis sacar es la parte
de las inspecciones, porque ellos ya compraron el auto, no le van a hacer más inspecciones"*, y al
cerrar: *"aparte que va a ser complejo, un módulo grande y todo de meter, entonces yo sacaría el de
inspección y agregamos esto otro"*. El argumento es de **alcance**, no de que el módulo esté mal:
la pantalla que ocupaba se fue a Informes y Transferencias, que es lo que el compraventero usa a
diario.

**Queda un cabo suelto anotado en el plan.** Eitan marcó en la misma reunión que la inspección
sirve *antes* de comprar (*"el tema es que si la quieren usar para antes de comprar"*) y Mauro
tampoco estuvo seguro. Puede volver cuando salgan con compraventeros reales.

## Qué se desenchufó, exactamente

- La tarjeta de la ficha del auto (`screens/FichaAuto.tsx`, donde quedó el comentario).
- En `App.tsx`: el estado `inspectingCar`, el render de `InspectionScreen`, `handleGuardarInspeccion`,
  la entrada en el back-handler y la entrada en `hasOpenSurface`.

## Qué se dejó a propósito

- **Los seis archivos de este módulo, intactos.**
- **El campo `Car.inspeccion`** (`src/data.ts`). Sacarlo obliga a migrar el estado guardado en los
  teléfonos y no hay ninguna ganancia. Ningún auto semilla lo trae.
- **Los estilos `insp*`** (`src/styles.ts`), que son solo los de la tarjeta.

## Cómo volver a enchufarlo

Deshacer las cinco cosas de la lista de arriba. Es media hora, no un rediseño.

Ojo con lo de siempre: necesita `EXPO_PUBLIC_ANTHROPIC_API_KEY` en el `.env` y **hoy no está
puesta**, así que ni antes de sacarlo llegaba a analizar nada en la demo — `config.ts` bloquea el
análisis sin ella. Quién paga la IA de la app y con qué llave sigue siendo una pregunta abierta con
Autored.
