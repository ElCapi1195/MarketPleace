export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string | undefined; message: string | undefined };

interface ErrorBody {
  code?: string;
  message?: string;
  error?: { code?: string; message?: string };
}

async function request<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init });
    const body: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: body as T };
    const { code, message, error } = (body ?? {}) as ErrorBody;
    const fallback = response.status === 429 ? 'RATE_LIMITED' : undefined;
    return { ok: false, status: response.status, code: error?.code ?? code ?? fallback, message: error?.message ?? message };
  } catch {
    return { ok: false, status: 0, code: 'NETWORK', message: undefined };
  }
}

const json = (method: string, body: object): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const get = <T>(path: string) => request<T>(path, { method: 'GET' });
export const post = <T>(path: string, body: object) => request<T>(path, json('POST', body));
export const patch = <T>(path: string, body: object) => request<T>(path, json('PATCH', body));
export const remove = (path: string) => request<null>(path, { method: 'DELETE' });

/** Envía un archivo tal cual, sin formulario: el servidor lo lee en flujo tras autorizar. */
export const upload = <T>(path: string, file: Blob, type: string) => request<T>(path, { method: 'POST', headers: { 'content-type': type }, body: file });
