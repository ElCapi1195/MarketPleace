const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') ?? '';

/** Prefija rutas internas usadas fuera de Next Link (fetch, formularios y redirecciones del navegador). */
export function withBasePath(path: string): string {
  if (!basePath || !path.startsWith('/') || path.startsWith('//')) return path;
  if (path === basePath || path.startsWith(`${basePath}/`) || path.startsWith(`${basePath}?`) || path.startsWith(`${basePath}#`)) return path;
  return `${basePath}${path}`;
}
