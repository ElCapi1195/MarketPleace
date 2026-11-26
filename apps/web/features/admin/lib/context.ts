import { kinds } from '@/features/catalog/lib/params';
import { getVertical } from '@/lib/vertical';
import type { FormContext } from './product-form';

/** Lo que el formulario necesita del nicho. Solo servidor. */
export function editorContext() {
  const { currency, categories, reservations, listings } = getVertical();
  const context: FormContext = {
    currency,
    categories: categories.map(({ slug, name, attributes }) => ({
      slug,
      name,
      attributes: attributes.map((attribute) => ({
        key: attribute.key,
        label: attribute.label,
        type: attribute.type,
        required: attribute.required,
        ...(attribute.type === 'select' && { options: attribute.options }),
      })),
    })),
  };
  return {
    context,
    kinds: kinds.filter(({ api }) => reservations.kinds.includes(api)).map(({ api, label }) => ({ value: api, label })),
    maxImages: listings.maxImages,
  };
}
