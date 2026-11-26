import {
  Box3,
  DirectionalLight,
  Mesh,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Sphere,
  Spherical,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const STEP = Math.PI / 18;
const FIELD_OF_VIEW = 30;

function disposeModel(model: Object3D): void {
  model.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry.dispose();
    for (const material of [node.material].flat() as Material[]) {
      for (const value of Object.values(material)) if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
      material.dispose();
    }
  });
}

/** Coloca la cámara para que el modelo quepa entero, sea cual sea su tamaño. */
function place(camera: PerspectiveCamera, controls: OrbitControls, model: Object3D): void {
  const { center, radius } = new Box3().setFromObject(model).getBoundingSphere(new Sphere());
  model.position.sub(center);
  const distance = (radius / Math.sin((FIELD_OF_VIEW / 2) * (Math.PI / 180))) * 0.88;
  camera.position.setFromSpherical(new Spherical(distance, Math.PI * 0.42, Math.PI * -0.16));
  Object.assign(camera, { near: distance / 100, far: distance * 10 });
  Object.assign(controls, { minDistance: distance * 0.5, maxDistance: distance * 1.8 });
  camera.updateProjectionMatrix();
  controls.update();
}

/** Muestra un modelo en el lienzo. Devuelve la función que libera la tarjeta gráfica. */
export async function mountViewer(canvas: HTMLCanvasElement, url: string, { still }: { still: boolean }): Promise<() => void> {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.toneMapping = NeutralToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  const generator = new PMREMGenerator(renderer);
  scene.environment = generator.fromScene(new RoomEnvironment(), 0.03).texture;
  generator.dispose();
  const light = new DirectionalLight('#ffffff', 1.6);
  light.position.set(2, 4, 3);
  scene.add(light);

  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enablePan: false, enableDamping: !still, autoRotate: !still, autoRotateSpeed: 1.4 });
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
  });

  const onKey = (event: KeyboardEvent) => {
    const [x, y] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key] ?? [];
    if (x === undefined || y === undefined) return;
    event.preventDefault();
    controls.autoRotate = false;
    const position = new Spherical().setFromVector3(new Vector3().subVectors(camera.position, controls.target));
    position.theta += x * STEP;
    position.phi += y * STEP;
    position.makeSafe();
    camera.position.setFromSpherical(position).add(controls.target);
  };
  canvas.addEventListener('keydown', onKey);

  const resize = new ResizeObserver(() => {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  });
  resize.observe(canvas);

  let model: Object3D | null = null;
  const dispose = () => {
    renderer.setAnimationLoop(null);
    resize.disconnect();
    canvas.removeEventListener('keydown', onKey);
    controls.dispose();
    if (model) disposeModel(model);
    scene.environment?.dispose();
    renderer.dispose();
  };

  try {
    model = (await new GLTFLoader().loadAsync(url)).scene;
  } catch (error) {
    dispose();
    throw error;
  }
  scene.add(model);
  place(camera, controls, model);
  let last: number | undefined;
  renderer.setAnimationLoop((time: number) => {
    // Con el tiempo real, el giro va igual de rápido en cualquier pantalla.
    controls.update(last === undefined ? 0 : (time - last) / 1000);
    last = time;
    renderer.render(scene, camera);
  });
  return dispose;
}
