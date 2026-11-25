// Clases literales completas para que Tailwind las detecte.
const STEPS = [
  'font-thin [font-stretch:72%]',
  'font-extralight [font-stretch:75%]',
  'font-light [font-stretch:78%]',
  'font-normal [font-stretch:82%]',
  'font-medium [font-stretch:86%]',
  'font-semibold [font-stretch:90%]',
  'font-bold [font-stretch:94%]',
  'font-extrabold [font-stretch:97%]',
  'font-black [font-stretch:100%]',
] as const;

/** Peso y anchura del título según el avance: de trazo fino a letra llena. */
export function materialText(progress: number): string {
  const index = Math.round(Math.min(1, Math.max(0, progress)) * (STEPS.length - 1));
  return `font-display transition-[font-weight,font-stretch] duration-300 motion-reduce:transition-none ${STEPS[index]}`;
}
