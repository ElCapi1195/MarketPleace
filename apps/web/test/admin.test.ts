import { describe, expect, it } from 'vitest';
import { auditQuery, describeAction } from '../features/admin/lib/audit';
import { overviewTiles } from '../features/admin/lib/overview';
import { reportReasonLabel, reportReasons } from '../features/admin/lib/reports';

describe('overviewTiles', () => {
  it('muestra solo lo que el rol puede atender, con enlace', () => {
    expect(overviewTiles({ pendingProducts: 2, openReports: 0, pendingStores: 1 }).map(({ href, count }) => [href, count])).toEqual([
      ['/admin/tiendas?estado=SUBMITTED', 1],
      ['/admin/moderacion', 2],
      ['/admin/denuncias', 0],
    ]);
  });

  it('con todo, añade reservas', () => {
    const tiles = overviewTiles({ pendingStores: 0, pendingProducts: 0, openReports: 0, reservationReports: 3, refundsPending: 1 });
    expect(tiles.map(({ href }) => href)).toEqual(['/admin/tiendas?estado=SUBMITTED', '/admin/moderacion', '/admin/denuncias', '/admin/denuncias', '/admin/reservas?devolucion=pendiente']);
  });
});

describe('auditoría', () => {
  it('construye la consulta solo con los filtros puestos', () => {
    expect(auditQuery({ action: '', actorId: '', targetId: '' }, null)).toBe('limit=50');
    expect(auditQuery({ action: 'reservation.', actorId: ' u1 ', targetId: '' }, 'c1')).toBe('limit=50&action=reservation.&actorId=u1&cursor=c1');
  });

  it('describe las acciones conocidas y deja las demás tal cual', () => {
    expect(describeAction('user.suspended')).toBe('Cuenta suspendida');
    expect(describeAction('algo.raro')).toBe('algo.raro');
  });
});

describe('denuncias', () => {
  it('todas las razones tienen texto', () => {
    for (const reason of reportReasons) expect(reportReasonLabel(reason)).not.toBe(reason);
  });
});
