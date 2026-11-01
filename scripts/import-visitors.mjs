// 공공데이터포털 15125100(서귀포시 직영관광지 관람객수 추이) CSV 를 검증하고 api/_data/seogwipo-visitors.csv 로 정리해 넣는다.
//
//   node scripts/import-visitors.mjs <내려받은.csv>             검증 후 api/_data/seogwipo-visitors.csv 에 저장
//   node scripts/import-visitors.mjs <내려받은.csv> --dry-run   검증만 하고 저장하지 않음
//
// 왜 필요한가: 에이전트의 CSV 읽기는 쉼표로 단순 분리한다. 포털 파일은 EUC-KR 인코딩이거나 숫자가 "12,345" 처럼 따옴표 안에
// 쉼표를 포함할 수 있어서, 그대로 넣으면 숫자가 어긋난다. 이 도구가 UTF-8·순수 숫자 형태로 정리하고, 이상한 값은 미리 알려 준다.
import fs from 'node:fs'
import path from 'node:path'

const REQUIRED = ['기준연도', '기준월', '천지연폭포', '천제연폭포', '정방폭포', '중문대포 주상절리대', '산방산_용머리', '감귤박물관']
const OPTIONAL = ['데이터기준일자']
const SITE_COLS = REQUIRED.slice(2)
const OUT = path.resolve('api/_data/seogwipo-visitors.csv')

const args = process.argv.slice(2)
const dry = args.includes('--dry-run')
const input = args.find((a) => !a.startsWith('--'))
if (!input) { console.error('사용법: node scripts/import-visitors.mjs <내려받은.csv> [--dry-run]'); process.exit(2) }
if (!fs.existsSync(input)) { console.error(`파일이 없어요: ${input}`); process.exit(2) }

const errors = [], warnings = []
const fail = (m) => errors.push(m), warn = (m) => warnings.push(m)

// 1) 인코딩: UTF-8 로 읽어 보고 깨지면 EUC-KR(CP949)
const buf = fs.readFileSync(input)
let text = new TextDecoder('utf-8').decode(buf), encoding = 'UTF-8'
if (text.includes('�')) { text = new TextDecoder('euc-kr').decode(buf); encoding = 'EUC-KR' }
text = text.replace(/^﻿/, '')

// 2) 따옴표를 존중하는 CSV 파서 ("a,b" 안의 쉼표, "" 이스케이프)
function parseCsv(src) {
  const rows = []; let row = [], cell = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = [] }
    else cell += c
  }
  row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}
const rows = parseCsv(text)
if (rows.length < 2) { console.error('데이터 행이 없어요. 올바른 CSV 인지 확인해 주세요.'); process.exit(1) }

// 3) 헤더 검증
const header = rows[0].map((h) => h.trim())
const missing = REQUIRED.filter((c) => !header.includes(c))
if (missing.length) fail(`필요한 열이 없어요: ${missing.join(', ')}  (파일의 열: ${header.join(', ')})`)
const keep = [...REQUIRED, ...OPTIONAL.filter((c) => header.includes(c))]
const col = Object.fromEntries(keep.map((c) => [c, header.indexOf(c)]))

// 4) 값 검증 + 정리 (숫자의 쉼표·공백 제거)
const nowYear = new Date().getFullYear()
const clean = [], seen = new Map()
if (!missing.length) {
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2
    const year = Number(String(r[col['기준연도']] ?? '').replace(/\D/g, ''))
    const month = Number(String(r[col['기준월']] ?? '').replace(/\D/g, ''))
    if (!(year >= 1990 && year <= nowYear + 1)) return fail(`${line}행: 기준연도가 이상해요 (${r[col['기준연도']]})`)
    if (!(month >= 1 && month <= 12)) return fail(`${line}행: 기준월이 1~12 가 아니에요 (${r[col['기준월']]})`)
    const key = `${year}-${month}`
    if (seen.has(key)) return fail(`${line}행: ${year}년 ${month}월이 ${seen.get(key)}행과 중복이에요`)
    seen.set(key, line)
    const out = [String(year), String(month)]
    for (const s of SITE_COLS) {
      const raw = String(r[col[s]] ?? '').trim()
      if (raw === '' || raw === '-') { warn(`${line}행(${year}-${month}): '${s}' 가 비어 있어 0으로 처리해요`); out.push('0'); continue }
      const n = Number(raw.replace(/[,\s]/g, ''))
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) { fail(`${line}행: '${s}' 값이 올바른 관람객 수가 아니에요 (${raw})`); out.push('0'); continue }
      out.push(String(n))
    }
    if (OPTIONAL.some((c) => c in col && col[c] >= 0)) out.push(String(r[col['데이터기준일자']] ?? '').trim())
    clean.push({ year, month, out })
  })
}

// 5) 연도별로 12개월이 다 있는지 (빠진 달은 월평균을 왜곡한다)
const byYear = new Map()
for (const c of clean) byYear.set(c.year, (byYear.get(c.year) ?? new Set()).add(c.month))
for (const [y, ms] of [...byYear].sort((a, b) => a[0] - b[0])) if (ms.size < 12) warn(`${y}년은 ${ms.size}개월 자료만 있어요 (없는 달: ${[...Array(12)].map((_, i) => i + 1).filter((m) => !ms.has(m)).join(', ')})`)

// 6) 결과 요약
console.log(`파일: ${input}`)
console.log(`인코딩: ${encoding}${encoding === 'EUC-KR' ? ' (UTF-8 로 변환해 저장)' : ''} · 행 ${clean.length}개 · 연도 ${[...byYear.keys()].sort().join(', ') || '없음'}`)
if (clean.length) {
  const total = (i) => clean.reduce((a, c) => a + Number(c.out[2 + i]), 0)
  console.log('관광지별 전체 합계(건전성 확인용):')
  SITE_COLS.forEach((s, i) => console.log(`  ${s.padEnd(12)} ${total(i).toLocaleString('ko-KR')}명`))
}
warnings.slice(0, 15).forEach((w) => console.log('  주의:', w))
if (warnings.length > 15) console.log(`  주의: … 외 ${warnings.length - 15}건`)
if (errors.length) { errors.slice(0, 25).forEach((e) => console.error('  오류:', e)); console.error(`\n실패: 오류 ${errors.length}건 — 저장하지 않았어요`); process.exit(1) }

const head = [...REQUIRED, ...keep.filter((c) => OPTIONAL.includes(c))]
const body = clean.sort((a, b) => a.year - b.year || a.month - b.month).map((c) => c.out.join(','))
if (dry) { console.log('\n검증 통과 (--dry-run 이라 저장하지 않았어요)'); process.exit(0) }
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, [head.join(','), ...body].join('\n') + '\n')
console.log(`\n저장했어요: ${path.relative(process.cwd(), OUT)} (UTF-8, ${body.length}행)`)
console.log('다음: 커밋·푸시하면 배포에 포함돼요. 에이전트 화면의 "CSV 없음" 안내가 사라지는지 확인하세요.')
