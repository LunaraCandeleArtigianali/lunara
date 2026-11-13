import * as THREE from 'https://esm.sh/three@0.170.0';
import { RoundedBoxGeometry } from 'https://esm.sh/three@0.170.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FontLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://esm.sh/three@0.170.0/examples/jsm/geometries/TextGeometry.js';

let fontPromise;
const loadFont = () => fontPromise ||= new FontLoader().loadAsync('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/fonts/helvetiker_bold.typeface.json');

export async function mountNameCandlePreview(host, text, waxColor) {
  const THREE_NS = THREE;
  const font = await loadFont();
  if (!host.isConnected) return null;
  host.innerHTML = '';
  host.classList.add('is-3d');
  const scene = new THREE_NS.Scene();
  scene.background = new THREE_NS.Color('#fffefa');
  const camera = new THREE_NS.PerspectiveCamera(34, 1, .1, 100);
  camera.position.set(0, 3.2, 9.5);
  const renderer = new THREE_NS.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE_NS.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE_NS.SRGBColorSpace;
  renderer.toneMapping = THREE_NS.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('aria-label', 'Anteprima tridimensionale della candela. Trascina per ruotarla.');
  host.appendChild(renderer.domElement);

  scene.add(new THREE_NS.HemisphereLight(0xffffff, 0xb6a58e, 2.1));
  const key = new THREE_NS.DirectionalLight(0xfff3df, 3.4);
  key.position.set(-4, 7, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); scene.add(key);
  const fill = new THREE_NS.DirectionalLight(0xffffff, 1.5);
  fill.position.set(5, 3, -4); scene.add(fill);

  const floor = new THREE_NS.Mesh(new THREE_NS.PlaneGeometry(40, 40), new THREE_NS.ShadowMaterial({ opacity: .12 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.55; floor.receiveShadow = true; scene.add(floor);

  const group = new THREE_NS.Group(); scene.add(group);
  const color = new THREE_NS.Color(waxColor || '#f4f0e8');
  const wax = new THREE_NS.MeshStandardMaterial({ color, roughness: .31, metalness: 0, envMapIntensity: .25 });
  const raisedWax = new THREE_NS.MeshStandardMaterial({ color: color.clone().multiplyScalar(.84), roughness: .38 });
  const chars = [...text].filter(ch => ch.trim());
  const spacing = .94;
  chars.forEach((char, index) => {
    const block = new THREE_NS.Mesh(new RoundedBoxGeometry(.88, .88, .25, 5, .12), wax);
    block.castShadow = true; block.receiveShadow = true;
    block.position.x = (index - (chars.length - 1) / 2) * spacing;
    group.add(block);
    const geo = new TextGeometry(char, { font, size: .52, depth: .075, curveSegments: 8, bevelEnabled: true, bevelThickness: .018, bevelSize: .012, bevelSegments: 3 });
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    geo.translate(-(box.max.x + box.min.x) / 2, -(box.max.y + box.min.y) / 2, 0);
    const letter = new THREE_NS.Mesh(geo, raisedWax);
    letter.position.set(block.position.x, 0, .142);
    letter.castShadow = true; letter.receiveShadow = true; group.add(letter);
  });
  const totalWidth = Math.max(1, chars.length * spacing);
  camera.position.z = Math.max(5.8, totalWidth * 1.22 + 3.8);
  camera.position.y = Math.max(2.5, totalWidth * .23 + 2.2);
  camera.lookAt(0, 0, 0);

  let width = 0, height = 0, frame = 0, dragging = false, lastX = 0, lastY = 0, velocity = 0;
  const resize = () => {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(180, rect.height);
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const down = e => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture?.(e.pointerId); };
  const move = e => { if (!dragging) return; const dx = e.clientX - lastX, dy = e.clientY - lastY; group.rotation.y += dx * .012; group.rotation.x = THREE_NS.MathUtils.clamp(group.rotation.x + dy * .008, -.45, .45); velocity = dx * .0008; lastX = e.clientX; lastY = e.clientY; };
  const up = () => { dragging = false; };
  renderer.domElement.addEventListener('pointerdown', down);
  renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointercancel', up);
  const animate = () => {
    frame = requestAnimationFrame(animate);
    if (!dragging) { group.rotation.y += velocity || .0015; velocity *= .94; }
    renderer.render(scene, camera);
  };
  animate();
  return {
    update(nextText, nextColor) {
      const sameText = nextText === text;
      if (sameText && nextColor === waxColor) return;
      text = nextText; waxColor = nextColor;
      const nextColorObj = new THREE_NS.Color(nextColor || '#f4f0e8');
      wax.color.copy(nextColorObj); raisedWax.color.copy(nextColorObj).multiplyScalar(.84);
      if (!sameText) {
        while (group.children.length) {
          const child = group.children[group.children.length - 1]; group.remove(child);
          child.geometry?.dispose();
          if (child.material !== wax && child.material !== raisedWax) child.material?.dispose();
        }
        const nextChars = [...nextText].filter(ch => ch.trim());
        nextChars.forEach((char, index) => {
          const block = new THREE_NS.Mesh(new RoundedBoxGeometry(.88, .88, .25, 5, .12), wax);
          block.position.x = (index - (nextChars.length - 1) / 2) * spacing; block.castShadow = true; block.receiveShadow = true; group.add(block);
          const geo = new TextGeometry(char, { font, size: .52, depth: .075, curveSegments: 8, bevelEnabled: true, bevelThickness: .018, bevelSize: .012, bevelSegments: 3 });
          geo.computeBoundingBox(); const b = geo.boundingBox; geo.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, 0);
          const letter = new THREE_NS.Mesh(geo, raisedWax); letter.position.set(block.position.x, 0, .142); letter.castShadow = true; letter.receiveShadow = true; group.add(letter);
        });
        const w = Math.max(1, nextChars.length * spacing);
        camera.position.z = Math.max(5.8, w * 1.22 + 3.8); camera.position.y = Math.max(2.5, w * .23 + 2.2); camera.lookAt(0, 0, 0);
      }
    },
    destroy() {
      cancelAnimationFrame(frame); observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointercancel', up);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      wax.dispose(); raisedWax.dispose(); renderer.dispose(); renderer.domElement.remove();
      host.classList.remove('is-3d');
    }
  };
}
