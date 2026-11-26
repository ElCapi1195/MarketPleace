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

  return (
    <span className="flex gap-5">
      {/* Solo decide qué enlace se ve: el permiso real lo comprueba la API. */}
      {can(session?.user.platformRole ?? '', 'catalog.manage') && (
        <Link href="/admin/productos" className={link}>
          Administrar
        </Link>
      )}
      <Link href={session ? '/cuenta' : '/entrar'} className={link}>
        {session ? 'Mi cuenta' : 'Entrar'}
      </Link>
    </span>
  );
}
