/** Silueta por capas en un lienzo de 200×150: trazados SVG. */
export interface SampleShape {
  body: string;
  detail: string;
  light: string;
}

/** Producto ficticio para desarrollar y mostrar la interfaz antes de que exista el catálogo. */
export interface SampleArrival {
  slug: string;
  name: string;
  categorySlug: string;
  storeName: string;
  monthsAhead: number;
  priceMinor: number;
  depositMinor: number;
  capacity: number;
  remaining: number;
  color: string;
  shape: SampleShape;
}
