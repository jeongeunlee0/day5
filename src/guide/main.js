import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const $ = (id) => document.getElementById(id)
const mapEl = $('map'), tip = $('tip'), log = $('log'), form = $('form'), qInput = $('q'), sendBtn = $('send'), notice = $('notice')

// ── 3D 지도 ─────────────────────────────────────────────────────────
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0b3b3c)
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400)
camera.position.set(0, 16, 20)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
mapEl.appendChild(renderer.domElement)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.maxPolarAngle = Math.PI * 0.48
controls.minDistance = 6
controls.maxDistance = 45

scene.add(new THREE.HemisphereLight(0xffffff, 0x0b3b3c, 1.5))
const sun = new THREE.DirectionalLight(0xfff3de, 1.6)
sun.position.set(8, 14, 6)
scene.add(sun)

const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x0f5557, roughness: 0.9 }))
sea.rotation.x = -Math.PI / 2
scene.add(sea)
// 제주 남쪽 해안을 흉내 낸 납작한 땅 (실측 지형이 아니라 장식)
const land = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.3, 64), new THREE.MeshStandardMaterial({ color: 0xb9dcc9, roughness: 1 }))
land.scale.set(17, 1, 5.2)
land.position.set(0, 0.15, -3.2)
scene.add(land)

// 위경도 -> 지도 좌표 (1 unit ≈ 1km)
const project = (lat, lon) => new THREE.Vector3((lon - 126.45) * 93, 0, -(lat - 33.26) * 111)

const bars = new Map() // id -> { mesh, ring, site }
const pickables = []

function label(text) {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 96
  const g = c.getContext('2d')
  g.font = '700 44px "Malgun Gothic", sans-serif'
  g.textAlign = 'center'
  g.lineWidth = 8; g.strokeStyle = '#12201F'; g.strokeText(text, 256, 62)
  g.fillStyle = '#FFF3DE'; g.fillText(text, 256, 62)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }))
  sp.scale.set(4.2, 0.79, 1)
  return sp
}

function buildBars(sites, snapshot) {
  const max = Math.max(1, ...snapshot.map((s) => s.visitors ?? 0))
  for (const site of sites) {
    const snap = snapshot.find((s) => s.id === site.id)
    const h = snap?.visitors ? 0.5 + (snap.visitors / max) * 4.5 : 0.5
    const p = project(site.lat, site.lon)
    const mat = new THREE.MeshStandardMaterial({ color: site.indoor ? 0xffc21a : 0xff5a1f, roughness: 0.5, emissive: 0x000000 })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 0.9), mat)
    mesh.position.set(p.x, 0.3 + h / 2, p.z)
    mesh.userData = { site, snap }
    scene.add(mesh)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0 }))
    ring.rotation.x = -Math.PI / 2
    ring.position.set(p.x, 0.34, p.z)
    scene.add(ring)
    const sp = label(site.name)
    sp.position.set(p.x, 0.3 + h + 0.8, p.z)
    scene.add(sp)
    bars.set(site.id, { mesh, ring, site })
    pickables.push(mesh)
  }
}

function highlight(ids) {
  for (const [id, b] of bars) {
    const on = ids.includes(id)
    b.mesh.material.emissive.setHex(on ? 0x664400 : 0x000000)
    b.ring.material.opacity = on ? 1 : 0
  }
}

function resize() {
  const w = innerWidth, h = innerHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  // 폰에서는 아래쪽 52%를 패널이 덮으므로 장면을 위로 올려 막대가 가려지지 않게 한다
  if (w <= 720) camera.setViewOffset(w, h, 0, h * 0.24, w, h)
  else camera.clearViewOffset()
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()

const clock = new THREE.Clock()
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime()
  for (const b of bars.values()) if (b.ring.material.opacity > 0) b.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.12)
  controls.update()
  renderer.render(scene, camera)
})

const ray = new THREE.Raycaster(), mouse = new THREE.Vector2()
renderer.domElement.addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
  ray.setFromCamera(mouse, camera)
  const hit = ray.intersectObjects(pickables)[0]
  if (!hit) { tip.hidden = true; return }
  const { site, snap } = hit.object.userData
  tip.textContent = `${site.name} · ` + (snap?.visitors ? `이번 달 평균 ${snap.visitors.toLocaleString()}명 (연중 ${snap.rank}위)` : '관람객 자료 없음')
  tip.style.left = e.clientX + 12 + 'px'
  tip.style.top = e.clientY + 12 + 'px'
  tip.hidden = false
})

// ── 에이전트 대화 ───────────────────────────────────────────────────
function add(cls, text) {
  const d = document.createElement('div')
  d.className = 'msg ' + cls
  d.textContent = text
  log.appendChild(d)
  log.scrollTop = log.scrollHeight
  return d
}

function describe(t) {
  const site = t.input.site
  if (t.tool === 'get_weather_forecast') {
    if (!t.ok) return `① ${site} 날씨 — 실패: ${t.output.error}`
    const h = t.output.hours[0]
    return `① ${site} 날씨 — ${h.time} ${h.tmp}℃ ${h.sky}, 강수확률 ${h.pop}%`
  }
  return t.ok ? `② ${site} 관람객 — ${t.output.month}월 평균 ${t.output.monthAverage.toLocaleString()}명 (연중 ${t.output.crowdRankOf12}위)` : `② ${site} 관람객 — 실패: ${t.output.error}`
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const question = qInput.value.trim()
  if (!question) return
  qInput.value = ''
  add('user', question)
  const wait = add('bot', '날씨와 관람객 자료를 보는 중…')
  sendBtn.disabled = true
  highlight([])
  try {
    const res = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || res.status)
    wait.textContent = data.answer
    if (data.trace.length) {
      const tr = document.createElement('div')
      tr.className = 'trace'
      tr.textContent = data.trace.map(describe).join('\n')
      tr.style.whiteSpace = 'pre-wrap'
      log.appendChild(tr)
      for (const [id, tool] of [['t-weather', 'get_weather_forecast'], ['t-visitors', 'get_visitor_trend']]) {
        $(id).classList.toggle('on', data.trace.some((t) => t.tool === tool))
      }
    }
    highlight(data.picks)
    const first = bars.get(data.picks[0])
    if (first) controls.target.lerp(first.mesh.position, 0.6)
  } catch (err) {
    wait.className = 'msg err'
    wait.textContent = '오류: ' + err.message
  } finally {
    sendBtn.disabled = false
    log.scrollTop = log.scrollHeight
  }
})

;(async () => {
  try {
    const info = await (await fetch('/api/agent')).json()
    buildBars(info.sites, info.snapshot)
    if (!info.csvReady) {
      notice.hidden = false
      notice.textContent = '관람객 CSV(api/_data/seogwipo-visitors.csv)가 아직 없어요. 막대는 같은 높이로 보이고, 관람객 도구는 실패해요.'
    }
    add('bot', `안녕하세요! 오늘 날씨를 보고 서귀포 관광지를 골라 드릴게요. 예) "비 와도 갈 만한 곳 알려줘"`)
  } catch {
    notice.hidden = false
    notice.textContent = '서버(/api/agent)에 연결하지 못했어요. npm run dev 로 열었는지 확인해 주세요.'
  }
})()
