/** Se ejecuta al arrancar. Next registra el fallo de este gancho pero sigue vivo, así que se termina el proceso. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertConfigOrExit } = await import('@/lib/startup');
    assertConfigOrExit();
  }
}
