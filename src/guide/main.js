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

// ── 에이전트: 찾기 → 판단 → 실행 (스킬 3개) ──────────────────────────
const SUGGEST = ['비 와도 갈 만한 곳 알려줘', '오늘 덜 붐비는 곳은 어디야?', '야외에서 산책하기 좋은 곳 추천해줘']
const RAINY = /비|눈|소나기|이슬비|뇌우/
const nameOf = (id) => bars.get(id)?.site.name

function add(cls, text) {
  const d = document.createElement('div')
  d.className = 'msg ' + cls
  d.textContent = text
  log.appendChild(d)
  log.scrollTop = log.scrollHeight
  return d
}

// 도구 호출 한 건을 사람이 읽는 한 줄로
function describe(t) {
  const site = t.input.site
  if (t.tool === 'get_weather_forecast') {
    if (!t.ok) return `${site} 날씨 — 실패: ${t.output.error}`
    const h = t.output.hours[0]
    return `${site} 날씨 — ${h.time} ${h.tmp}℃ ${h.sky}, 강수확률 ${h.pop}%`
  }
  return t.ok ? `${site} 관람객 — ${t.output.month}월 평균 ${t.output.monthAverage.toLocaleString()}명 (연중 ${t.output.crowdRankOf12}위)` : `${site} 관람객 — 실패: ${t.output.error}`
}

const SKILLS = {
  // 찾기: 에이전트가 부른 도구와 그 결과
  find(data) {
    return data.trace.length ? data.trace.map(describe) : ['도구를 쓰지 않고 답했어요']
  },
  // 판단: 도구 결과에서 읽은 숫자만 정리 (모델의 결론은 위 답변 본문)
  judge(data) {
    const rows = []
    for (const t of data.trace) {
      if (!t.ok) continue
      if (t.tool === 'get_weather_forecast') {
        const hs = t.output.hours
        const maxPop = Math.max(...hs.map((h) => h.pop ?? 0))
        const temps = hs.map((h) => h.tmp)
        const wet = hs.some((h) => RAINY.test(h.sky))
        rows.push(`${t.input.site}: 강수확률 최대 ${maxPop}% · ${wet ? '비·눈 예보 있음' : '비·눈 예보 없음'} · ${Math.min(...temps)}~${Math.max(...temps)}℃`)
      } else {
        rows.push(`${t.input.site}: ${t.output.month}월은 연중 ${t.output.crowdRankOf12}위 (1위가 가장 붐빔)`)
      }
    }
    const picks = data.picks.map(nameOf).filter(Boolean)
    rows.push(picks.length ? `결론: ${picks.join(', ')}` : '결론: 지도에 표시할 추천을 찾지 못했어요')
    return rows
  },
  // 실행: 지도에 반영 (막대 강조 + 카메라 이동)
  act(data) {
    highlight(data.picks)
    const first = bars.get(data.picks[0])
    if (first) controls.target.lerp(first.mesh.position, 0.6)
    const names = data.picks.map(nameOf).filter(Boolean)
    return [names.length ? `지도에서 ${names.join(', ')} 표시 · 카메라를 ${names[0]}(으)로 이동` : '지도에 표시할 곳이 없어요']
  },
}

function showAnswer(box, data) {
  box.textContent = data.answer
  const think = document.createElement('details')
  think.className = 'think'
  const sum = document.createElement('summary')
  sum.textContent = '생각 과정 보기'
  const steps = document.createElement('div')
  steps.className = 'steps'
  for (const [cls, label, skill] of [['f', '찾기', SKILLS.find], ['j', '판단', SKILLS.judge], ['a', '실행', SKILLS.act]]) {
    const row = document.createElement('div')
    row.className = cls
    row.textContent = label + '\n' + skill(data).join('\n')
    steps.appendChild(row)
  }
  think.append(sum, steps)
  box.appendChild(think)
  for (const [id, tool] of [['t-weather', 'get_weather_forecast'], ['t-visitors', 'get_visitor_trend']]) {
    $(id).classList.toggle('on', data.trace.some((t) => t.tool === tool))
  }
}

async function ask(question) {
  question = question.trim()
  if (!question) { qInput.focus(); return }
  qInput.value = ''
  add('user', question)
  const wait = add('bot', '')
  wait.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>'
  sendBtn.disabled = true
  highlight([])
  try {
    const res = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || res.status)
    showAnswer(wait, data)
  } catch (err) {
    wait.className = 'msg err'
    wait.textContent = '오류: ' + err.message
  } finally {
    sendBtn.disabled = false
    log.scrollTop = log.scrollHeight
  }
}

form.addEventListener('submit', (e) => { e.preventDefault(); ask(qInput.value) })
for (const s of SUGGEST) {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = s
  b.addEventListener('click', () => ask(s))
  $('chips').appendChild(b)
}

;(async () => {
  try {
    const info = await (await fetch('/api/agent')).json()
    buildBars(info.sites, info.snapshot)
    if (!info.csvReady) {
      notice.hidden = false
      notice.textContent = '관람객 CSV(api/_data/seogwipo-visitors.csv)가 아직 없어요. 막대는 같은 높이로 보이고, 관람객 도구는 실패해요.'
    }
    add('bot', '혼저 옵서예! 오늘 날씨를 보고 서귀포 관광지를 골라 드릴게요. 아래 질문을 눌러 보거나 직접 물어보세요.')
  } catch {
    notice.hidden = false
    notice.textContent = '서버(/api/agent)에 연결하지 못했어요. npm run dev 로 열었는지 확인해 주세요.'
  }
})()
