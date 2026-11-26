import { describe, expect, it } from 'vitest';
import { availableDecisions } from '../features/admin/lib/decisions';
import { checklist, documentProblem } from '../features/store/lib/documents';
import { currentStep, storeStatusLabel } from '../features/store/lib/status';

describe('availableDecisions', () => {
  const actions = (status: Parameters<typeof availableDecisions>[0], role: string) => availableDecisions(status, role).map(({ action }) => action);

  it('ofrece solo lo que el estado y el rol permiten', () => {
    expect(actions('SUBMITTED', 'moderator')).toEqual(['start_review']);
    expect(actions('IN_REVIEW', 'moderator')).toEqual(['approve', 'request_info', 'reject']);
    expect(actions('APPROVED', 'moderator')).toEqual([]);
    expect(actions('APPROVED', 'admin')).toEqual(['suspend']);
    expect(actions('SUSPENDED', 'admin')).toEqual(['reinstate']);
    expect(actions('IN_REVIEW', 'customer')).toEqual([]);
    expect(actions('REJECTED', 'admin')).toEqual([]);
  });

  it('solo aprobar y empezar no piden motivo', () => {
    expect(availableDecisions('IN_REVIEW', 'admin').filter(({ needsReason }) => !needsReason).map(({ action }) => action)).toEqual(['approve']);
  });
});

describe('documentos', () => {
  const requirements = [
    { key: 'a', label: 'A', required: true },
    { key: 'b', label: 'B', required: false },
  ];

  it('une lo exigido con lo subido', () => {
    const list = checklist(requirements, [{ id: '1', key: 'b', type: 'application/pdf', bytes: 1, createdAt: '' }]);
    expect(list.map(({ key, document }) => [key, document?.id ?? null])).toEqual([['a', null], ['b', '1']]);
  });

  it.each([
    [{ name: 'a.pdf', type: 'application/pdf', size: 10 }, null],
    [{ name: 'a.docx', type: 'application/msword', size: 10 }, 'PDF'],
    [{ name: 'a.pdf', type: 'application/pdf', size: 0 }, 'vacío'],
    [{ name: 'a.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }, '10 MB'],
  ])('%j', (file, reason) => {
    const problem = documentProblem(file);
    if (reason === null) expect(problem).toBeNull();
    else expect(problem).toContain(reason);
  });
});

describe('estado de la tienda', () => {
  it('sitúa cada estado en su paso', () => {
    expect(currentStep('NEEDS_INFO')).toBe(0);
    expect(currentStep('IN_REVIEW')).toBe(2);
    expect(currentStep('REJECTED')).toBeNull();
    expect(storeStatusLabel('SUSPENDED')).toBe('Suspendida');
  });
});
