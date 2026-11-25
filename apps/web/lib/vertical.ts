import { loadVertical, type VerticalConfig } from '@marketplace/verticals';

let cached: VerticalConfig | undefined;

/** Nicho activo. Solo servidor: `VERTICAL` no se expone al navegador. */
export function getVertical(): VerticalConfig {
  cached ??= loadVertical(process.env.VERTICAL ?? '');
  return cached;
}
