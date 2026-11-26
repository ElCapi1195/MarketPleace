// Equipos genéricos originales: no imitan productos ni marcas existentes.
import { assemble, box, button, cylinder, extrude, landscape, material, picture, roundedShape, sphere, THREE, torus, tube } from './kit.js';

const INK = '#1d1557';
const dark = () => material('#17152b', { rough: 0.42, coat: 0.2 });
const soft = () => material('#232038', { rough: 0.85 });
const metal = () => material('#c9cbd8', { rough: 0.25, metal: 1 });

const stick = (base, cap, at) => [
  button(base, 0.3, 0.07, at),
  cylinder(base, [0.11, 0.13, 0.2], [at[0], at[1], at[2] + 0.12], [Math.PI / 2]),
  button(cap, 0.21, 0.09, [at[0], at[1], at[2] + 0.19]),
  torus(base, [0.15, 0.025], [at[0], at[1], at[2] + 0.27]),
];

const cross = (mat, at, size = 0.46) => [
  box(mat, [size, size / 3, 0.12], at, [], 0.04),
  box(mat, [size / 3, size, 0.12], at, [], 0.04),
];

const diamond = (mats, [x, y, z], gap, radius) =>
  [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([dx, dy], i) => button(mats[i % mats.length], radius, 0.1, [x + dx * gap, y + dy * gap, z]));

function handheld() {
  const body = material('#efeefc', { rough: 0.35, coat: 0.6 });
  const grip = material('#6a4bd8', { rough: 0.4, coat: 0.5 });
  const accent = material('#ffc22e', { rough: 0.35, coat: 0.5 });
  const black = dark();
  const art = landscape(['#2a1a6b', '#ff7a59', '#6a3fa0', '#3d2379', '#160d3d', '#ffd66b']);
  const side = (dir) => {
    const shape = roundedShape(1.02, 2.05, 0.46);
    return extrude(grip, shape, 0.2, 0.1, [dir * 1.95, 0, 0]);
  };
  return assemble([
    extrude(body, roundedShape(3.5, 1.86, 0.16), 0.16, 0.08, [0, 0, 0]),
    side(-1),
    side(1),
    extrude(black, roundedShape(2.78, 1.66, 0.12), 0.02, 0.02, [0, 0, 0.18]),
    picture([2.6, 1.48], art, [0, 0, 0.215], [], { glow: 0.55, rough: 0.12, coat: 1 }),
    stick(black, soft(), [-1.95, 0.5, 0.2]),
    cross(black, [-1.95, -0.32, 0.24]),
    diamond([accent, black], [1.95, 0.5, 0.2], 0.21, 0.115),
    stick(black, soft(), [1.95, -0.36, 0.2]),
    box(black, [0.22, 0.07, 0.06], [-1.62, 0.92, 0.2], [], 0.03),
    box(black, [0.22, 0.07, 0.06], [1.62, 0.92, 0.2], [], 0.03),
    box(black, [0.8, 0.14, 0.26], [-1.92, 1.08, -0.02], [], 0.06),
    box(black, [0.8, 0.14, 0.26], [1.92, 1.08, -0.02], [], 0.06),
    [-0.28, 0, 0.28].map((x) => box(black, [0.18, 0.05, 0.1], [x, 1.01, 0], [], 0.02)),
    Array.from({ length: 8 }, (_, i) => box(black, [0.06, 0.5, 0.03], [-0.42 + i * 0.12, 0.2, -0.17], [], 0.01)),
  ]);
}

function controller() {
  const shell = material('#ff5a43', { rough: 0.38, coat: 0.5 });
  const black = dark();
  const light = material('#ffc22e', { rough: 0.3, glow: 0.8 });
  const white = material('#f6f4ff', { rough: 0.35, coat: 0.5 });
  const shape = new THREE.Shape();
  shape.moveTo(-0.95, 0.72);
  shape.bezierCurveTo(-0.4, 0.84, 0.4, 0.84, 0.95, 0.72);
  shape.bezierCurveTo(1.6, 0.74, 1.85, 0.1, 2.02, -0.75);
  shape.bezierCurveTo(2.12, -1.36, 1.52, -1.5, 1.22, -1.0);
  shape.bezierCurveTo(1.02, -0.62, 0.86, -0.52, 0.6, -0.52);
  shape.lineTo(-0.6, -0.52);
  shape.bezierCurveTo(-0.86, -0.52, -1.02, -0.62, -1.22, -1.0);
  shape.bezierCurveTo(-1.52, -1.5, -2.12, -1.36, -2.02, -0.75);
  shape.bezierCurveTo(-1.85, 0.1, -1.6, 0.74, -0.95, 0.72);
  return assemble([
    extrude(shell, shape, 0.3, 0.24),
    extrude(black, roundedShape(1.15, 0.5, 0.2), 0.02, 0.03, [0, 0.42, 0.4]),
    box(light, [0.8, 0.05, 0.04], [0, 0.1, 0.4], [], 0.02),
    stick(black, soft(), [-1.18, 0.3, 0.38]),
    cross(black, [-0.62, -0.18, 0.42], 0.5),
    stick(black, soft(), [0.62, -0.2, 0.38]),
    diamond([white, black], [1.2, 0.3, 0.38], 0.24, 0.125),
    button(white, 0.07, 0.06, [-0.72, 0.5, 0.38]),
    button(white, 0.07, 0.06, [0.72, 0.5, 0.38]),
    box(black, [0.78, 0.2, 0.36], [-1.06, 0.95, -0.08], [0.25, 0, 0.1], 0.09),
    box(black, [0.78, 0.2, 0.36], [1.06, 0.95, -0.08], [0.25, 0, -0.1], 0.09),
    box(black, [0.62, 0.42, 0.36], [-1.12, 0.74, -0.36], [0.5, 0, 0.1], 0.14),
    box(black, [0.62, 0.42, 0.36], [1.12, 0.74, -0.36], [0.5, 0, -0.1], 0.14),
  ]);
}

function desktop() {
  const shell = material('#f2f1fb', { rough: 0.42, coat: 0.35 });
  const black = dark();
  const strip = material('#38d6a3', { rough: 0.3, glow: 1.1 });
  const arch = (w, h) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(-w / 2, h - w / 2);
    shape.absarc(0, h - w / 2, w / 2, Math.PI, 0, true);
    shape.lineTo(w / 2, 0);
    shape.closePath();
    return shape;
  };
  // Láminas en arco con huecos oscuros entre ellas.
  const fins = Array.from({ length: 7 }, (_, i) => extrude(shell, arch(1.75, 2.9), 0.16, 0.05, [0, 0.12, 0.9 - i * 0.31]));
  return assemble([
    extrude(black, arch(1.56, 2.78), 2.1, 0.02, [0, 0.12, 0]),
    fins,
    extrude(black, arch(1.2, 2.3), 0.02, 0.03, [0, 0.3, 1.04]),
    box(strip, [0.05, 1.5, 0.04], [-0.34, 1.25, 1.08], [], 0.02),
    box(soft(), [0.7, 0.05, 0.04], [0.12, 1.7, 1.08], [], 0.02),
    button(shell, 0.1, 0.05, [0.12, 0.72, 1.06]),
    [0.02, 0.22].map((x) => box(soft(), [0.13, 0.06, 0.04], [x, 0.48, 1.08], [], 0.02)),
    box(black, [2.1, 0.14, 2.5], [0, 0.07, 0], [], 0.06),
  ]);
}

function visor() {
  const shell = material('#f4f3ff', { rough: 0.35, coat: 0.6 });
  const glass = material('#141033', { rough: 0.08, coat: 1 });
  const strap = soft();
  const accent = material('#3b8bff', { rough: 0.4, glow: 0.5 });
  const lens = material('#2b2566', { rough: 0.1, coat: 1 });
  return assemble([
    extrude(shell, roundedShape(3.0, 1.5, 0.62), 0.75, 0.14),
    extrude(glass, roundedShape(2.8, 1.26, 0.54), 0.08, 0.1, [0, 0, 0.5]),
    [[-1.05, 0.36], [1.05, 0.36], [-1.05, -0.36], [1.05, -0.36]].map(([x, y]) => [
      button(soft(), 0.14, 0.05, [x, y, 0.64]),
      button(lens, 0.085, 0.07, [x, y, 0.65]),
    ]),
    box(accent, [0.5, 0.05, 0.05], [0, -0.42, 0.67], [], 0.02),
    extrude(strap, roundedShape(2.7, 1.3, 0.55), 0.3, 0.1, [0, 0, -0.55]),
    [-1, 1].map((dir) => [
      box(shell, [0.16, 0.42, 1.3], [dir * 1.58, 0.05, -0.75], [], 0.08),
      button(soft(), 0.22, 0.1, [dir * 1.62, 0.05, -0.4], [0, (dir * Math.PI) / 2, 0]),
    ]),
    torus(strap, [1.58, 0.1, Math.PI], [0, 0.05, -1.35], [-Math.PI / 2, 0, 0]),
    tube(strap, [[0, 0.8, -0.1], [0, 1.28, -0.9], [0, 1.22, -1.9], [0, 0.2, -2.9]], 0.09),
    box(shell, [0.95, 0.5, 0.26], [0, 0.08, -2.9], [], 0.12),
    button(soft(), 0.18, 0.12, [0, 0.08, -3.02], [0, Math.PI, 0]),
  ]);
}

function headset() {
  const shell = material('#1fa67a', { rough: 0.4, coat: 0.5 });
  const black = dark();
  const pad = soft();
  const steel = metal();
  const cup = (dir) => [
    cylinder(shell, [0.62, 0.72, 0.34], [dir * 1.5, 0, 0], [0, 0, (dir * -Math.PI) / 2]),
    cylinder(black, [0.5, 0.5, 0.06], [dir * 1.69, 0, 0], [0, 0, Math.PI / 2]),
    torus(material('#ffc22e', { rough: 0.35, glow: 0.4 }), [0.5, 0.03], [dir * 1.7, 0, 0], [0, Math.PI / 2, 0]),
    torus(pad, [0.5, 0.21], [dir * 1.22, 0, 0], [0, Math.PI / 2, 0]),
    cylinder(black, [0.46, 0.46, 0.12], [dir * 1.28, 0, 0], [0, 0, Math.PI / 2]),
    tube(steel, [[dir * 1.5, 0.64, 0], [dir * 1.56, 1.1, 0], [dir * 1.46, 1.5, 0]], 0.055),
  ];
  return assemble([
    cup(-1),
    cup(1),
    torus(black, [1.5, 0.13, Math.PI], [0, 1.2, 0], [], 20),
    torus(pad, [1.36, 0.14, Math.PI * 0.62], [0, 1.2, 0], [0, 0, Math.PI * 0.19], 20),
    tube(black, [[-1.5, -0.4, 0.3], [-1.42, -0.8, 0.8], [-1.0, -0.98, 1.25], [-0.55, -0.95, 1.4]], 0.045),
    box(pad, [0.36, 0.2, 0.2], [-0.45, -0.94, 1.42], [0, 0.25, 0], 0.09),
  ]);
}

function keyboard() {
  const base = material('#2a2260', { rough: 0.35, metal: 0.4, coat: 0.3 });
  const light = material('#f2f0ff', { rough: 0.55 });
  const deep = material('#6a4bd8', { rough: 0.5 });
  const accent = material('#ffc22e', { rough: 0.45 });
  const coral = material('#ff5a43', { rough: 0.45 });
  const rows = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
    [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
    [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
  ];
  const unit = 0.29;
  const keys = rows.flatMap((row, line) => {
    let x = (-15 * unit) / 2;
    return row.map((size, i) => {
      const width = size * unit;
      const mat = line === 0 && i === 0 ? coral : line === 2 && i === row.length - 1 ? accent : size > 1 && size < 6 ? deep : light;
      const key = box(mat, [width - 0.04, 0.16, unit - 0.04], [x + width / 2, 0.2, (line - 2) * unit], [], 0.05);
      x += width;
      return key;
    });
  });
  return assemble([
    box(base, [4.62, 0.22, 1.72], [0, 0, 0], [], 0.1),
    box(soft(), [4.42, 0.06, 1.52], [0, 0.1, 0], [], 0.03),
    keys,
    box(material('#38d6a3', { glow: 1, rough: 0.3 }), [4.3, 0.03, 0.03], [0, 0.02, 0.86], [], 0.01),
    cylinder(metal(), [0.12, 0.12, 0.16], [2.1, 0.14, -0.98]),
    tube(soft(), [[-1.2, 0, -0.85], [-1.2, 0, -1.2], [-1.5, -0.04, -1.5], [-2.2, -0.06, -1.6]], 0.045),
  ]);
}

function wheel() {
  const rim = material('#1c1930', { rough: 0.8 });
  const leather = material('#ff5a43', { rough: 0.65 });
  const black = dark();
  const steel = metal();
  const accent = material('#ffc22e', { rough: 0.35, glow: 0.5 });
  const art = landscape(['#0d0a2a', '#3b2bb0', '#2a1f80', '#1c1560', '#0d0a2a', '#38d6a3']);
  return assemble([
    torus(rim, [1.45, 0.17], [0, 0, 0]),
    torus(leather, [1.45, 0.18, Math.PI * 0.42], [0, 0, 0], [0, 0, -Math.PI * 0.21]),
    torus(leather, [1.45, 0.18, Math.PI * 0.42], [0, 0, 0], [0, 0, Math.PI * 0.79]),
    torus(accent, [1.45, 0.185, 0.09], [0, 0, 0], [0, 0, Math.PI / 2 - 0.045]),
    box(steel, [2.6, 0.3, 0.1], [0, 0.04, 0.02], [], 0.04),
    box(steel, [0.34, 1.3, 0.1], [0, -0.68, 0.02], [], 0.04),
    cylinder(black, [0.6, 0.66, 0.28], [0, 0, 0.06], [Math.PI / 2]),
    picture([0.62, 0.34], art, [0, 0.12, 0.215], [], { glow: 0.8, size: 256 }),
    [[-0.95, 0.04], [0.95, 0.04], [-0.75, 0.04], [0.75, 0.04]].map(([x, y], i) => button(i < 2 ? accent : black, 0.08, 0.07, [x, y, 0.08])),
    [-0.22, 0, 0.22].map((x) => button(leather, 0.07, 0.06, [x, -0.26, 0.2])),
    [-1, 1].map((dir) => box(steel, [0.5, 0.36, 0.06], [dir * 0.86, 0.3, -0.16], [0, 0, dir * -0.2], 0.03)),
    cylinder(black, [0.34, 0.4, 0.7], [0, 0, -0.4], [Math.PI / 2]),
    box(black, [1.7, 1.5, 1.2], [0, -0.42, -1.2], [], 0.28),
    box(soft(), [2.1, 0.3, 1.5], [0, -1.3, -1.2], [], 0.1),
    Array.from({ length: 6 }, (_, i) => box(soft(), [1.0, 0.05, 0.04], [0, -0.05 - i * 0.12, -0.6], [], 0.01)),
  ]);
}

function edition() {
  const cover = landscape(['#1a1150', '#e0518f', '#7a2f8f', '#4a1f73', '#1a0d3d', '#ffd66b']);
  const card = material('#3a1c66', { rough: 0.5, coat: 0.4 });
  const gold = material('#e8b64c', { rough: 0.28, metal: 1 });
  const gem = material('#38d6a3', { rough: 0.08, coat: 1 });
  const title = (ctx, w, h) => {
    cover(ctx, w, h);
    ctx.strokeStyle = '#ffd66b';
    ctx.lineWidth = w * 0.02;
    ctx.strokeRect(w * 0.06, h * 0.045, w * 0.88, h * 0.91);
    ctx.fillStyle = '#fff6dc';
    ctx.textAlign = 'center';
    ctx.font = `800 ${w * 0.095}px sans-serif`;
    ctx.fillText('VALLE SOLAR', w / 2, h * 0.17);
    ctx.font = `500 ${w * 0.052}px sans-serif`;
    ctx.fillText('Edición de colección', w / 2, h * 0.225);
  };
  const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), gem);
  jewel.position.set(1.75, 1.35, 0.3);
  jewel.scale.y = 1.5;
  return assemble([
    box(card, [1.9, 2.6, 0.55], [-0.35, 1.3, 0], [0, 0.18, 0], 0.03),
    picture([1.84, 2.54], title, [-0.3, 1.3, 0.277], [0, 0.18, 0], { size: 768, rough: 0.35 }),
    jewel,
    cylinder(gold, [0.12, 0.2, 0.36], [1.75, 0.58, 0.3]),
    cylinder(gold, [0.5, 0.58, 0.12], [1.75, 0.34, 0.3]),
    cylinder(dark(), [0.62, 0.7, 0.28], [1.75, 0.14, 0.3]),
    torus(gold, [0.5, 0.035], [1.75, 1.35, 0.3], [1.2, 0.3, 0]),
    cylinder(gold, [0.28, 0.28, 0.05], [0.75, 0.03, 1.05], [0.02, 0, 0]),
    cylinder(gold, [0.28, 0.28, 0.05], [0.95, 0.07, 1.15], [0.12, 0, 0.1]),
  ]);
}

function drive() {
  const board = material('#12213f', { rough: 0.5 });
  const chip = dark();
  const gold = material('#e8b64c', { rough: 0.3, metal: 1 });
  const sink = material('#6a4bd8', { rough: 0.35, metal: 0.6, coat: 0.3 });
  const label = (ctx, w, h) => {
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffc22e';
    ctx.font = `800 ${h * 0.5}px sans-serif`;
    ctx.fillText('2 TB', w * 0.08, h * 0.66);
    ctx.fillStyle = '#e3e4fb';
    ctx.font = `500 ${h * 0.15}px sans-serif`;
    ctx.fillText('Alta velocidad', w * 0.58, h * 0.62);
  };
  return assemble([
    box(board, [4, 0.09, 1.1], [0, 0, 0], [], 0.03),
    Array.from({ length: 14 }, (_, i) => box(gold, [0.22, 0.095, 0.045], [-1.9, 0, -0.45 + i * 0.066 + (i > 10 ? 0.08 : 0)], [], 0.01)),
    box(sink, [3.1, 0.22, 1.02], [0.36, 0.16, 0], [], 0.05),
    Array.from({ length: 9 }, (_, i) => box(sink, [0.08, 0.24, 1.0], [0.75 + i * 0.13, 0.32, 0], [], 0.02)),
    picture([1.5, 0.62], label, [-0.3, 0.273, 0], [-Math.PI / 2, 0, 0], { size: 512 }),
    box(chip, [0.3, 0.1, 0.4], [-1.5, 0.08, -0.2], [], 0.02),
    [0.1, 0.25, 0.4].map((z) => box(material('#b98b5a', { rough: 0.6 }), [0.12, 0.06, 0.07], [-1.5, 0.07, z], [], 0.01)),
    cylinder(metal(), [0.12, 0.12, 0.1], [1.95, 0.03, 0]),
  ]);
}

function service() {
  const mat = material('#3b2bb0', { rough: 0.8 });
  const handle = material('#ffc22e', { rough: 0.4, coat: 0.4 });
  const coral = material('#ff5a43', { rough: 0.4, coat: 0.4 });
  const steel = metal();
  const black = dark();
  const white = material('#f2f0ff', { rough: 0.45, coat: 0.3 });
  const blades = Array.from({ length: 9 }, (_, i) => {
    const angle = (i / 9) * Math.PI * 2;
    return box(black, [0.46, 0.04, 0.2], [0.95 + Math.cos(angle) * 0.36, 0.3, -0.3 + Math.sin(angle) * 0.36], [0.5, -angle, 0], 0.02);
  });
  const driver = (color, z, turn) => {
    const group = new THREE.Group();
    group.add(
      cylinder(color, [0.15, 0.19, 1.0], [0, 0, 0], [0, 0, Math.PI / 2]),
      cylinder(black, [0.13, 0.13, 0.12], [-0.55, 0, 0], [0, 0, Math.PI / 2]),
      cylinder(steel, [0.05, 0.05, 1.1], [1.0, 0, 0], [0, 0, Math.PI / 2]),
      cylinder(steel, [0.0, 0.05, 0.16], [1.63, 0, 0], [0, 0, -Math.PI / 2]),
    );
    group.position.set(-1.35, 0.27, z);
    group.rotation.y = turn;
    return group;
  };
  return assemble([
    box(mat, [4.4, 0.1, 3], [0, 0, 0], [], 0.05),
    box(white, [1.9, 0.14, 1.9], [0.95, 0.12, -0.3], [], 0.07),
    cylinder(soft(), [0.74, 0.74, 0.1], [0.95, 0.22, -0.3]),
    torus(steel, [0.72, 0.05], [0.95, 0.28, -0.3], [Math.PI / 2, 0, 0]),
    blades,
    cylinder(black, [0.2, 0.2, 0.16], [0.95, 0.32, -0.3]),
    cylinder(handle, [0.1, 0.1, 0.02], [0.95, 0.41, -0.3]),
    driver(handle, 0.75, 0.12),
    driver(coral, 0.25, 0.12),
    tube(steel, [[-1.9, 0.12, -0.2], [-1.0, 0.2, -0.45], [-0.3, 0.1, -0.5]], 0.04),
    tube(steel, [[-1.9, 0.12, -0.28], [-1.0, 0.12, -0.75], [-0.3, 0.1, -0.56]], 0.04),
    [[1.75, 0.95], [1.45, 1.1], [1.15, 0.92], [0.85, 1.12]].map(([x, z]) => [
      cylinder(steel, [0.1, 0.1, 0.06], [x, 0.16, z]),
      cylinder(steel, [0.045, 0.045, 0.12], [x, 0.1, z]),
    ]),
    sphere(coral, 0.2, [-0.1, 0.22, -1.1], [1, 0.8, 1]),
    cylinder(white, [0.05, 0.12, 0.3], [-0.1, 0.42, -1.1]),
  ]);
}

// `views`: [giro, elevación] de la cámara en grados para cada imagen.
export const models = {
  'consola-portatil': { build: handheld, background: ['#ffd978', '#ffb62e'], pose: [-0.12, 0, 0], views: [[-28, 16], [0, 6], [152, 18]] },
  'mando-inalambrico': { build: controller, background: ['#f7b7d3', '#e0629b'], pose: [-0.5, 0, 0], views: [[24, 20], [0, 34], [-150, 24]] },
  'consola-sobremesa': { build: desktop, background: ['#cfd1f6', '#9a9ee8'], views: [[-32, 14], [0, 6], [140, 20]] },
  'visor-realidad-virtual': { build: visor, background: ['#a9c8ff', '#5a94f5'], views: [[-34, 16], [0, 4], [138, 24]] },
  auriculares: { build: headset, background: ['#ffe9b0', '#ffc95c'], views: [[34, 12], [0, 6], [-140, 18]] },
  'teclado-mecanico': { build: keyboard, background: ['#a8e6cf', '#4fc99a'], views: [[-26, 38], [0, 62], [150, 30]] },
  'volante-pedales': { build: wheel, background: ['#cfd1f6', '#8a8fe6'], views: [[30, 12], [0, 4], [-142, 20]] },
  'edicion-coleccion': { build: edition, background: ['#ffc9bd', '#ff8a73'], views: [[-14, 10], [10, 16], [30, 24]] },
  'unidad-ssd': { build: drive, background: ['#e3d4ff', '#a98bf0'], views: [[-30, 34], [0, 60], [150, 28]] },
  'mantenimiento': { build: service, background: ['#bfeee0', '#5fcfae'], views: [[-24, 42], [0, 68], [28, 26]] },
};
