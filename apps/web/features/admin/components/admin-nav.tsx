'use client';

import { can } from '@marketplace/core';
import { useEffect, useState } from 'react';
import { SectionNav } from '@/features/shared/components/section-nav';
import { get } from '@/lib/client-api';

interface Session {
  user: { platformRole?: string };
}

/** Solo decide qué pestañas se ven: el permiso real lo comprueba la API. */
export function AdminNav() {
  const [role, setRole] = useState('');
  useEffect(() => {
    let active = true;
    void get<Session | null>('/api/auth/get-session').then((result) => {
      if (active && result.ok) setRole(result.data?.user.platformRole ?? '');
    });
    return () => {
      active = false;
    };
  }, []);
  const links = [
    ...(can(role, 'listing.moderate') ? [{ href: '/admin', label: 'Resumen' }] : []),
    ...(can(role, 'catalog.manage') ? [{ href: '/admin/productos', label: 'Productos' }] : []),
    ...(can(role, 'listing.moderate') ? [{ href: '/admin/moderacion', label: 'Moderación' }] : []),
    ...(can(role, 'store.verify') ? [{ href: '/admin/tiendas', label: 'Tiendas' }] : []),
    ...(can(role, 'reservation.intervene') ? [{ href: '/admin/reservas', label: 'Reservas' }] : []),
    ...(can(role, 'listing.moderate') ? [{ href: '/admin/denuncias', label: 'Denuncias' }] : []),
    ...(can(role, 'user.suspend') ? [{ href: '/admin/usuarios', label: 'Cuentas' }] : []),
    ...(can(role, 'audit.read') ? [{ href: '/admin/auditoria', label: 'Auditoría' }] : []),
  ];
  return links.length > 0 ? <SectionNav label="Administración" links={links} /> : <div className="h-11" />;
}
