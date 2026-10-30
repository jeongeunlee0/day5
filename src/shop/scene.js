// 메인 화면의 three.js 장면: 스튜디오 조명의 한라봉, 태양 원판, 궤도 고리, 3D 제목
import * as THREE from 'three';
import { $ } from './util.js';

function initScene() {
  const canvas = $('#bg');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 100); camera.position.set(0, .4, 8);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x0b3b3c, 1.25));
  const key = new THREE.DirectionalLight(0xfff0d6, 2.8); key.position.set(-4, 5, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fe0d0, 1.1); fill.position.set(5, -1, 3); scene.add(fill);

  /* sun disc + thin orbit ring behind the fruit */
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.7, 96), new THREE.MeshBasicMaterial({ color: 0xffc21a })); scene.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, .012, 8, 160), new THREE.MeshBasicMaterial({ color: 0xfff3de })); scene.add(ring);

  /* hallabong */
  const tc = document.createElement('canvas'); tc.width = tc.height = 512;
  const ctx = tc.getContext('2d'); ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 7000; i++) { const g = 90 + Math.random() * 60; ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.beginPath(); ctx.arc(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2.2, 0, 7); ctx.fill(); }
  const bump = new THREE.CanvasTexture(tc); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(2, 1);
  const hero = new THREE.Group();
  const peel = (c, s) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, bumpMap: bump, bumpScale: s });
  const fruit = new THREE.Mesh(new THREE.SphereGeometry(1.25, 96, 96), peel(0xff6a1a, 1.6)); fruit.scale.set(1, .93, 1); hero.add(fruit);
  const nub = new THREE.Mesh(new THREE.SphereGeometry(.4, 40, 40), peel(0xff6a1a, 1.2)); nub.scale.set(1, .85, 1); nub.position.y = 1.2; hero.add(nub);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.04, .07, .22, 12), new THREE.MeshStandardMaterial({ color: 0x3b2a14, roughness: .8 })); stem.position.y = 1.55; hero.add(stem);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9e44, roughness: .55, side: THREE.DoubleSide });
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(.55, 32, 12), leafMat); leaf.scale.set(1, .06, .42); leaf.position.set(.5, 1.52, 0); leaf.rotation.z = .35; hero.add(leaf);
  const leaf2 = leaf.clone(); leaf2.position.set(-.45, 1.5, .1); leaf2.rotation.set(0, 2.4, -.4); hero.add(leaf2);
  scene.add(hero);

  /* orbiting small citrus */
  const small = [], sg = new THREE.SphereGeometry(1, 32, 32);
  const cols = [0xff6a1a, 0xffc21a, 0xfff3de, 0xff9a1f];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(sg, peel(cols[i % 4], .7));
    m.scale.setScalar(.14 + Math.random() * .2); scene.add(m);
    small.push({ m, r: 2.9 + Math.random() * 1.8, a: Math.random() * 6.28, sp: .08 + Math.random() * .2, y: (Math.random() - .5) * 3, ph: Math.random() * 6 });
  }

  /* 3D title: Hangul has no typeface JSON for TextGeometry, so extrude the
     canvas-rendered Gmarket Sans glyphs as stacked layers (side walls) + a flat front face */
  const title = new THREE.Group(); title.visible = false; scene.add(title);
  const spacer = $('#title3d');
  let titleReady = false;
  document.fonts.load('700 200px "Gmarket Sans"').then(() => {
    const W = 2048, H = 640, TXT = '제주상점', LAYERS = 30, DEPTH = .08;
    const draw = (paint) => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.font = '700 430px "Gmarket Sans"'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineJoin = 'round'; paint(x);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
    };
    const cy = H / 2 + 12;
    const sideTex = draw((x) => { x.lineWidth = 26; x.strokeStyle = '#fff'; x.strokeText(TXT, W / 2, cy); x.fillStyle = '#fff'; x.fillText(TXT, W / 2, cy); });
    const frontTex = draw((x) => {
      const g = x.createLinearGradient(0, 70, 0, H - 70); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#ffe3b8');
      x.lineWidth = 26; x.strokeStyle = '#fff3de'; x.strokeText(TXT, W / 2, cy); x.fillStyle = g; x.fillText(TXT, W / 2, cy);
    });
    const geo = new THREE.PlaneGeometry(1, H / W);
    const back = new THREE.Color(0x8a2a05), near = new THREE.Color(0xff5a1f);
    for (let i = 0; i < LAYERS; i++) {
      const f = i / (LAYERS - 1);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: sideTex, color: back.clone().lerp(near, f), alphaTest: .5 }));
      m.position.z = -DEPTH * (1 - f); title.add(m);
    }
    const face = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: frontTex, transparent: true, alphaTest: .02 }));
    face.position.z = .002; title.add(face);
    spacer.classList.add('gl'); titleReady = true;
  });
  const ray = new THREE.Vector3();

  let mx = 0, my = 0, tx = 0, ty = 0, narrow = false;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix(); narrow = w < 820;
  }
  addEventListener('resize', resize); resize();
  addEventListener('pointermove', (e) => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; });

  const t0 = performance.now();
  (function loop() {
    const t = (performance.now() - t0) / 1000, k = Math.min(scrollY / innerHeight, 1.6);
    mx += (tx - mx) * .05; my += (ty - my) * .05;
    const baseX = narrow ? 0 : 2.5, baseY = narrow ? 2.1 : .3, sc = narrow ? .45 : 1;
    const s = sc * (1 - Math.min(k, 1) * .25);
    hero.scale.setScalar(s);
    hero.position.set(baseX - k * 1.2, baseY + Math.sin(t * 1.1) * .1 + k * 1.4, -k * 2);
    hero.rotation.y = t * .25 + mx * 1.2; hero.rotation.x = my * .4; hero.rotation.z = Math.sin(t * .5) * .06;
    disc.position.set(hero.position.x, hero.position.y - .1, hero.position.z - 1.6); disc.scale.setScalar(s * 1.12);
    ring.position.copy(disc.position); ring.scale.setScalar(s); ring.rotation.set(1.2 + my * .3, 0, t * .1 + mx * .3);
    small.forEach((o, i) => {
      const a = o.a + t * o.sp;
      const ox = Math.cos(a) * o.r * (narrow ? .6 : 1);
      o.m.position.set(hero.position.x + (narrow ? ox : Math.max(ox, -2.2)), hero.position.y + o.y + Math.sin(t + o.ph) * .22, Math.sin(a) * o.r * .8 - 1);
      o.m.rotation.y = t * .5 + i;
    });
    camera.position.x = mx * .6; camera.position.y = .4 - my * .4 - k * .5; camera.lookAt(0, k * .4, 0);
    if (titleReady) {
      const r = spacer.getBoundingClientRect();
      title.visible = r.bottom > 0 && r.top < innerHeight;
      if (title.visible) {
        camera.updateMatrixWorld();
        ray.set(((r.left + r.width / 2) / innerWidth) * 2 - 1, -(((r.top + r.height / 2) / innerHeight) * 2 - 1), .5).unproject(camera).sub(camera.position).normalize();
        const d = -camera.position.z / ray.z;
        title.position.copy(camera.position).addScaledVector(ray, d);
        const worldW = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d * camera.aspect;
        title.scale.setScalar((r.width / innerWidth) * worldW);
        title.rotation.y = calm ? 0 : Math.sin(t * .7) * .22 + mx * .5 - .12;
        title.rotation.x = calm ? 0 : -.08 + my * .35 + Math.sin(t * .9) * .03;
        title.position.y += calm ? 0 : Math.sin(t * 1.3) * .05;
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })();
}

export { initScene };
