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
  const { assertVerticalOrExit } = await import('../lib/startup');
  assertVerticalOrExit();
  return { exit, log };
}

describe('assertVerticalOrExit', () => {
  it('continúa con un nicho válido', async () => {
    const { exit } = await runWith('demo');
    expect(exit).not.toHaveBeenCalled();
  });

  it.each(['nope', ''])('termina con código 1 si el nicho es %j', async (vertical) => {
    const { exit, log } = await runWith(vertical);
    expect(exit).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Nicho desconocido'));
  });
});
