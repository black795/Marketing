/**
 * Validación de variables de entorno del gateway.
 *
 * Se ejecuta una vez al arrancar (server.ts). El objetivo es fallar rápido
 * y con un mensaje claro si falta un secreto, en lugar de descubrirlo a
 * mitad de una generación.
 *
 * Importante sobre seguridad: el `REPLICATE_API_TOKEN` vive SOLO aquí, en
 * el backend (y en el .env raíz que usa el worker Python). El frontend
 * nunca lo recibe — habla únicamente con este gateway. Nunca lo expongas
 * con el prefijo NEXT_PUBLIC_.
 */
import { createLogger } from './logger';

const log = createLogger('env');

export interface EnvReport {
  ok: boolean;
  /** Variables obligatorias que faltan. */
  missing: string[];
  /** Avisos no fatales (variables opcionales ausentes, etc.). */
  warnings: string[];
}

/**
 * Verifica las variables de entorno. No lanza: devuelve un reporte para que
 * el caller decida (típicamente: loguear y, si falta algo crítico, abortar).
 */
export function validateEnv(): EnvReport {
  const missing: string[] = [];
  const warnings: string[] = [];

  // --- Obligatorias ---
  const replicateToken = (process.env.REPLICATE_API_TOKEN || '').trim();
  if (!replicateToken) {
    missing.push('REPLICATE_API_TOKEN');
  } else if (!/^r8_/.test(replicateToken)) {
    // Los tokens de Replicate empiezan con "r8_". No es fatal, pero avisa.
    warnings.push(
      'REPLICATE_API_TOKEN no tiene el prefijo "r8_" habitual — ¿token correcto?'
    );
  }

  // --- Opcionales con default ---
  if (!process.env.PYTHON_WORKER_URL) {
    warnings.push('PYTHON_WORKER_URL no definido — usando http://localhost:5000');
  }
  if (!process.env.PORT) {
    warnings.push('PORT no definido — usando 4000');
  }

  return { ok: missing.length === 0, missing, warnings };
}

/**
 * Valida el entorno y loguea el resultado. Si falta algo obligatorio,
 * registra el error y devuelve false (el caller debería abortar el arranque).
 */
export function assertEnvOrReport(): boolean {
  const report = validateEnv();
  for (const w of report.warnings) log.warn(w);

  if (!report.ok) {
    log.error(
      `Faltan variables de entorno obligatorias: ${report.missing.join(', ')}. ` +
        'Configúralas en backend/.env (ver backend/.env.example).'
    );
    return false;
  }
  log.info('variables de entorno validadas correctamente');
  return true;
}
