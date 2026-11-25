'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { corridorEnd, depthScale, focusOf, itemOpacity, monthTicks, placeItems, progressAt } from '../lib/corridor';
import type { ArrivalView } from '../model';
import { MaterialShape } from './material-object';
import { materialText } from './material-text';

const HEIGHT = 520;
const HORIZON = 0.13;
const INTRO_FROM = 4;
/** Distancia al primer producto al terminar la entrada: casi sólido, para invitar a seguir. */
const INTRO_GAP = 5;

const groundAt = (scale: number) => (0.1 + 0.8 * scale) * HEIGHT;

/** Ancho del escenario en unidades de dibujo, para que la perspectiva se adapte a cada pantalla. */
function useStageWidth() {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(1200);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.height > 0) {
        setWidth(Math.round((entry.contentRect.width / entry.contentRect.height) * HEIGHT));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Tiempo del corredor, con una única entrada animada que se cancela en cuanto la persona actúa. */
function useCorridorTime(introTo: number) {
  const [time, setTime] = useState(INTRO_FROM);
  const frame = useRef(0);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : 1500;
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      const k = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      setTime(INTRO_FROM + (introTo - INTRO_FROM) * (1 - (1 - k) ** 3));
      if (k < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [introTo]);
  const goTo = (value: number) => {
    cancelAnimationFrame(frame.current);
    setTime(value);
  };
  return { time, goTo };
}

export function Corridor({ arrivals }: { arrivals: ArrivalView[] }) {
  const placed = useMemo(() => placeItems(arrivals), [arrivals]);
  const { ref, width } = useStageWidth();
  const { time, goTo } = useCorridorTime(Math.max(INTRO_FROM, (placed[0]?.moment ?? 0) - INTRO_GAP));

  const end = corridorEnd(placed);
  const focus = focusOf(placed, time);
  const ticks = [
    { label: 'Hoy', moment: 0 },
    ...monthTicks(placed).map(({ monthName, moment }) => ({ label: monthName, moment })),
  ];
  const current = ticks.reduce((best, tick) => (Math.abs(tick.moment - time) < Math.abs(best.moment - time) ? tick : best));
  if (!focus) return null;

  return (
    <>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="xMidYMax slice"
        role="group"
        aria-label="Corredor de llegadas"
        className="block h-[clamp(19rem,50vh,34rem)] w-full overflow-hidden"
      >
        <rect x="0" y={HEIGHT * HORIZON} width={width} height={HEIGHT} className="fill-surface" />
        {ticks.slice(1).map(({ label, moment }) => {
          const distance = moment - time;
          if (distance < -3) return null;
          const scale = depthScale(distance);
          const y = groundAt(scale);
          return (
            <g key={moment} aria-hidden="true">
              <line x1="0" x2={width} y1={y} y2={y} strokeWidth="2" className="stroke-ink/25" />
              <text x={width - 20} y={y - 6} textAnchor="end" fontSize={Math.max(14, 38 * Math.min(scale, 1))} className="fill-ink/75 font-display font-semibold">
                {label}
              </text>
            </g>
          );
        })}
        {placed.toReversed().map((item) => {
          const distance = item.moment - time;
          const opacity = itemOpacity(distance);
          if (opacity <= 0.05) return null;
          const scale = depthScale(distance);
          const itemWidth = Math.min(width * 0.5, 360) * scale;
          const x = width / 2 + item.lane * width * Math.min(scale, 1.4) * 1.1 - itemWidth / 2;
          const y = groundAt(scale) - itemWidth * 0.75;
          return (
            <Link key={item.id} href={`/preventas/${item.id}`} aria-label={`${item.name}, llega en ${item.monthName.toLowerCase()}`}>
              <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(itemWidth / 200).toFixed(4)})`} opacity={opacity}>
                <rect width="200" height="150" fill="transparent" />
                <MaterialShape shape={item.shape} color={item.color} progress={progressAt(distance)} animated={false} />
              </g>
            </Link>
          );
        })}
      </svg>

      <section aria-label="Control de tiempo" className="flex flex-col gap-2 bg-ink px-4 pt-4 pb-3 text-background sm:px-8 lg:px-12">
        <label className="flex flex-col gap-2 font-medium">
          Arrastra para adelantar el tiempo
          <input
            type="range"
            min={0}
            max={end}
            step={1}
            value={Math.round(time)}
            onChange={(event) => goTo(Number(event.target.value))}
            aria-valuetext={current.label}
            className="h-8 w-full cursor-pointer accent-accent"
          />
        </label>
        <div className="flex justify-between gap-1">
          {ticks.map((tick) => (
            <button
              key={tick.moment}
              type="button"
              aria-pressed={tick === current}
              onClick={() => goTo(Math.min(tick.moment, end))}
              className={`min-h-11 min-w-11 cursor-pointer px-1 text-sm sm:text-base ${tick === current ? 'font-bold text-accent' : 'font-medium'}`}
            >
              {tick.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-live="polite" className="flex flex-wrap items-center justify-between gap-x-14 gap-y-5 px-4 py-8 sm:px-8 lg:px-12">
        <div className="flex min-w-0 flex-[999_1_24rem] flex-col gap-2">
          <h2 className={`text-[clamp(1.75rem,4vw,3.25rem)] leading-[1.05] tracking-tight ${materialText(progressAt(focus.moment - time))}`}>{focus.name}</h2>
          <p className="text-lg">
            Llega en {focus.monthName.toLowerCase()} a {focus.storeName}. Quedan {focus.remaining} de {focus.capacity} cupos.
          </p>
        </div>
        <div className="flex max-w-96 flex-[1_1_16rem] flex-col gap-3">
          <p className="font-display text-4xl font-extrabold">{focus.price}</p>
          <Link href={`/preventas/${focus.id}`} className="flex min-h-13 items-center justify-center rounded-lg bg-ink px-5 font-bold text-background">
            Ver la preventa
          </Link>
          <p>Solicitarla no te cobra nada. La tienda la revisa antes de comprometerse.</p>
        </div>
      </section>
    </>
  );
}
