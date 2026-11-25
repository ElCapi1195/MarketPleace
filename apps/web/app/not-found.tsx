import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-prose flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">No encontramos esta página</h1>
      <Link href="/" className="text-accent underline">
        Volver al inicio
      </Link>
    </main>
  );
}
