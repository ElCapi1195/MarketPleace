import type { MediaView } from '@marketplace/contracts';
import { withBasePath } from '@/lib/base-path';

/** Dirección pública de un archivo. Los borradores solo los ve la administración. */
export const mediaUrl = ({ id }: Pick<MediaView, 'id'>, variant: 'sm' | 'lg' | 'model') => withBasePath(`/api/media/${id}/${variant}`);

/** Archivo de un borrador, a través de la API de quien puede verlo. */
export const privateMediaUrl = (base: string, { id }: Pick<MediaView, 'id'>, variant: 'sm' | 'lg' | 'model') => withBasePath(`${base}/media/${id}/${variant}`);
