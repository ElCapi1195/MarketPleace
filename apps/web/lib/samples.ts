/** Aviso de datos ficticios. Exige una activación explícita para no aparecer en producción por descuido. */
export function samplesEnabled(): boolean {
  return process.env.SHOW_SAMPLES === 'true';
}
