// AI 키가 없을 때 쓰는 규칙 기반 안내. 같은 도구(날씨·관람객 통계)를 그대로 쓰고,
// 모델 대신 아래의 단순한 규칙으로 고른다. 모델의 판단이 아니라는 점을 답변에도 밝힌다.
import { SITES } from './sites.js'
import { runTool } from './tools.js'

const RAINY = /비|눈|소나기|이슬비|뇌우/
const HOURS = 12 // 앞으로 12시간의 예보를 본다
const POP_LIMIT = 50 // 강수확률이 이 값(%) 이상이면 야외를 피한다
const WIND_LIMIT = 10 // 풍속이 이 값(m/s) 이상이면 야외를 피한다

const kstMonth = () => new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1

function summarize(site, weather, visitors) {
  const hs = weather.error ? [] : weather.hours.slice(0, HOURS)
  const known = hs.length > 0
  const maxPop = known ? Math.max(...hs.map((h) => h.pop ?? 0)) : null
  const maxWind = known ? Math.max(...hs.map((h) => h.wind ?? 0)) : null
  const temps = hs.map((h) => h.tmp)
  const wet = hs.some((h) => RAINY.test(h.sky) || (h.rainMm ?? 0) > 0.2)
  const problems = []
  if (wet) problems.push('비·눈 예보')
  if (known && maxPop >= POP_LIMIT) problems.push(`강수확률 ${maxPop}%`)
  if (known && maxWind >= WIND_LIMIT) problems.push(`강풍 ${maxWind}m/s`)
  return {
    site, known, maxPop, maxWind, wet, problems,
    tmin: known ? Math.min(...temps) : null, tmax: known ? Math.max(...temps) : null,
    rank: visitors.error ? null : visitors.crowdRankOf12, // 1 = 연중 가장 붐비는 달
  }
}

function weatherLine(r) {
  return `앞으로 ${HOURS}시간 기온 ${r.tmin}~${r.tmax}℃, 강수확률 최대 ${r.maxPop}%, 풍속 최대 ${r.maxWind}m/s`
}

export async function runRules(question) {
  const month = kstMonth()
  const q = String(question)
  const wantIndoor = /실내|비 ?(와|오|올|내)|우천|눈 ?(와|오|올)/.test(q)
  const wantOutdoor = /야외|산책|걷|바다|폭포|경치/.test(q)
  const wantQuiet = /붐비|한적|조용|혼잡|사람 ?(적|없|많)/.test(q)

  // 도구 호출: 관광지마다 날씨 + 이 달의 관람객 통계
  const calls = await Promise.all(SITES.map(async (s) => {
    const [weather, visitors] = await Promise.all([
      runTool('get_weather_forecast', { site: s.name }),
      runTool('get_visitor_trend', { site: s.name, month }),
    ])
    return { s, weather, visitors }
  }))
  const trace = calls.flatMap(({ s, weather, visitors }) => [
    { tool: 'get_weather_forecast', input: { site: s.name }, ok: !weather.error, output: weather },
    { tool: 'get_visitor_trend', input: { site: s.name, month }, ok: !visitors.error, output: visitors },
  ])
  const rows = calls.map(({ s, weather, visitors }) => summarize(s, weather, visitors))

  if (!rows.some((r) => r.known)) {
    return { answer: '날씨 정보를 가져오지 못해서 추천을 드리기 어려워요. 잠시 후 다시 물어봐 주세요.', picks: [], trace, mode: 'rules' }
  }

  // 점수: 야외는 날씨가 나쁘면 크게 감점, 실내는 야외가 나쁠 때 가점. 붐비지 않는 달일수록 가점.
  const outdoorBad = rows.some((r) => !r.site.indoor && r.problems.length > 0)
  const scored = rows.map((r, i) => {
    let score = r.site.indoor ? (outdoorBad ? 4 : 1) : (r.known ? (r.problems.length ? -4 : 3) : 0)
    if (wantIndoor && r.site.indoor) score += 3
    if (wantOutdoor && !r.site.indoor && r.problems.length === 0) score += 2
    if (r.rank) score += ((r.rank - 1) / 11) * (wantQuiet ? 3 : 1) // rank 12 = 가장 한적한 달
    return { r, score, order: i }
  }).sort((a, b) => b.score - a.score || a.order - b.order)

  const top = scored[0].r
  const alt = (scored.find((x) => x.r.site.indoor !== top.site.indoor) ?? scored[1])?.r

  const why = []
  if (top.known) why.push(weatherLine(top))
  if (top.site.indoor && outdoorBad) {
    const bad = rows.filter((r) => !r.site.indoor && r.problems.length)
    why.push(`야외 관광지는 ${[...new Set(bad.flatMap((r) => r.problems))].join('·')} 예보라 실내를 우선했어요`)
  } else if (!top.site.indoor && top.problems.length === 0) {
    why.push('비·강풍 예보가 없어 야외 관람에 무리가 없어요')
  }
  why.push(top.rank ? `${month}월은 연중 ${top.rank}위로 붐비는 달이에요 (1위가 가장 붐빔, 월 평균 통계)` : '관람객 통계 자료가 없어 붐비는 정도는 반영하지 못했어요')

  const lines = [
    `1순위: ${top.site.name} (${top.site.indoor ? '실내' : '야외'})`,
    ...why.map((w) => `- ${w}`),
    ...(alt ? [`대안: ${alt.site.name} (${alt.site.indoor ? '실내' : '야외'})`] : []),
    '',
    `※ AI 키가 설정되지 않아 날씨와 관람객 숫자만으로 정한 규칙 기반 안내예요. (강수확률 ${POP_LIMIT}% 이상·풍속 ${WIND_LIMIT}m/s 이상·비·눈 예보면 야외를 피합니다)`,
  ]
  return { answer: lines.join('\n'), picks: [top.site.id, ...(alt ? [alt.site.id] : [])], trace, mode: 'rules' }
}
