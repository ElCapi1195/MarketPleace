import type { MediaView } from '@marketplace/contracts';

/** Dirección pública de un archivo. Los borradores solo los ve la administración. */
export const mediaUrl = ({ id }: Pick<MediaView, 'id'>, variant: 'sm' | 'lg' | 'model') => `/api/media/${id}/${variant}`;

export const adminMediaUrl = ({ id }: Pick<MediaView, 'id'>, variant: 'sm' | 'lg' | 'model') => `/api/admin/media/${id}/${variant}`;
