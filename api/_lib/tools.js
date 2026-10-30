import fs from 'node:fs'
import path from 'node:path'
import { SITES, findSite, toGrid } from './sites.js'

const SKY = { 1: '맑음', 3: '구름많음', 4: '흐림' }
const PTY = { 0: '없음', 1: '비', 2: '비/눈', 3: '눈', 4: '소나기' }
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]
const siteEnum = SITES.map((s) => s.name)

// ── 도구 정의 (Claude 에게 보이는 "손" 2개) ─────────────────────────────
export const toolDefs = [
  {
    name: 'get_weather_forecast',
    description:
      '기상청 단기예보(VilageFcstInfoService_2.0)로 서귀포 관광지 한 곳의 앞으로 약 24시간 예보를 가져온다. ' +
      '시간별 기온(℃), 하늘상태, 강수형태, 강수확률(%), 풍속(m/s)을 돌려준다. 야외/실내 판단 전에 호출한다.',
    input_schema: {
      type: 'object',
      properties: { site: { type: 'string', enum: siteEnum, description: '관광지 이름' } },
      required: ['site'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'get_visitor_trend',
    description:
      '서귀포시 직영관광지 관람객수 추이(공공데이터 15125100, 월별)에서 한 곳의 최근 연도 월별 관람객수와 ' +
      '전체 연도 월평균, 그리고 지정한 달이 그 관광지의 연중 몇 번째로 붐비는 달인지를 돌려준다. ' +
      '"지금 붐빌까?" 판단에 쓴다. 실시간 인원이 아니라 월 단위 통계다.',
    input_schema: {
      type: 'object',
      properties: {
        site: { type: 'string', enum: siteEnum, description: '관광지 이름' },
        month: { type: 'integer', minimum: 1, maximum: 12, description: '혼잡 순위를 볼 달 (생략하면 이번 달)' },
      },
      required: ['site'],
      additionalProperties: false,
    },
  },
]

// ── 도구 1: 기상청 단기예보 ───────────────────────────────────────────
const kst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3) // UTC getter 로 읽으면 KST
const pad = (n) => String(n).padStart(2, '0')
const ymd = (k) => `${k.getUTCFullYear()}${pad(k.getUTCMonth() + 1)}${pad(k.getUTCDate())}`

function latestBase(now = new Date()) {
  // 발표 후 약 10분 뒤부터 조회 가능 -> 10분 전 시각 기준으로 가장 가까운 발표 시각
  const k = kst(new Date(now.getTime() - 10 * 60e3))
  const h = k.getUTCHours()
  const found = [...BASE_HOURS].reverse().find((b) => b <= h)
  if (found === undefined) {
    const y = new Date(k.getTime() - 24 * 3600e3)
    return { date: ymd(y), time: '2300' }
  }
  return { date: ymd(k), time: `${pad(found)}00` }
}

const fcstCache = new Map() // key -> { at, value }

async function getWeatherForecast({ site }) {
  const s = findSite(site)
  if (!s) return { error: `알 수 없는 관광지: ${site}` }
  const key = process.env.KMA_SERVICE_KEY
  if (!key) return { error: 'KMA_SERVICE_KEY 가 설정되지 않았다.' }

  const { nx, ny } = toGrid(s.lat, s.lon)
  const base = latestBase()
  const ck = `${nx},${ny},${base.date}${base.time}`
  const hit = fcstCache.get(ck)
  if (hit && Date.now() - hit.at < 10 * 60e3) return hit.value

  const url = new URL('http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst')
  // serviceKey 는 포털이 주는 값(이미 인코딩된 Encoding 키 또는 Decoding 키) 둘 다 받도록 한 번 디코딩 후 다시 인코딩
  const decoded = (() => { try { return decodeURIComponent(key) } catch { return key } })()
  url.searchParams.set('serviceKey', decoded)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '300')
  url.searchParams.set('dataType', 'JSON')
  url.searchParams.set('base_date', base.date)
  url.searchParams.set('base_time', base.time)
  url.searchParams.set('nx', String(nx))
  url.searchParams.set('ny', String(ny))

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  const text = await res.text()
  let body
  try { body = JSON.parse(text).response } catch { return { error: `기상청 응답 오류(${res.status}): ${text.slice(0, 200)}` } }
  if (body?.header?.resultCode !== '00') return { error: `기상청 오류: ${body?.header?.resultMsg ?? 'unknown'}` }

  const byTime = new Map()
  for (const it of body.body.items.item) {
    const t = `${it.fcstDate}${it.fcstTime}`
    if (!byTime.has(t)) byTime.set(t, { date: it.fcstDate, time: it.fcstTime })
    byTime.get(t)[it.category] = it.fcstValue
  }
  const hours = [...byTime.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 24).map(([, v]) => ({
    time: `${v.date.slice(4, 6)}/${v.date.slice(6)} ${v.time.slice(0, 2)}시`,
    tmp: Number(v.TMP),
    sky: SKY[v.SKY] ?? v.SKY,
    rain: PTY[v.PTY] ?? v.PTY,
    pop: Number(v.POP),
    wind: Number(v.WSD),
  }))
  const value = { site: s.name, grid: { nx, ny }, base: `${base.date} ${base.time}`, hours }
  fcstCache.set(ck, { at: Date.now(), value })
  return value
}

// ── 도구 2: 제주 공공데이터 15125100 (관람객수 추이 CSV) ───────────────
export const CSV_PATH = path.join(process.cwd(), 'api', '_data', 'seogwipo-visitors.csv')

function decodeCsv(buf) {
  let t = new TextDecoder('utf-8').decode(buf)
  if (t.includes('�')) t = new TextDecoder('euc-kr').decode(buf) // 공공데이터 CSV 는 CP949 가 흔하다
  return t.replace(/^﻿/, '')
}

let rowsCache
export function loadVisitorRows() {
  if (rowsCache) return rowsCache
  if (!fs.existsSync(CSV_PATH)) return null
  const lines = decodeCsv(fs.readFileSync(CSV_PATH)).split(/\r?\n/).filter((l) => l.trim())
  const head = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  rowsCache = lines.slice(1).map((l) => {
    const cells = l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]))
  })
  return rowsCache
}

const num = (v) => Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0

function getVisitorTrend({ site, month }) {
  const s = findSite(site)
  if (!s) return { error: `알 수 없는 관광지: ${site}` }
  const rows = loadVisitorRows()
  if (!rows) return { error: `관람객 CSV 가 없다: ${path.relative(process.cwd(), CSV_PATH)}` }
  if (!(s.column in (rows[0] ?? {}))) return { error: `CSV 에 '${s.column}' 열이 없다.` }

  const m = month ?? kst().getUTCMonth() + 1
  const years = [...new Set(rows.map((r) => r['기준연도']))].sort()
  const latestYear = years[years.length - 1]
  const avg = Array.from({ length: 12 }, (_, i) => {
    const vals = rows.filter((r) => num(r['기준월']) === i + 1).map((r) => num(r[s.column]))
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  })
  const rank = [...avg].sort((a, b) => b - a).indexOf(avg[m - 1]) + 1
  return {
    site: s.name,
    years: `${years[0]}~${latestYear}`,
    latestYear,
    latestYearByMonth: rows.filter((r) => r['기준연도'] === latestYear).map((r) => ({ month: num(r['기준월']), visitors: num(r[s.column]) })),
    monthlyAverage: avg,
    month: m,
    monthAverage: avg[m - 1],
    crowdRankOf12: rank, // 1 = 연중 가장 붐비는 달
  }
}

// 지도 막대 높이용: 모든 관광지의 해당 월 평균 관람객
export function monthSnapshot(month) {
  return SITES.map((s) => {
    const r = getVisitorTrend({ site: s.name, month })
    return { id: s.id, visitors: r.error ? null : r.monthAverage, rank: r.error ? null : r.crowdRankOf12 }
  })
}

export async function runTool(name, input) {
  try {
    if (name === 'get_weather_forecast') return await getWeatherForecast(input)
    if (name === 'get_visitor_trend') return getVisitorTrend(input)
    return { error: `없는 도구: ${name}` }
  } catch (e) {
    return { error: String(e?.message ?? e) }
  }
}
