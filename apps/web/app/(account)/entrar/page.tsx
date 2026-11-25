import type { Metadata } from 'next';
import Link from 'next/link';
import { Screen } from '@/features/account/components/form';
import { SignInForm } from '@/features/account/components/sign-in-form';
import { safeNext } from '@/features/account/lib/safe-next';

export const metadata: Metadata = { title: 'Entrar' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SignInPage({ searchParams }: PageProps) {
  const { siguiente, verificado, error } = await searchParams;
  return (
    <Screen title="Entrar">
      {verificado !== undefined && (
        <p role="status" className="rounded-xl bg-surface p-4">
          {error === undefined ? 'Correo verificado. Ya puedes entrar.' : 'El enlace venció o no es válido. Entra y te enviaremos otro.'}
        </p>
      )}
      <SignInForm next={safeNext(typeof siguiente === 'string' ? siguiente : null)} />
      <p>
        <Link href="/recuperar" className="font-bold underline">
          Olvidé mi contraseña
        </Link>
      </p>
      <p>
        ¿Aún no tienes cuenta?{' '}
        <Link href="/registro" className="font-bold underline">
          Crear cuenta
        </Link>
      </p>
    </Screen>
  );
}
