import Anthropic from '@anthropic-ai/sdk'
import { SITES } from './_lib/sites.js'
import { toolDefs, runTool, monthSnapshot, loadVisitorRows } from './_lib/tools.js'
import { runRules } from './_lib/rules.js'
import { checkLimit, clientIp } from './_lib/limit.js'

const MAX_BODY = 10_000 // 바이트. 질문은 500자까지만 쓰므로 이보다 큰 요청은 받지 않는다

const client = new Anthropic() // ANTHROPIC_API_KEY 는 서버 환경변수에서만 읽는다
const MODEL = 'claude-opus-5-5'
const MAX_TURNS = 8

const SYSTEM = `너는 "서귀포 길잡이"다. 오늘 날씨를 보고 서귀포시 직영 관광지 6곳 중 어디를 갈지 골라 준다.
관광지: ${SITES.map((s) => `${s.name}(${s.indoor ? '실내' : '야외'})`).join(', ')}.

쓸 수 있는 도구는 둘이다.
- get_weather_forecast: 날씨 예보(Open-Meteo). 가려는 후보마다 호출한다.
- get_visitor_trend: 서귀포시 관람객수 추이(월별 통계). 붐비는 정도를 가늠할 때 쓴다.

규칙:
- 날씨 숫자는 반드시 도구 결과에서만 인용한다. 도구가 실패하면 실패했다고 말하고 추측하지 않는다.
- 관람객 자료는 월 단위 통계라서 "지금 사람이 많다"가 아니라 "이 달에 보통 붐비는 편"이라고 표현한다.
- 비·눈·강풍이면 실내(감귤박물관)를 우선 권한다. 맑으면 야외를 권하고 붐비는 곳은 시간대를 알려 준다.
- 답은 한국어로 짧게: 1순위 추천, 이유 2~3줄, 대안 1곳. 마지막 줄에 정확히 "PICKS: 이름1, 이름2" 형식으로 추천한 관광지 이름만 적는다.
오늘 날짜: ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'full' })}.`

async function runAgent(question) {
  const messages = [{ role: 'user', content: question }]
  const trace = []

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools: toolDefs,
      messages,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })

    messages.push({ role: 'assistant', content: res.content }) // thinking 블록 포함 그대로 되돌려 보낸다

    if (res.stop_reason === 'refusal') return { answer: '이 요청은 답할 수 없어요.', picks: [], trace }
    if (res.stop_reason !== 'tool_use') {
      const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
      const m = text.match(/PICKS:\s*(.+)\s*$/m)
      const names = m ? m[1].split(/[,，]/).map((s) => s.trim()) : []
      const picks = SITES.filter((s) => names.includes(s.name)).map((s) => s.id)
      return { answer: text.replace(/\n?PICKS:.*$/m, '').trim(), picks, trace }
    }

    const calls = res.content.filter((b) => b.type === 'tool_use')
    const results = await Promise.all(
      calls.map(async (c) => {
        const out = await runTool(c.name, c.input)
        trace.push({ tool: c.name, input: c.input, ok: !out.error, output: out })
        return { type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out), is_error: !!out.error }
      }),
    )
    messages.push({ role: 'user', content: results }) // 병렬 호출 결과는 한 메시지에 모은다
  }
  return { answer: '도구를 너무 많이 써서 멈췄어요. 질문을 조금 좁혀 주세요.', picks: [], trace }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method === 'GET') {
    // 지도 첫 화면용: 관광지 목록과 이번 달 관람객 통계
    const month = new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1
    return res.end(JSON.stringify({
      sites: SITES,
      month,
      csvReady: !!loadVisitorRows(),
      ai: !!process.env.ANTHROPIC_API_KEY, // false 면 규칙 기반 안내 모드
      snapshot: monthSnapshot(month),
    }))
  }
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('{}') }

  try {
    let body = req.body
    if (body === undefined) { // 일반 Node 요청(개발 서버)이면 직접 읽는다
      const chunks = []
      let size = 0
      for await (const c of req) {
        size += c.length
        if (size > MAX_BODY) { res.statusCode = 413; return res.end(JSON.stringify({ error: '요청이 너무 커요.' })) }
        chunks.push(c)
      }
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { body = null }
    }
    if (body === null || typeof body === 'string') { res.statusCode = 400; return res.end(JSON.stringify({ error: '요청 형식이 올바르지 않아요.' })) }
    const question = String(body?.question ?? '').trim().slice(0, 500)
    if (!question) { res.statusCode = 400; return res.end(JSON.stringify({ error: '질문이 비었어요.' })) }

    // 입력 검증 다음에 호출 제한. 반복 호출로 모델 비용·외부 API 호출이 늘어나는 것을 막는다.
    const limit = checkLimit(clientIp(req))
    if (!limit.ok) {
      res.statusCode = 429
      res.setHeader('Retry-After', String(limit.retryAfter))
      const wait = limit.retryAfter >= 3600 ? `${Math.ceil(limit.retryAfter / 3600)}시간` : limit.retryAfter >= 60 ? `${Math.ceil(limit.retryAfter / 60)}분` : `${limit.retryAfter}초`
      return res.end(JSON.stringify({ error: `요청이 너무 많아요. ${wait} 뒤에 다시 시도해 주세요.` }))
    }

    // 키가 있으면 Claude 가, 없으면 같은 도구를 쓰는 규칙 기반 안내가 답한다 (mode 로 구분)
    if (!process.env.ANTHROPIC_API_KEY) return res.end(JSON.stringify(await runRules(question)))
    return res.end(JSON.stringify({ ...(await runAgent(question)), mode: 'ai' }))
  } catch (e) {
    console.error(e)
    res.statusCode = e instanceof Anthropic.APIError ? 502 : 500
    return res.end(JSON.stringify({ error: '에이전트 실행 중 오류가 났어요.' }))
  }
}
