import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function runWith(vertical: string) {
  vi.stubEnv('VERTICAL', vertical);
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { assertConfigOrExit } = await import('../lib/startup');
  assertConfigOrExit();
  return { exit, log };
}

describe('assertConfigOrExit', () => {
  it('continúa con un nicho válido', async () => {
    const { exit } = await runWith('demo');
    expect(exit).not.toHaveBeenCalled();
  });

  it.each(['nope', ''])('termina con código 1 si el nicho es %j', async (vertical) => {
    const { exit, log } = await runWith(vertical);
    expect(exit).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Nicho desconocido'));
  });

  it('en producción exige la dirección interna de la API', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_INTERNAL_URL', undefined);
    const { exit, log } = await runWith('demo');
    expect(exit).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('API_INTERNAL_URL'));
  });
});
