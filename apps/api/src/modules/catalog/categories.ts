interface Category {
  slug: string;
  parent?: string | undefined;
}

/** Categoría y todas sus descendientes; vacío si no existe. */
export function categoryBranch(categories: readonly Category[], root: string): string[] {
  if (!categories.some(({ slug }) => slug === root)) return [];
  const branch = [root];
  // El nicho se valida sin ciclos, así que el recorrido siempre termina.
  for (const current of branch) {
    for (const { slug, parent } of categories) if (parent === current) branch.push(slug);
  }
  return branch;
}
