/** Trazados SVG en un lienzo de 200×150, de fondo a frente. */
export interface Shape {
  body: string;
  detail: string;
  light: string;
}

/** Llegada lista para mostrar: importes y fechas ya formateados para el nicho. */
export interface ArrivalView {
  id: string;
  name: string;
  categorySlug: string;
  storeName: string;
  monthsAhead: number;
  monthName: string;
  price: string;
  deposit: string | null;
  capacity: number;
  remaining: number;
  color: string;
  shape: Shape;
}
