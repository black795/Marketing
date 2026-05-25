import PipelineShell from '@/components/editor-pipeline/PipelineShell';

/**
 * Editor — pipeline secuencial cinematográfico.
 *
 * Reemplaza el grid de 6 cards anterior por un wizard de 8 fases:
 *   Setup → Import → Storyboard → Timeline → Style → Captions →
 *   (AI Assistant) → Export.
 *
 * El estado por proyecto vive en `editing-project.json` bajo el campo
 * `pipeline`. Las rutas individuales (`/storyboard`, `/timeline`, `/styles`,
 * `/editor/captions`, `/export`) siguen disponibles para acceso directo;
 * este shell las orquesta en orden, comparte el mismo projectId.
 */
export default function EditorPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const projectId = searchParams.projectId ?? null;
  return <PipelineShell projectId={projectId} />;
}
