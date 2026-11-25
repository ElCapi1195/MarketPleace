'use client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-prose flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">No pudimos cargar esta página</h1>
      {error.digest && <p className="text-sm opacity-80">Referencia: {error.digest}</p>}
      <button type="button" onClick={reset} className="w-fit rounded-lg bg-surface px-4 py-2">
        Reintentar
      </button>
    </main>
  );
}
