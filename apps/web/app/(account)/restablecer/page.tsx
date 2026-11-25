import type { Metadata } from 'next';
import { Screen } from '@/features/account/components/form';
import { ResetForm } from '@/features/account/components/recovery-forms';

export const metadata: Metadata = { title: 'Elegir contraseña' };

export default function ResetPage() {
  return (
    <Screen title="Elegir contraseña">
      <ResetForm />
    </Screen>
  );
}
