/** Política CSP por petición. En desarrollo, React y la recarga en caliente necesitan eval y estilos inline. */
export function buildCsp(nonce: string, isDev: boolean): string {
  const style = isDev ? "'self' 'unsafe-inline'" : `'self' 'nonce-${nonce}'`;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src ${style}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? ' ws:' : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}
