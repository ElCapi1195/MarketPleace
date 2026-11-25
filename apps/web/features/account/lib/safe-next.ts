const HOME = '/cuenta';
const ACCESS = ['/entrar', '/registro', '/recuperar', '/restablecer', '/segundo-paso'];

/** Destino tras entrar. Solo rutas internas: una URL ajena serviría para suplantar el sitio. */
export function safeNext(value: string | null | undefined): string {
  // Los navegadores tratan \ como / y eliminan los caracteres de control: "/\malo" o "/<tab>/malo" saldrían del sitio.
  if (!value || !/^\/(?![/\\])[^\\\p{Cc}]*$/u.test(value)) return HOME;
  const path = value.split(/[?#]/)[0];
  return ACCESS.some((screen) => path === screen) ? HOME : value;
}
