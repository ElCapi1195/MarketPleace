interface Definition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: readonly { value: string; label: string }[];
}

type Value = string | number | boolean;

function display({ type, options }: Definition, value: Value, locale: string): string {
  if (type === 'boolean') return value === true ? 'Sí' : 'No';
  if (type === 'select') return options?.find((option) => option.value === value)?.label ?? String(value);
  return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : String(value);
}

/** Características con sus etiquetas, en el orden que define el nicho. */
export function describeAttributes(definitions: readonly Definition[], values: Readonly<Record<string, Value>>, locale: string) {
  return definitions.flatMap((definition) => {
    const value = Object.hasOwn(values, definition.key) ? values[definition.key] : undefined;
    return value === undefined ? [] : [{ label: definition.label, value: display(definition, value, locale) }];
  });
}
