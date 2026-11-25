'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { get } from '../lib/api';

/** Enlace de la cabecera. Mientras no se sabe si hay sesión, lleva a entrar, que siempre es válido. */
export function AccountLink() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    // Responde null sin sesión, en lugar de un 401 en cada página para quien solo mira.
    void get<object | null>('/api/auth/get-session').then((result) => {
      if (active) setSignedIn(result.ok && result.data !== null);
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  return (
    <Link href={signedIn ? '/cuenta' : '/entrar'} className="py-2.5 hover:underline">
      {signedIn ? 'Mi cuenta' : 'Entrar'}
    </Link>
  );
}
