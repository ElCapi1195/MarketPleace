import { documentTypes, MAX_DOCUMENT_BYTES, type StoreDocumentView } from '@marketplace/contracts';

export interface Requirement {
  key: string;
  label: string;
  required: boolean;
}

/** Documentos exigidos con lo ya subido para cada uno. */
export function checklist(requirements: readonly Requirement[], documents: readonly StoreDocumentView[]) {
  return requirements.map((requirement) => ({ ...requirement, document: documents.find(({ key }) => key === requirement.key) ?? null }));
}

/** Aviso previo; el servidor vuelve a comprobar el contenido. Null si el archivo sirve. */
export function documentProblem({ name, type, size }: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (!(documentTypes as readonly string[]).includes(type)) return `${name}: usa un PDF o una imagen JPEG, PNG o WebP.`;
  if (size === 0) return `${name} está vacío.`;
  if (size > MAX_DOCUMENT_BYTES) return `${name} supera ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.`;
  return null;
}
