import Link from 'next/link';
import { MONTH, progressAt } from '../lib/corridor';
import type { ArrivalView } from '../model';
import { MaterialObject } from './material-object';

export function ArrivalList({ arrivals }: { arrivals: ArrivalView[] }) {
  return (
    <ul className="flex flex-col">
      {arrivals.map((arrival) => (
        <li key={arrival.id} className="border-b-2 border-surface">
          <Link href={`/preventas/${arrival.id}`} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-4 gap-y-1 py-4 sm:grid-cols-[7rem_1fr_12rem_8rem] sm:gap-x-6">
            <MaterialObject
              shape={arrival.shape}
              color={arrival.color}
              progress={progressAt((arrival.monthsAhead - 1) * (MONTH / 2))}
              className="row-span-2 w-full sm:row-span-1"
            />
            <span className="min-w-0">
              <span className="block text-lg leading-tight font-bold">{arrival.name}</span>
              <span className="block">{arrival.storeName}</span>
            </span>
            <span className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1">
              Llega en {arrival.monthName.toLowerCase()}
              <span className="block">
                Quedan {arrival.remaining} de {arrival.capacity}
              </span>
            </span>
            <span className="col-start-3 row-start-1 text-right font-display text-lg font-extrabold sm:col-start-4">{arrival.price}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
