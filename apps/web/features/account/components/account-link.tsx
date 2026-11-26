'use client';

import { can } from '@marketplace/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { get } from '@/lib/client-api';

interface Session {
  user: { platformRole?: string };
}

const link = 'py-2 font-medium hover:underline';

/** Primera pantalla de administración que su rol puede usar. */
function adminHome(role: string): string | null {
  return can(role, 'listing.moderate') ? '/admin' : null;
}

/** Enlaces de la cabecera. Mientras no se sabe si hay sesión, lleva a entrar, que siempre es válido. */
export function AccountLink() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let active = true;
    // Responde null sin sesión, en lugar de un 401 en cada página para quien solo mira.
    void get<Session | null>('/api/auth/get-session').then((result) => {
      if (active) setSession(result.ok ? result.data : null);
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  // Solo decide qué enlace se ve: el permiso real lo comprueba la API.
  const admin = adminHome(session?.user.platformRole ?? '');
  return (
    <span className="flex gap-5">
      {admin && (
        <Link href={admin} className={link}>
          Administrar
        </Link>
      )}
      {session && (
        <Link href="/reservas" className={link}>
          Reservas
        </Link>
      )}
      <Link href={session ? '/cuenta' : '/entrar'} className={link}>
        {session ? 'Cuenta' : 'Entrar'}
      </Link>
    </span>
  );
}
