import type { MediaView } from '@marketplace/contracts';
import { mediaUrl } from '../lib/media';

interface ProductImageProps {
  image: MediaView | null;
  /** Texto alternativo si la foto no tiene uno propio; vacío cuando el título ya está al lado. */
  alt: string;
  /** Ancho que ocupará en pantalla, para que el navegador elija el archivo. */
  sizes: string;
  priority?: boolean;
  className?: string;
}

export function ProductImage({ image, alt, sizes, priority = false, className = '' }: ProductImageProps) {
  if (!image) return <div role="img" aria-label="Sin foto" className={`bg-surface ${className}`} />;
  return (
    <img
      src={mediaUrl(image, 'sm')}
      srcSet={`${mediaUrl(image, 'sm')} 640w, ${mediaUrl(image, 'lg')} 1600w`}
      sizes={sizes}
      alt={alt}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={`object-cover ${className}`}
    />
  );
}
