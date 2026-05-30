// Tim Koda OS - Mock data (simulates backend responses for the prototype)

export type SceneStatus = 'done' | 'active' | 'pending';

export type Scene = {
  scene_number: number;
  scene_title: string;
  narration: string;
  image_prompt: string;
  duration: number;
  status: SceneStatus;
  image: string | null;
};

export const MOCK_PROJECT_TITLE = 'El Estudio de Ceramica';
export const MOCK_STYLE =
  'Editorial bright - iPhone candid - luz natural lateral';

export const MOCK_CHARACTERS = [
  {
    name: 'Luna',
    description:
      'Mujer 28, pelo castano largo, overol denim sobre camiseta blanca, mirada concentrada.',
  },
  {
    name: 'Mateo',
    description:
      'Hombre 32, barba corta, sueter de lana gris, manos manchadas de arcilla.',
  },
];

export const MOCK_SCENES: Scene[] = [
  {
    scene_number: 1,
    scene_title: 'Hook - La pieza rota',
    narration:
      'Luna mira la pieza recien salida del horno. Esta rajada. Silencio.',
    image_prompt:
      'Editorial mujer joven con overol denim, taller de ceramica con luz dorada lateral, expresion de frustracion contenida, manos cubiertas de arcilla seca, primer plano, lente 35mm, grano sutil iPhone candid.',
    duration: 3,
    status: 'done',
    image: 'luna-1',
  },
  {
    scene_number: 2,
    scene_title: 'Walkthrough - Volver al barro',
    narration:
      'Las manos vuelven a la rueda. La camara las sigue como si fueran lo unico que importa.',
    image_prompt:
      'Plano detalle de manos amasando arcilla humeda sobre rueda de ceramica, dedos manchados, luz calida desde ventana, profundidad de campo corta.',
    duration: 5,
    status: 'done',
    image: 'hands-2',
  },
  {
    scene_number: 3,
    scene_title: 'Walkthrough - El centro',
    narration:
      'Luna respira. La arcilla encuentra el centro. La pieza nace de nuevo.',
    image_prompt:
      'Mujer joven concentrada centrando arcilla en rueda de ceramica, taller en penumbra editorial, luz lateral suave, expresion de flow, plano medio frontal.',
    duration: 6,
    status: 'done',
    image: 'luna-3',
  },
  {
    scene_number: 4,
    scene_title: 'Walkthrough - Mateo entra',
    narration:
      'Mateo aparece con dos tazas humeantes. No dice nada. Solo deja una al lado.',
    image_prompt:
      'Hombre joven con sueter de lana gris colocando taza de te junto a rueda de ceramica, vapor visible, taller acogedor, luz calida de tarde, plano medio.',
    duration: 4,
    status: 'active',
    image: null,
  },
  {
    scene_number: 5,
    scene_title: 'CTA - La pieza terminada',
    narration:
      'Luna sostiene la pieza nueva contra la ventana. Sonrie leve. Texto: tu siguiente intento siempre vale.',
    image_prompt:
      'Mujer joven sosteniendo bowl de ceramica recien terminado a contraluz de ventana, sonrisa contenida, polvo de arcilla en el aire, plano medio editorial.',
    duration: 5,
    status: 'pending',
    image: null,
  },
  {
    scene_number: 6,
    scene_title: 'Outro - Hands close',
    narration: 'Detalle de las manos guardando las herramientas. Fade out.',
    image_prompt:
      'Plano detalle de manos guardando esponjas y palillos de ceramica en una caja de madera, luz de atardecer, sombras largas, textura iPhone candid.',
    duration: 3,
    status: 'pending',
    image: null,
  },
];

export type SceneImageMeta = { hue: number; label: string; title: string };

export const SCENE_IMAGES: Record<string, SceneImageMeta> = {
  'luna-1': { hue: 18, label: 'L1', title: 'Luna - rajada' },
  'hands-2': { hue: 30, label: 'H2', title: 'Manos' },
  'luna-3': { hue: 220, label: 'L3', title: 'Centro' },
  'mateo-4': { hue: 200, label: 'M4', title: 'Mateo' },
  'luna-5': { hue: 12, label: 'L5', title: 'Bowl' },
  'hands-6': { hue: 35, label: 'H6', title: 'Outro' },
};

export type StylePreset = {
  id: string;
  name: string;
  tag: string;
  colors: string[];
  description: string;
};

export const STYLES_PRESETS: StylePreset[] = [
  {
    id: 'editorial-bright',
    name: 'Editorial Bright',
    tag: 'Default',
    colors: ['#F4E5D0', '#E2B894', '#8B5A3C'],
    description: 'Magazine candid, luz natural lateral, paleta calida.',
  },
  {
    id: 'cinematic-noir',
    name: 'Cinematic Noir',
    tag: 'Mood',
    colors: ['#0B0F1A', '#1A3A6E', '#FF5C5C'],
    description: 'Negros profundos, acento rojo, contraste alto.',
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    tag: 'Soft',
    colors: ['#FFE5EC', '#D4E5FF', '#FFF4E0'],
    description: 'Suave, dreamy, luz difusa, paleta candy.',
  },
  {
    id: 'studio-tech',
    name: 'Studio Tech',
    tag: 'Tech',
    colors: ['#07080B', '#4C7DFF', '#FFFFFF'],
    description: 'UI / producto, fondos planos, tipografia grande.',
  },
  {
    id: 'kodak-1995',
    name: "Kodak Portra '95",
    tag: 'Film',
    colors: ['#D4A574', '#7B5D3E', '#3D2914'],
    description: 'Grano 35mm, halacion calida, profundidad rica.',
  },
  {
    id: 'high-fashion',
    name: 'High Fashion',
    tag: 'Bold',
    colors: ['#FFFFFF', '#000000', '#FF2937'],
    description: 'Contraste maximo, blanco y negro, acento rojo.',
  },
];

export type ModelOption = {
  value: string;
  label: string;
  badge: string | null;
  desc: string;
};

export const MODEL_OPTIONS: ModelOption[] = [
  {
    value: 'nano-banana-pro',
    label: 'Nano Banana Pro',
    badge: 'Recomendado',
    desc: 'Google - Fotorealismo + identidad consistente',
  },
  {
    value: 'nano-banana-2',
    label: 'Nano Banana 2',
    badge: 'Beta',
    desc: 'Google - Iteracion mas rapida',
  },
  {
    value: 'chatgpt-image-2',
    label: 'ChatGPT Image 2',
    badge: null,
    desc: 'OpenAI - Buen siguiendo prompts complejos',
  },
];
