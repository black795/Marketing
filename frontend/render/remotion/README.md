# /render/remotion

Placeholder para una futura integración con [Remotion](https://www.remotion.dev/).

El plan original (ver memoria) contempla un proyecto Remotion separado que
consuma el `timeline.json` + scene graph y renderice composiciones React → MP4.
Aquí vivirían:

- Tipos puente entre `Scene` y `Composition` de Remotion.
- Hooks para inicializar el preview en `@remotion/player`.
- Adapter para que el backend pueda invocar `@remotion/renderer` como
  alternativa al pipeline ffmpeg actual.

El scene graph ya contiene todo lo necesario (camera presets, effects,
caption animations, color-grade como SceneEffect). El día que se monte el
proyecto Remotion, estos adapters serán pegamento corto.
