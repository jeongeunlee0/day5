import fs from 'node:fs'
import path from 'node:path'
import { SITES, findSite } from './sites.js'

// WMO 날씨 코드 -> 한글 (Open-Meteo weather_code)
const WMO = {
  0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림', 45: '안개', 48: '안개',
  51: '약한 이슬비', 53: '이슬비', 55: '강한 이슬비', 56: '어는 이슬비', 57: '강한 어는 이슬비',
  61: '약한 비', 63: '비', 65: '강한 비', 66: '어는 비', 67: '강한 어는 비',
  71: '약한 눈', 73: '눈', 75: '강한 눈', 77: '싸락눈',
  80: '약한 소나기', 81: '소나기', 82: '강한 소나기', 85: '약한 눈소나기', 86: '강한 눈소나기',
  95: '뇌우', 96: '우박 동반 뇌우', 99: '강한 우박 동반 뇌우',
}
const siteEnum = SITES.map((s) => s.name)

// ── 도구 정의 (Claude 에게 보이는 "손" 2개) ─────────────────────────────
export const toolDefs = [
  {
    name: 'get_weather_forecast',
    description:
      'Open-Meteo 예보(API 키 불필요)로 서귀포 관광지 한 곳의 앞으로 24시간 시간별 예보를 가져온다. ' +
      '시간별 기온(℃), 날씨(맑음·비·눈 등), 강수확률(%), 강수량(mm), 풍속(m/s)을 돌려준다. 야외/실내 판단 전에 호출한다.',
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

// ── 도구 1: Open-Meteo 날씨 예보 (API 키 불필요) ──────────────────
const kst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3) // UTC getter 로 읽으면 KST

const fcstCache = new Map() // site id -> { at, value }

async function getWeatherForecast({ site }) {
  const s = findSite(site)
  if (!s) return { error: `알 수 없는 관광지: ${site}` }

  const hit = fcstCache.get(s.id)
  if (hit && Date.now() - hit.at < 10 * 60e3) return hit.value

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(s.lat))
  url.searchParams.set('longitude', String(s.lon))
  url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m')
  url.searchParams.set('wind_speed_unit', 'ms')
  url.searchParams.set('forecast_days', '2')
  url.searchParams.set('timezone', 'Asia/Seoul')

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) return { error: `날씨 서비스 오류(${res.status})` }
  let h
  try { h = (await res.json()).hourly } catch { return { error: '날씨 응답을 읽지 못했다.' } }
  if (!h?.time?.length) return { error: '날씨 응답에 시간별 자료가 없다.' }

  // 응답 시각은 KST(ISO). 지금 시각 이후 24시간만 쓴다.
  const nowKst = kst().toISOString().slice(0, 13) + ':00'
  const from = Math.max(0, h.time.findIndex((x) => x >= nowKst))
  const hours = h.time.slice(from, from + 24).map((time, k) => {
    const i = from + k
    return {
      time: `${time.slice(5, 7)}/${time.slice(8, 10)} ${time.slice(11, 13)}시`,
      tmp: h.temperature_2m[i],
      sky: WMO[h.weather_code[i]] ?? `코드 ${h.weather_code[i]}`,
      pop: h.precipitation_probability[i],
      rainMm: h.precipitation[i],
      wind: h.wind_speed_10m[i],
    }
  })
  const value = { site: s.name, source: 'Open-Meteo', hours }
  fcstCache.set(s.id, { at: Date.now(), value })
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
