export interface PathStep {
  label: string;
  title: string;
  text: string;
  progress: number;
}

interface PathInput {
  reviewHours: number;
  monthName: string;
  deposit: string | null;
}

/** Pasos que verá el cliente; el de depósito solo existe si la tienda lo pide. */
export function buildPath({ reviewHours, monthName, deposit }: PathInput): PathStep[] {
  return [
    { label: 'Pides', title: 'Envías tu solicitud', text: 'No pagas nada y puedes cancelarla.', progress: 0.08 },
    {
      label: 'Revisan',
      title: 'La tienda la revisa',
      text: `Responde en un máximo de ${reviewHours} horas. Si cambia el precio o la fecha, tú decides.`,
      progress: 0.4,
    },
    ...(deposit === null
      ? []
      : [
          {
            label: 'Depósito',
            title: 'Dejas el depósito',
            text: `Pagas ${deposit} directo a la tienda, fuera de esta web. Ella lo anota en tu reserva.`,
            progress: 0.62,
          },
        ]),
    {
      label: 'La traen',
      title: 'La tienda lo pide',
      text: `Llegada estimada: ${monthName.toLowerCase()}. Te avisamos si la fecha cambia.`,
      progress: 0.82,
    },
    { label: 'Es tuyo', title: 'Lo recoges', text: 'Pagas el resto en la tienda y te lo llevas.', progress: 1 },
  ];
}
