import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from '@/lib/security/csp';

/** Aplica la CSP con un nonce distinto por petición; Next lo lee de la cabecera para sus scripts. */
export function proxy(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const isHttps = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development', isHttps);

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
