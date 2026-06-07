/**
 * Helpers compartidos para subir/redimensionar imágenes en el cliente.
 *
 * Centraliza la lógica que estaba duplicada en `ReferenceImagesUploader` y
 * `AvatarImageDropzone`: generar ids estables, cargar un File como
 * HTMLImageElement y redimensionarlo a un data: URL vía canvas. Los nuevos
 * uploaders (p. ej. referencias del Carousel Generator) reutilizan esto en vez
 * de re-implementarlo.
 */

export const SUPPORTED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type SupportedImageMime = (typeof SUPPORTED_IMAGE_MIMES)[number];

export function isSupportedImageMime(mime: string): mime is SupportedImageMime {
  return (SUPPORTED_IMAGE_MIMES as readonly string[]).includes(mime);
}

/** id estable para keys de React / referencias. */
export function makeImageId(prefix = 'img'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/** Carga un File como HTMLImageElement, revocando el objectURL al terminar. */
export function loadImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`No se pudo leer ${file.name}`));
    };
    img.src = url;
  });
}

export interface ResizedImage {
  /** data: URL listo para mandar al backend / GPT Image 2. */
  dataUrl: string;
  /** tamaño aproximado del payload tras resize (bytes). */
  bytes: number;
  width: number;
  height: number;
}

/**
 * Redimensiona la imagen para que su lado más largo sea `maxSide` px (sin
 * agrandar imágenes pequeñas) y la devuelve como data: URL.
 *
 * @param quality Calidad JPEG (ignorada para PNG). Default 0.9.
 */
export async function resizeImageToDataUrl(
  file: File,
  maxSide: number,
  quality = 0.9
): Promise<ResizedImage> {
  const img = await loadImageElement(file);
  const longest = Math.max(img.width, img.height);
  const scale = longest > maxSide ? maxSide / longest : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  ctx.drawImage(img, 0, 0, w, h);

  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(mime, mime === 'image/png' ? undefined : quality);

  // base64 ≈ 4/3 del binario.
  const base64Len = dataUrl.length - (dataUrl.indexOf(',') + 1);
  const bytes = Math.floor((base64Len * 3) / 4);
  return { dataUrl, bytes, width: w, height: h };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
