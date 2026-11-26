import type { ListingKind } from '@marketplace/contracts';

export interface PathStep {
  title: string;
  text: string;
}

interface PathInput {
  kind: ListingKind;
  reviewHours: number;
  arrival: string;
  deposit: string | null;
}

/** Pasos de la reserva tal como los vivirá el cliente. */
export function buildPath({ kind, reviewHours, arrival, deposit }: PathInput): PathStep[] {
  const steps: PathStep[] = [
    { title: 'Envías tu solicitud', text: 'No pagas nada y puedes cancelarla.' },
    { title: 'La tienda la revisa', text: `Responde en un máximo de ${reviewHours} horas. Si cambia el precio o la fecha, tú decides.` },
  ];
  if (deposit !== null) {
    steps.push({ title: 'Dejas el depósito', text: `Pagas ${deposit} directo a la tienda, fuera de esta web. Ella lo anota en tu reserva.` });
  }
  if (kind === 'PREORDER') steps.push({ title: 'La tienda lo pide', text: `${arrival}. Te avisamos si la fecha cambia.` });
  steps.push(
    kind === 'SERVICE'
      ? { title: 'Coordinan la cita', text: 'Acuerdas con la tienda cuándo llevar tu equipo y pagas allí.' }
      : { title: 'Lo recoges', text: deposit === null ? 'Pagas en la tienda y te lo llevas.' : 'Pagas el resto en la tienda y te lo llevas.' },
  );
  return steps;
}
