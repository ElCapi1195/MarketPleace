import type { Metadata } from 'next';
import Link from 'next/link';
import { Screen } from '@/features/account/components/form';
import { SignUpForm } from '@/features/account/components/sign-up-form';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default function SignUpPage() {
  return (
    <Screen title="Crear cuenta" intro="Con ella podrás solicitar preventas y seguir su avance.">
      <SignUpForm />
      <p>
        ¿Ya tienes cuenta?{' '}
        <Link href="/entrar" className="font-bold underline">
          Entrar
        </Link>
      </p>
    </Screen>
  );
}
