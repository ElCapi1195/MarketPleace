import type { VerticalConfig } from '@marketplace/verticals';

type Attribute = VerticalConfig['categories'][number]['attributes'][number];
type Value = string | number | boolean;

function accepts(attribute: Attribute, value: Value): boolean {
  switch (attribute.type) {
    case 'text':
      return typeof value === 'string' && value.length > 0 && value.length <= attribute.maxLength;
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && value >= (attribute.min ?? -Infinity) && value <= (attribute.max ?? Infinity);
    case 'select':
      return attribute.options.some((option) => option.value === value);
  }
}

/** Claves que no cumplen lo que el nicho define para la categoría; null si la categoría no existe. */
export function invalidAttributes(
  { categories }: VerticalConfig,
  categorySlug: string,
  attributes: Readonly<Record<string, Value>>,
): string[] | null {
  const category = categories.find(({ slug }) => slug === categorySlug);
  if (!category) return null;
  const known = new Map(category.attributes.map((attribute) => [attribute.key, attribute]));
  const wrong = Object.entries(attributes)
    .filter(([key, value]) => {
      const attribute = known.get(key);
      return attribute === undefined || !accepts(attribute, value);
    })
    .map(([key]) => key);
  const missing = category.attributes.filter(({ key, required }) => required && !Object.hasOwn(attributes, key)).map(({ key }) => key);
  return [...wrong, ...missing];
}
