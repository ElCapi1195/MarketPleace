'use client';

import type { MediaView } from '@marketplace/contracts';
import { useRef, useState } from 'react';
import { mediaUrl } from '../lib/media';
import { ModelViewer } from './model-viewer';
import { ProductImage } from './product-image';

interface GalleryProps {
  title: string;
  images: readonly MediaView[];
  model: MediaView | null;
}

const tab = 'relative size-18 shrink-0 cursor-pointer overflow-hidden rounded-xl border-3 sm:size-22';

export function Gallery({ title, images, model }: GalleryProps) {
  const [selected, setSelected] = useState(0);
  const [inThreeD, setInThreeD] = useState(false);
  const zoom = useRef<HTMLDialogElement>(null);
  const image = images[selected] ?? images[0] ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative aspect-4/3 overflow-hidden rounded-3xl bg-surface">
        {inThreeD && model ? (
          <ModelViewer url={mediaUrl(model, 'model')} label={title} />
        ) : (
          <button type="button" aria-label="Ampliar la foto" onClick={() => zoom.current?.showModal()} className="block size-full cursor-zoom-in">
            <ProductImage image={image} alt={image?.alt || title} sizes="(min-width: 1024px) 700px, 100vw" priority className="size-full" />
          </button>
        )}
        {model && !inThreeD && (
          <button
            type="button"
            onClick={() => setInThreeD(true)}
            className="absolute bottom-4 left-4 min-h-12 cursor-pointer rounded-xl bg-ink px-5 font-bold text-background"
          >
            Ver en 3D
          </button>
        )}
      </div>
      {(images.length > 1 || model) && (
        <div role="group" aria-label="Fotos y modelo" className="flex gap-3 overflow-x-auto p-1">
          {images.map((item, index) => {
            const current = !inThreeD && index === selected;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={`Foto ${index + 1}`}
                aria-pressed={current}
                onClick={() => {
                  setSelected(index);
                  setInThreeD(false);
                }}
                className={`${tab} ${current ? 'border-ink' : 'border-transparent'}`}
              >
                <ProductImage image={item} alt="" sizes="88px" className="size-full" />
              </button>
            );
          })}
          {model && (
            <button
              type="button"
              aria-label="Modelo 3D"
              aria-pressed={inThreeD}
              onClick={() => setInThreeD(true)}
              className={`${tab} bg-surface font-display text-xl font-extrabold ${inThreeD ? 'border-ink' : 'border-transparent'}`}
            >
              3D
            </button>
          )}
        </div>
      )}
      <dialog ref={zoom} aria-label={title} className="m-auto max-h-[95dvh] max-w-[95vw] rounded-2xl bg-background p-0 backdrop:bg-ink/80">
        {image && <img src={mediaUrl(image, 'lg')} alt={image.alt || title} className="max-h-[95dvh] w-auto max-w-full" />}
        <button
          type="button"
          onClick={() => zoom.current?.close()}
          className="absolute top-3 right-3 min-h-11 cursor-pointer rounded-xl bg-ink px-4 font-bold text-background"
        >
          Cerrar
        </button>
      </dialog>
    </div>
  );
}
