/**
 * Plan de edición del proyecto — espejo del schema de backend/services/edit-plan.ts.
 * Se persiste en `assets/output/<projectId>/edit-plan.json` y lo lee tanto
 * el Hub de Assets como cada editor al abrirse.
 */
export interface EditPlan {
  projectId: string;
  editorId: string;
  presetId: string | null;
  prompt: string;
  tags: string[];
  /** scene_numbers a INCLUIR. Vacío = incluir todas. */
  includedScenes: number[];
  /** Orden custom de escenas (scene_numbers). Vacío = orden natural. */
  sceneOrder: number[];
  captionTemplateId: string | null;
  updatedAt: string;
}
