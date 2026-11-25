// El orden importa: Edge y Opera también dicen ser Chrome, y Chrome dice ser Safari.
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];
const SYSTEMS: [RegExp, string][] = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad/, 'iOS'],
  [/Mac OS X/, 'macOS'],
  [/Linux/, 'Linux'],
];

const find = (list: [RegExp, string][], agent: string) => list.find(([pattern]) => pattern.test(agent))?.[1];

export function describeAgent(agent: string | null | undefined): string {
  const browser = find(BROWSERS, agent ?? '');
  const system = find(SYSTEMS, agent ?? '');
  return browser && system ? `${browser} en ${system}` : 'Dispositivo desconocido';
}
