'use client';

import { useState, type ReactNode } from 'react';
import type { PathStep } from '../lib/path';
import type { Shape } from '../model';
import { MaterialObject } from './material-object';
import { materialText } from './material-text';

interface ReservationPathProps {
  name: string;
  summary: string;
  shape: Shape;
  color: string;
  steps: PathStep[];
  children?: ReactNode;
}

/** Muestra el camino de la reserva; cada paso completa un poco más el objeto. */
export function ReservationPath({ name, summary, shape, color, steps, children }: ReservationPathProps) {
  const [selected, setSelected] = useState(0);
  const step = steps[selected] ?? steps[0];
  if (!step) return null;

  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className="rounded-xl bg-surface py-6 lg:py-16">
        <MaterialObject shape={shape} color={color} progress={step.progress} className="mx-auto block w-full max-w-lg px-6" />
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <h1 className={`text-[clamp(2rem,5vw,3.5rem)] leading-[1.03] tracking-tight ${materialText(step.progress)}`}>{name}</h1>
        <p className="text-lg">{summary}</p>
        <div role="group" aria-label="Pasos de la reserva" className="grid auto-cols-fr grid-flow-col gap-1.5">
          {steps.map(({ label }, index) => (
            <button
              key={label}
              type="button"
              aria-pressed={index === selected}
              onClick={() => setSelected(index)}
              className={`min-h-14 cursor-pointer rounded-lg border-2 border-ink px-0.5 text-xs leading-tight font-bold sm:text-sm ${
                index === selected ? 'bg-ink text-background' : index < selected ? 'bg-accent' : 'border-dashed'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div aria-live="polite" className="min-h-24">
          <h2 className="text-xl font-bold">
            Paso {selected + 1} de {steps.length}: {step.title}
          </h2>
          <p className="mt-1">{step.text}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
