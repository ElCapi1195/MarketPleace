// Piezas comunes para construir los modelos de ejemplo.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };

export function material(color, { rough = 0.5, metal = 0, coat = 0, glow = 0, map = null } = {}) {
  const result = new THREE.MeshPhysicalMaterial({
    color,
    roughness: rough,
    metalness: metal,
    clearcoat: coat,
    clearcoatRoughness: 0.15,
    map,
  });
  if (glow > 0) {
    result.emissive = new THREE.Color(map ? '#ffffff' : color);
    result.emissiveIntensity = glow;
    result.emissiveMap = map;
  }
  return result;
}

function place(mesh, [x = 0, y = 0, z = 0] = [], [rx = 0, ry = 0, rz = 0] = []) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}

export const box = (mat, [w, h, d], at, turn, radius = 0.08) =>
  place(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, Math.min(radius, w / 2.01, h / 2.01, d / 2.01)), mat), at, turn);

export const cylinder = (mat, [top, bottom, height], at, turn, segments = 48) =>
  place(new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), mat), at, turn);

/** Disco con el canto redondeado, tumbado hacia +Z. */
export function button(mat, radius, depth, at, turn) {
  const bevel = Math.min(radius, depth) * 0.45;
  const points = [
    [0, depth],
    [radius - bevel, depth],
    ...[0.25, 0.5, 0.75, 1].map((step) => {
      const angle = (step * Math.PI) / 2;
      return [radius - bevel + Math.sin(angle) * bevel, depth - bevel + Math.cos(angle) * bevel];
    }),
    [radius, 0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(points.toReversed(), 40), mat);
  mesh.geometry.rotateX(Math.PI / 2);
  return place(mesh, at, turn);
}

export const sphere = (mat, radius, at, scale = [1, 1, 1]) => {
  const mesh = place(new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 28), mat), at);
  mesh.scale.set(...scale);
  return mesh;
};

export const torus = (mat, [radius, tube, arc = Math.PI * 2], at, turn, segments = 24) =>
  place(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, segments, 96, arc), mat), at, turn);

export const tube = (mat, points, radius, at, turn) =>
  place(
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 64, radius, 16), mat),
    at,
    turn,
  );

/** Perfil plano con volumen y canto redondeado, centrado en Z. */
export function extrude(mat, shape, depth, bevel, at, turn) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 10,
    curveSegments: 40,
  });
  geometry.translate(0, 0, -depth / 2);
  return place(new THREE.Mesh(geometry, mat), at, turn);
}

export function roundedShape(w, h, r) {
  const shape = new THREE.Shape();
  const [x, y] = [-w / 2, -h / 2];
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y).quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r).quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h).quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r).quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/** Plano con un dibujo propio: pantallas, portadas, etiquetas. */
export function picture([w, h], draw, at, turn, { glow = 0, rough = 0.3, coat = 0.6, size = 512 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round((size * h) / w);
  draw(canvas.getContext('2d'), canvas.width, canvas.height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return place(new THREE.Mesh(new THREE.PlaneGeometry(w, h), material('#ffffff', { rough, coat, glow, map })), at, turn);
}

/** Paisaje abstracto original para pantallas y portadas. */
export function landscape(palette) {
  const [sky, glow, far, mid, near, sun] = palette;
  return (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, sky);
    gradient.addColorStop(0.65, glow);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(w * 0.62, h * 0.48, Math.min(w, h) * 0.2, 0, Math.PI * 2);
    ctx.fill();
    const ridge = (color, base, peaks) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      peaks.forEach(([x, y]) => ctx.lineTo(w * x, h * (base - y)));
      ctx.lineTo(w, h);
      ctx.fill();
    };
    ridge(far, 0.72, [[0, 0.1], [0.16, 0.24], [0.3, 0.08], [0.5, 0.2], [0.72, 0.04], [0.88, 0.16], [1, 0.06]]);
    ridge(mid, 0.84, [[0, 0.02], [0.2, 0.1], [0.4, 0.2], [0.6, 0.04], [0.8, 0.18], [1, 0.1]]);
    ridge(near, 0.96, [[0, 0.14], [0.25, 0.04], [0.5, 0.12], [0.75, 0.02], [1, 0.12]]);
  };
}

/** Une las mallas que comparten material: menos piezas que dibujar. */
export function assemble(parts) {
  const groups = new Map();
  const root = new THREE.Group();
  for (const part of parts.flat(Infinity)) {
    part.updateMatrixWorld(true);
    part.traverse((mesh) => {
      if (!mesh.isMesh) return;
      let geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      if (geometry.index) geometry = geometry.toNonIndexed();
      for (const name of Object.keys(geometry.attributes)) {
        if (!['position', 'normal', 'uv'].includes(name) || (name === 'uv' && !mesh.material.map)) geometry.deleteAttribute(name);
      }
      groups.set(mesh.material, [...(groups.get(mesh.material) ?? []), geometry]);
    });
  }
  for (const [mat, geometries] of groups) root.add(new THREE.Mesh(mergeVertices(mergeGeometries(geometries), 1e-3), mat));
  return root;
}
