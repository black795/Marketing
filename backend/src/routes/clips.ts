import fs from 'node:fs';
import path from 'node:path';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { createLogger } from '../services/logger';

const router = Router();
const log = createLogger('clips-api');

// Directorio base de assets
const ASSETS_DIR = path.resolve(__dirname, '..', '..', '..', 'assets');

// Configuración de multer
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // El projectId puede venir en el body o query
    const projectId = req.body.projectId || req.query.projectId || 'unassigned';
    // Sanitizar projectId
    const safeProjectId = String(projectId).replace(/[^a-zA-Z0-9_-]/g, '_');
    
    const dir = path.join(ASSETS_DIR, safeProjectId, 'clips');
    
    // Crear el directorio si no existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    // Generar un nombre único para evitar colisiones
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Preservar la extensión original
    const ext = path.extname(file.originalname);
    // Limpiar el nombre base
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

// Filtro de tipos de archivo
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'video/mp4', 'video/quicktime', 'video/webm',
    'image/jpeg', 'image/png', 'image/webp'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se permiten MP4, MOV, WebM y JPEG/PNG/WEBP.`));
  }
};

// Límites de subida (ej. 100MB)
const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } 
});

// POST /api/clips/upload
router.post('/clips/upload', (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  
  // Usar single('file') para capturar el archivo subido
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      log.error('Multer error', { requestId }, err);
      return res.status(400).json({ success: false, error: `Error al subir el archivo: ${err.message}`, requestId });
    } else if (err) {
      log.error('Upload error', { requestId }, err);
      return res.status(400).json({ success: false, error: err.message, requestId });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se envió ningún archivo', requestId });
    }

    const projectId = req.body.projectId || req.query.projectId || 'unassigned';
    const safeProjectId = String(projectId).replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Construir la URL local relativa al directorio de assets servido
    // Express sirve ASSETS_DIR bajo la ruta '/assets'
    const fileUrl = `/assets/${safeProjectId}/clips/${req.file.filename}`;
    
    log.info(`Clip subido exitosamente: ${fileUrl}`, { requestId });
    
    res.status(200).json({
      success: true,
      requestId,
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  });
});

export default router;
