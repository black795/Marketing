const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface UploadClipResponse {
  success: boolean;
  url: string;
  filename: string;
  originalName: string;
  size: number;
  error?: string;
}

export async function uploadClip(projectId: string, file: File): Promise<UploadClipResponse> {
  const formData = new FormData();
  // projectId va PRIMERO por si multer lo lee del body, y también como query
  // string como fallback (multer parsea fields en orden y a veces el field va
  // a procesarse despues que el archivo).
  formData.append('projectId', projectId);
  formData.append('file', file);

  const qs = `projectId=${encodeURIComponent(projectId)}`;
  const response = await fetch(`${BACKEND_URL}/api/clips/upload?${qs}`, {
    method: 'POST',
    body: formData, // fetch automáticamente establece el Content-Type correcto para FormData
  });

  if (!response.ok) {
    let errorMsg = `Error HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMsg = errorData.error;
      }
    } catch {
      // Ignorar si no se puede parsear JSON
    }
    throw new Error(`Error al subir el clip: ${errorMsg}`);
  }

  return response.json();
}
