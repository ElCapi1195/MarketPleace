// Se ejecuta dentro del navegador: construye cada modelo, lo exporta y lo retrata.
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { THREE } from './kit.js';
import { models } from './models.js';

const [WIDTH, HEIGHT, SCALE] = [1600, 1200, 1.5];

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH * SCALE, HEIGHT * SCALE, false);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
const environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.03).texture;

const send = (name, body) => fetch(`/out/${name}`, { method: 'POST', body });

function backdrop(ctx, [inner, outer]) {
  const gradient = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.45, 80, WIDTH * 0.5, HEIGHT * 0.5, WIDTH * 0.75);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/** Acerca la cámara hasta que el objeto llena el encuadre y lo centra en él. */
function frame(camera, object, center) {
  const point = new THREE.Vector3();
  const target = center.clone();
  for (let step = 0; step < 6; step += 1) {
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    const bounds = new THREE.Box2();
    object.updateMatrixWorld(true);
    object.traverse(({ isMesh, geometry, matrixWorld }) => {
      if (!isMesh) return;
      const { position } = geometry.attributes;
      for (let i = 0; i < position.count; i += 7) {
        point.fromBufferAttribute(position, i).applyMatrix4(matrixWorld).project(camera);
        bounds.expandByPoint(point);
      }
    });
    const middle = bounds.getCenter(new THREE.Vector2());
    const size = bounds.getSize(new THREE.Vector2());
    const distance = camera.position.distanceTo(target);
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
    const shift = new THREE.Vector3(middle.x * half * camera.aspect, (middle.y - 0.02) * half, 0).applyQuaternion(camera.quaternion);
    target.add(shift);
    camera.position.add(shift);
    const zoom = Math.max(size.x / 1.56, size.y / 1.5);
    camera.position.sub(target).multiplyScalar(zoom).add(target);
  }
  camera.lookAt(target);
}

async function portrait(object, background, [azimuth, elevation]) {
  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.environmentIntensity = 0.75;
  scene.add(object);

  const bounds = new THREE.Box3().setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  const { radius } = bounds.getBoundingSphere(new THREE.Sphere());
  object.traverse((mesh) => {
    if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(radius * 30, radius * 30), new THREE.ShadowMaterial({ opacity: 0.32, color: '#1d1557' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = bounds.min.y - 0.01;
  floor.receiveShadow = true;
  scene.add(floor);

  const key = new THREE.DirectionalLight('#fff4e6', 2.4);
  key.position.set(center.x + radius * 1.6, center.y + radius * 3, center.z + radius * 1.8);
  key.target.position.copy(center);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 14;
  key.shadow.blurSamples = 25;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -radius * 2, right: radius * 2, top: radius * 2, bottom: -radius * 2, near: 0.1, far: radius * 10 });
  const rim = new THREE.DirectionalLight('#b9c4ff', 1.6);
  rim.position.set(center.x - radius * 2, center.y + radius, center.z - radius * 2);
  scene.add(key, key.target, rim);

  const camera = new THREE.PerspectiveCamera(26, WIDTH / HEIGHT, 0.1, 200);
  const [a, e] = [THREE.MathUtils.degToRad(azimuth), THREE.MathUtils.degToRad(elevation)];
  const distance = (radius / Math.sin(THREE.MathUtils.degToRad(13))) * 0.98;
  camera.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(distance).add(center);
  camera.lookAt(center);
  frame(camera, object, center);
  renderer.render(scene, camera);

  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [WIDTH, HEIGHT];
  const ctx = canvas.getContext('2d');
  backdrop(ctx, background);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(renderer.domElement, 0, 0, WIDTH, HEIGHT);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
}

try {
  const only = new URLSearchParams(location.search).get('only');
  for (const [name, { build, background, pose = [0, 0, 0], views }] of Object.entries(models)) {
    if (only && !only.split(',').includes(name)) continue;
    const object = build();
    const { x, y, z } = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    object.children.forEach((mesh) => mesh.geometry.translate(-x, -y, -z));
    await send(`${name}.glb`, await new GLTFExporter().parseAsync(object, { binary: true }));
    object.rotation.set(...pose);
    for (const [index, view] of views.entries()) await send(`${name}-${index + 1}.webp`, await portrait(object, background, view));
  }
  await send('done', 'ok');
} catch (error) {
  await send('done', String(error?.stack ?? error));
}
