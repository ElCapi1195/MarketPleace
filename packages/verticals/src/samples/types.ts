/** Producto ficticio para desarrollar y mostrar la interfaz. Sus archivos están en `assets/<nicho>`. */
export interface SampleProduct {
  /** Nombre base de sus archivos: `<asset>.glb` y `<asset>-1.webp`, `-2`, `-3`. */
  asset: string;
  title: string;
  description: string;
  categorySlug: string;
  kind: 'PREORDER' | 'IN_STOCK' | 'SERVICE';
  priceMinor: number;
  depositMinor: number;
  units: number | null;
  /** Meses hasta la llegada, solo en preventas. */
  monthsAhead: number | null;
  attributes: Record<string, string | number | boolean>;
  featured: boolean;
  storeName: string;
}
