import type { CatalogHome, CatalogPage, ProductDetail } from '@marketplace/contracts';
import { apiBaseUrl } from './startup';

/** Lectura del catálogo desde el servidor. Null si no existe; cualquier otro fallo llega a `error.tsx`. */
async function read<T>(path: string): Promise<T | null> {
  const response = await fetch(`${apiBaseUrl()}/api/catalog${path}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`El catálogo respondió ${response.status}`);
  return (await response.json()) as T;
}

async function required<T>(path: string): Promise<T> {
  const data = await read<T>(path);
  if (data === null) throw new Error('El catálogo no está disponible');
  return data;
}

export const getHome = () => required<CatalogHome>('/home');
export const searchCatalog = (query: string) => required<CatalogPage>(`/products?${query}`);
export const getProduct = (slug: string) => read<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
