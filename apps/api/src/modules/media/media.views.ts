import type { MediaView } from '@marketplace/contracts';
import type { ProductMedia } from '../../generated/prisma/client.js';

export function mediaView({ id, kind, alt, position, width, height, bytes }: ProductMedia): MediaView {
  return { id, kind: kind === 'MODEL' ? 'MODEL' : 'IMAGE', alt, position, width, height, bytes };
}
