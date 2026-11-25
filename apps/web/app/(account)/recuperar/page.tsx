import type { Metadata } from 'next';
import { Screen } from '@/features/account/components/form';
import { ForgotForm } from '@/features/account/components/recovery-forms';

export const metadata: Metadata = { title: 'Recuperar acceso' };

export default function ForgotPage() {
  return (
    <Screen title="Recuperar acceso" intro="Te enviaremos un enlace para elegir otra contraseña.">
      <ForgotForm />
    </Screen>
  );
}
