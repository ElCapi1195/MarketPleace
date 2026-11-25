import { material } from '../lib/corridor';
import type { Shape } from '../model';

interface MaterialShapeProps {
  shape: Shape;
  color: string;
  progress: number;
  /** Desactívalo cuando el progreso ya cambia de forma continua. */
  animated?: boolean;
}

const TRANSITION = 'transition-[fill-opacity] duration-300 motion-reduce:transition-none';

/** Capas del objeto. Solo atributos de presentación: la CSP bloquea los estilos inline. */
export function MaterialShape({ shape, color, progress, animated = true }: MaterialShapeProps) {
  const transition = animated ? TRANSITION : '';
  const { body, detail, light, dash } = material(progress);
  return (
    <g strokeDasharray={dash} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" className="stroke-ink">
      <path d={shape.body} fill={color} fillOpacity={body} className={transition} />
      <path d={shape.detail} fillOpacity={detail} className={`fill-ink ${transition}`} />
      <path d={shape.light} fill="#ffffff" fillOpacity={light} className={transition} />
    </g>
  );
}

export function MaterialObject({ className, ...shape }: MaterialShapeProps & { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={className} aria-hidden="true">
      <MaterialShape {...shape} />
    </svg>
  );
}
