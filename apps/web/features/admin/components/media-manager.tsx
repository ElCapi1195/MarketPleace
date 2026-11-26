'use client';

import type { AdminProduct, MediaView } from '@marketplace/contracts';
import { imageTypes } from '@marketplace/contracts';
import { useRef, useState, type DragEvent } from 'react';
import { ModelViewer } from '@/features/catalog/components/model-viewer';
import { adminMediaUrl } from '@/features/catalog/lib/media';
import { patch, remove, upload } from '@/lib/client-api';
import { checkFile } from '../lib/files';
import { adminMessage } from '../lib/messages';

interface MediaManagerProps {
  product: AdminProduct;
  maxImages: number;
  onChange: () => Promise<void>;
}

const small = 'min-h-11 cursor-pointer rounded-lg border-2 border-ink px-3 font-bold disabled:cursor-not-allowed disabled:opacity-40';

function ImageItem({ image, index, count, run }: { image: MediaView; index: number; count: number; run: (task: () => Promise<string | null>) => void }) {
  const save = (changes: object) =>
    run(async () => {
      const result = await patch(`/api/admin/media/${image.id}`, changes);
      return result.ok ? null : adminMessage(result);
    });
  return (
    <li className="flex flex-col gap-2">
      <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-surface">
        <img src={adminMediaUrl(image, 'sm')} alt={image.alt} className="size-full object-cover" />
        {index === 0 && <span className="absolute top-2 left-2 rounded-lg bg-accent px-2 py-0.5 text-sm font-bold text-ink">Portada</span>}
      </div>
      <input
        aria-label={`Descripción de la foto ${index + 1}`}
        placeholder="Describe la foto"
        defaultValue={image.alt}
        maxLength={160}
        onBlur={(event) => event.target.value.trim() !== image.alt && save({ alt: event.target.value })}
        className="h-11 w-full rounded-lg border-2 border-ink/30 bg-background px-3"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-label={`Mover la foto ${index + 1} antes`} disabled={index === 0} onClick={() => save({ position: index - 1 })} className={small}>
          ←
        </button>
        <button type="button" aria-label={`Mover la foto ${index + 1} después`} disabled={index === count - 1} onClick={() => save({ position: index + 1 })} className={small}>
          →
        </button>
        <button
          type="button"
          aria-label={`Eliminar la foto ${index + 1}`}
          onClick={() =>
            run(async () => {
              const result = await remove(`/api/admin/media/${image.id}`);
              return result.ok ? null : adminMessage(result);
            })
          }
          className={`${small} ml-auto`}
        >
          Eliminar
        </button>
      </div>
    </li>
  );
}

/** Fotos y modelo 3D de un producto: subir, ordenar, describir y eliminar. */
export function MediaManager({ product, maxImages, onChange }: MediaManagerProps) {
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const images = product.media.filter(({ kind }) => kind === 'IMAGE');
  const model = product.media.find(({ kind }) => kind === 'MODEL');

  const run = async (task: () => Promise<string | null>) => {
    const error = await task();
    setErrors(error ? [error] : []);
    await onChange();
  };

  const send = async (files: File[]) => {
    if (pending !== null) return;
    const problems: string[] = [];
    // De una en una: el orden en que se eligen es el orden en que quedan.
    for (const [index, file] of files.entries()) {
      const check = checkFile(file);
      if (!check.ok) {
        problems.push(check.error);
        continue;
      }
      setPending(`Subiendo ${file.name} (${index + 1} de ${files.length})…`);
      const result = await upload(`/api/admin/products/${product.id}/media`, file, check.type);
      if (!result.ok) problems.push(`${file.name}: ${adminMessage(result)}`);
      await onChange();
    }
    setPending(null);
    setErrors(problems);
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    void send([...event.dataTransfer.files]);
  };

  return (
    <section aria-labelledby="media-title" className="flex flex-col gap-5">
      <h2 id="media-title" className="font-display text-2xl font-extrabold">
        Fotos y modelo 3D
      </h2>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={`flex flex-col items-center gap-3 rounded-3xl border-3 border-dashed border-ink/50 px-6 py-8 text-center ${over ? 'bg-accent' : 'bg-surface'}`}
      >
        <p className="text-lg font-bold">Arrastra aquí las fotos o el modelo 3D</p>
        <p>
          JPEG, PNG o WebP de hasta 10 MB, y un modelo .glb de hasta 15 MB. {images.length} de {maxImages} fotos.
        </p>
        <input
          ref={input}
          type="file"
          multiple
          accept={[...imageTypes, '.glb'].join(',')}
          aria-label="Elegir archivos"
          className="sr-only"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = '';
            void send(files);
          }}
        />
        <button type="button" disabled={pending !== null} onClick={() => input.current?.click()} className="min-h-12 cursor-pointer rounded-xl bg-ink px-6 font-bold text-background disabled:cursor-wait disabled:opacity-60">
          Elegir archivos
        </button>
        <p role="status" className="min-h-6">
          {pending}
        </p>
      </div>
      {errors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-xl border-2 border-ink p-3 font-medium">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {images.length > 0 && (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image, index) => (
            <ImageItem key={image.id} image={image} index={index} count={images.length} run={run} />
          ))}
        </ul>
      )}
      {model && (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-bold">Modelo 3D</h3>
          <div className="aspect-4/3 overflow-hidden rounded-3xl bg-surface">
            <ModelViewer key={model.id} url={adminMediaUrl(model, 'model')} label={product.title} />
          </div>
          <button
            type="button"
            onClick={() =>
              run(async () => {
                const result = await remove(`/api/admin/media/${model.id}`);
                return result.ok ? null : adminMessage(result);
              })
            }
            className={`${small} self-start`}
          >
            Eliminar el modelo
          </button>
        </div>
      )}
    </section>
  );
}
