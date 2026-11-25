/** Datos para configurar la aplicación de códigos: el URI para el QR y la clave para escribirla a mano. */
export function parseTotpUri(uri: string): { uri: string; groups: string[] } | null {
  if (!uri.startsWith('otpauth://totp/')) return null;
  const secret = new URL(uri).searchParams.get('secret');
  return secret ? { uri, groups: secret.match(/.{1,4}/g) ?? [] } : null;
}
