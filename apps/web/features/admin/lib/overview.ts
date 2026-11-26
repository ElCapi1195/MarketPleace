import type { Overview } from '@marketplace/contracts';

export interface Tile {
  label: string;
  count: number;
  href: string;
}

/** Tarjetas del resumen: solo las que el servidor devolvió, que dependen del rol. */
export function overviewTiles(overview: Overview): Tile[] {
  const tiles: (Tile | null)[] = [
    overview.pendingStores === undefined ? null : { label: 'Tiendas por verificar', count: overview.pendingStores, href: '/admin/tiendas?estado=SUBMITTED' },
    overview.pendingProducts === undefined ? null : { label: 'Productos por revisar', count: overview.pendingProducts, href: '/admin/moderacion' },
    overview.openReports === undefined ? null : { label: 'Denuncias de productos', count: overview.openReports, href: '/admin/denuncias' },
    overview.reservationReports === undefined ? null : { label: 'Denuncias de reservas', count: overview.reservationReports, href: '/admin/denuncias' },
    overview.refundsPending === undefined ? null : { label: 'Devoluciones pendientes', count: overview.refundsPending, href: '/admin/reservas?devolucion=pendiente' },
  ];
  return tiles.filter((tile): tile is Tile => tile !== null);
}
