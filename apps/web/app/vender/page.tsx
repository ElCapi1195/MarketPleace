import type { Metadata } from 'next';
import Link from 'next/link';
import { steps } from '@/features/store/lib/status';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Vende aquí' };

const reasons = [
  ['Tú apruebas cada reserva', 'Nadie te compromete: revisas cada solicitud antes de pedir nada a tu proveedor.'],
  ['Cobras directo', 'El depósito y el pago los acuerdas con tu cliente. La web no retiene tu dinero.'],
  ['Compartes mostrador con tiendas verificadas', 'Comprobamos a cada tienda, y eso les da confianza a tus clientes.'],
];

export default function SellPage() {
  const { storeVerification, brand } = getVertical();
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-14 px-4 pt-6 pb-20 sm:px-6">
      <section className="grid gap-8 rounded-3xl bg-ink p-7 text-background sm:p-12 lg:grid-cols-[3fr_2fr] lg:items-end">
        <div className="flex flex-col gap-5">
          <h1 className="font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.04] font-extrabold tracking-tight text-balance">Abre tu tienda en {brand.name}</h1>
          <p className="max-w-prose text-xl">Publica lo que tienes y lo que viene. Tus clientes reservan y tú decides.</p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <Link href="/tienda/nueva" className="inline-flex min-h-14 items-center rounded-xl bg-accent px-7 text-lg font-bold text-ink">
            Solicitar mi tienda
          </Link>
          <Link href="/tienda" className="py-2 font-bold underline">
            Ya tengo una
          </Link>
        </div>
      </section>
      <ul className="grid gap-8 sm:grid-cols-3">
        {reasons.map(([title, text]) => (
          <li key={title} className="flex flex-col gap-1.5">
            <h2 className="text-xl font-bold text-balance">{title}</h2>
            <p>{text}</p>
          </li>
        ))}
      </ul>
      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="steps-title" className="rounded-3xl bg-surface p-6 sm:p-10">
          <h2 id="steps-title" className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Cómo te verificamos
          </h2>
          <ol className="mt-5 flex flex-col gap-4">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-4 text-lg">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink font-display font-extrabold text-background">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="needs-title" className="rounded-3xl bg-surface p-6 sm:p-10">
          <h2 id="needs-title" className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Ten a mano
          </h2>
          <ul className="mt-5 flex list-disc flex-col gap-3 pl-5 text-lg">
            {storeVerification.documents.map(({ key, label, required }) => (
              <li key={key}>
                {label}
                {!required && ' (opcional)'}
              </li>
            ))}
            <li>Una aplicación de códigos en tu móvil, para el segundo paso</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
