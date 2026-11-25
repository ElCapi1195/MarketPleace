import type { Metadata } from 'next';
import { Screen } from '@/features/account/components/form';
import { TwoFactorForm } from '@/features/account/components/two-factor-form';
import { safeNext } from '@/features/account/lib/safe-next';

export const metadata: Metadata = { title: 'Segundo paso' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TwoFactorPage({ searchParams }: PageProps) {
  const { siguiente } = await searchParams;
  return (
    <Screen title="Segundo paso" intro="Abre tu aplicación de códigos y escribe el que muestra ahora.">
      <TwoFactorForm next={safeNext(typeof siguiente === 'string' ? siguiente : null)} />
    </Screen>
  );
}
