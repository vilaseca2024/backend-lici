import * as path from 'path';
import * as os   from 'os';

/**
 * Resuelve LOCAL_STORAGE_PATH correctamente en Windows y Linux.
 *
 * Problema: en Windows, si LOCAL_STORAGE_PATH=/var/www/storage (ruta Unix),
 * path.resolve() genera C:\var\www\storage y si se vuelve a pasar por
 * path.resolve/join queda C:\C:\var\www\storage.
 *
 * Solución: detectar si el valor del .env es una ruta Unix en Windows
 * y convertirla a ruta Windows relativa al disco actual, O simplemente
 * usar process.cwd()/storage como fallback seguro.
 *
 * Uso:
 *   import { resolveStoragePath } from '../common/resolve-storage-path';
 *   this.localStorageRoot = resolveStoragePath(config.get('LOCAL_STORAGE_PATH'));
 */
export function resolveStoragePath(envValue?: string): string {
  const fallback = path.join(process.cwd(), 'storage');

  if (!envValue) return fallback;

  const isWindows = os.platform() === 'win32';

  if (isWindows) {
    // Detectar ruta Unix pura: empieza con / pero NO con letra de unidad (C:/)
    const isUnixPath = /^\//.test(envValue) && !/^[A-Za-z]:/.test(envValue);

    if (isUnixPath) {
      // Convertir /var/www/storage → C:\var\www\storage
      // Usamos la unidad raíz del proceso actual (process.cwd()[0])
      const drive = process.cwd().slice(0, 2); // ej: "C:"
      const winPath = envValue.replace(/\//g, '\\');
      return path.normalize(`${drive}${winPath}`);
    }

    // Ya es ruta Windows — solo normalizar separadores
    return path.normalize(envValue);
  }

  // Linux/Mac — usar directamente
  return path.normalize(envValue);
}