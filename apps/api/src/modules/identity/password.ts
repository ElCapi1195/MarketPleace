import { hash, verify } from '@node-rs/argon2';

export const MIN_LENGTH = 12;
export const MAX_LENGTH = 128;

// Parámetros mínimos recomendados por OWASP para Argon2id, que es el algoritmo por defecto de la librería.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

// Fragmentos que dominan las listas de contraseñas filtradas de 12 o más caracteres.
const COMMON = ['password', 'contrasena', 'contraseña', 'qwerty', 'asdfgh', '123456', 'abcdef', 'iloveyou', 'teamo', 'administrador'];

const normalize = (password: string) => password.normalize('NFKC');

export const hashPassword = (password: string) => hash(normalize(password), OPTIONS);

export async function verifyPassword({ hash: stored, password }: { hash: string; password: string }): Promise<boolean> {
  try {
    return await verify(stored, normalize(password));
  } catch {
    // Un hash ilegible nunca da acceso.
    return false;
  }
}

/** Motivo por el que la contraseña no es aceptable, o null si lo es. */
export function passwordProblem(password: string, email?: string): string | null {
  const plain = normalize(password).toLowerCase();
  if (plain.length < MIN_LENGTH || plain.length > MAX_LENGTH) return `Usa entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres.`;
  if (new Set(plain).size < 5) return 'Usa más caracteres distintos.';

  const common = COMMON.find((word) => plain.includes(word));
  if (common && plain.length - common.length < MIN_LENGTH) return 'Es demasiado común. Prueba con una frase.';

  const local = email?.trim().toLowerCase().split('@')[0] ?? '';
  if (local.length >= 4 && plain.includes(local)) return 'No incluyas tu correo.';
  return null;
}
