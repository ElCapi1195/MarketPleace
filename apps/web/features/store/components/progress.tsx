import type { StoreDetail } from '@marketplace/contracts';
import { currentStep, steps, storeStatusLabel } from '../lib/status';

/** Dónde está la verificación y qué se espera ahora. */
export function Progress({ store }: { store: Pick<StoreDetail, 'status' | 'events'> }) {
  const current = currentStep(store.status);
  const last = store.events[0];
  const notice = ['NEEDS_INFO', 'REJECTED', 'SUSPENDED'].includes(store.status) ? last?.reason : '';
  return (
    <section aria-label="Estado de la tienda" className="flex flex-col gap-4 rounded-3xl bg-surface p-5 sm:p-7">
      <p className="text-xl font-bold">{storeStatusLabel(store.status)}</p>
      {current !== null && (
        <ol className="grid gap-2 sm:auto-cols-fr sm:grid-flow-col sm:gap-4">
          {steps.map((step, index) => {
            const done = index < current || store.status === 'APPROVED';
            return (
              <li key={step} aria-current={index === current ? 'step' : undefined} className="flex items-center gap-3 sm:flex-col sm:items-start">
                <span aria-hidden="true" className={`h-2 w-10 rounded-full sm:w-full ${done ? 'bg-ink' : index === current ? 'bg-accent' : 'bg-ink/20'}`} />
                <span className={index === current ? 'font-bold' : ''}>
                  {step}
                  {done && <span className="sr-only"> (hecho)</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {notice && (
        <p role="status" className="rounded-xl border-2 border-ink bg-background p-4 whitespace-pre-line">
          {notice}
        </p>
      )}
    </section>
  );
}
