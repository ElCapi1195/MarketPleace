import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReservationPath } from '@/features/arrivals/components/reservation-path';
import { buildPath } from '@/features/arrivals/lib/path';
import { getArrival } from '@/features/arrivals/source';
import { getVertical } from '@/lib/vertical';

type ArrivalPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: ArrivalPageProps): Promise<Metadata> {
  const arrival = getArrival((await params).id);
  return arrival ? { title: arrival.name } : {};
}

export default async function ArrivalPage({ params }: ArrivalPageProps) {
  const arrival = getArrival((await params).id);
  if (!arrival) notFound();

  const { reservations } = getVertical();
  const steps = buildPath({ ...arrival, reviewHours: reservations.reviewHours });

  return (
    <main className="mx-auto max-w-6xl px-4 pt-4 pb-16 sm:px-8">
      <ReservationPath
        name={arrival.name}
        summary={`${arrival.price} en ${arrival.storeName}. Llega en ${arrival.monthName.toLowerCase()}. Quedan ${arrival.remaining} de ${arrival.capacity} cupos.`}
        shape={arrival.shape}
        color={arrival.color}
        steps={steps}
      >
        <div className="flex flex-col gap-2">
          <button type="button" disabled aria-describedby="request-note" className="min-h-14 rounded-lg border-2 border-dashed border-ink px-6 text-lg font-bold">
            Solicitar preventa
          </button>
          <p id="request-note">Las solicitudes se abrirán cuando estén disponibles las cuentas. Solicitar no te cobrará nada.</p>
        </div>
      </ReservationPath>
    </main>
  );
}
