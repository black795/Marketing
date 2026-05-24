/** Herramienta activa del timeline — afecta a qué hace el click/drag sobre un clip. */

export type TimelineTool =
  | 'select'    // click selecciona, drag sobre clip lo mueve
  | 'trim'      // drag sobre los handles cambia durationFrames
  | 'split'     // click en cualquier punto divide la escena
  | 'hand';     // drag desplaza el viewport

export interface ToolMeta {
  id: TimelineTool;
  label: string;
  emoji: string;
  shortcut: string; // ej. "V", "T", "S", "H"
  description: string;
}

export const TOOLS: ToolMeta[] = [
  { id: 'select', label: 'Selección', emoji: '🖱️', shortcut: 'V', description: 'Click selecciona, drag mueve.' },
  { id: 'trim', label: 'Trim', emoji: '✂️', shortcut: 'T', description: 'Arrastra los bordes para acortar la escena.' },
  { id: 'split', label: 'Split', emoji: '🪓', shortcut: 'S', description: 'Click sobre un clip para dividirlo en dos.' },
  { id: 'hand', label: 'Pan', emoji: '🖐️', shortcut: 'H', description: 'Drag desplaza el viewport.' },
];
