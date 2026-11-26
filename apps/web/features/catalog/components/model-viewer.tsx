'use client';

import { useEffect, useRef, useState } from 'react';

/** Visor 3D. La librería se descarga al abrirlo, no con la página. */
export function ModelViewer({ url, label }: { url: string; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    const start = async () => {
      const { mountViewer } = await import('../lib/viewer');
      if (!active || !canvas.current) return;
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const release = await mountViewer(canvas.current, url, { still });
      if (active) {
        dispose = release;
        setState('ready');
      } else release();
    };
    start().catch(() => {
      if (active) setState('error');
    });
    return () => {
      active = false;
      dispose?.();
    };
  }, [url]);

  return (
    <div className="relative size-full">
      <canvas
        ref={canvas}
        tabIndex={0}
        role="img"
        aria-label={`Modelo 3D de ${label}. Usa las flechas para girarlo.`}
        className="block size-full cursor-grab touch-none active:cursor-grabbing"
      />
      {state !== 'ready' && (
        <p role="status" className="absolute inset-0 flex items-center justify-center px-6 text-center font-medium">
          {state === 'loading' ? 'Cargando el modelo…' : 'Tu navegador no pudo mostrar el modelo. Mira las fotos.'}
        </p>
      )}
    </div>
  );
}
