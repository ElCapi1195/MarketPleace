import { getVertical } from '@/lib/vertical';

export function HowItWorks() {
  const { reservations } = getVertical();
  const steps = [
    ['Pides sin pagar', 'Envías tu solicitud desde la ficha del producto. Nadie te cobra nada.'],
    ['La tienda la revisa', `Responde en un máximo de ${reservations.reviewHours} horas, incluso si tiene que traerlo de su proveedor.`],
    ['Acuerdas y recoges', 'El depósito y el pago los haces directo con la tienda, fuera de esta web.'],
  ];
  return (
    <section aria-labelledby="como" className="rounded-3xl bg-surface p-6 sm:p-10">
      <h2 id="como" className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        Así se reserva
      </h2>
      <ol className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-10">
        {steps.map(([title, text], index) => (
          <li key={title} className="flex gap-4 sm:flex-col sm:gap-3">
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-extrabold text-background">
              {index + 1}
            </span>
            <span>
              <span className="block text-lg font-bold">{title}</span>
              <span>{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
