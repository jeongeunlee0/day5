// 호출 제한 (서버리스 인스턴스 메모리 기준의 최선형 제한).
// 인스턴스가 여러 개이거나 새로 뜨면 횟수가 따로 세어지므로 "완벽한 차단"이 아니라 "반복 호출로 비용이 폭주하는 것을 늦추는 장치"다.
// 더 단단하게 막으려면 Vercel 방화벽의 Rate Limiting 같은 플랫폼 기능을 함께 쓴다.
const hits = new Map() // 키(IP) -> 요청 시각 배열
const DAY = 86400e3
const MINUTE = 60e3

const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d }
export const limits = () => ({
  perMin: int(process.env.RATE_LIMIT_PER_MIN, 8),
  perDay: int(process.env.RATE_LIMIT_PER_DAY, 60),
})

export function clientIp(req) {
  const fwd = String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim()
  return fwd || req.socket?.remoteAddress || 'unknown'
}

/** 허용이면 { ok: true } 를 돌려주고 이번 요청을 기록한다. 초과면 { ok: false, retryAfter(초), reason } */
export function checkLimit(key, { perMin, perDay } = limits(), now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < DAY)
  const lastMinute = recent.filter((t) => now - t < MINUTE)
  if (lastMinute.length >= perMin) return { ok: false, reason: 'minute', retryAfter: Math.max(1, Math.ceil((MINUTE - (now - lastMinute[0])) / 1000)) }
  if (recent.length >= perDay) return { ok: false, reason: 'day', retryAfter: Math.max(1, Math.ceil((DAY - (now - recent[0])) / 1000)) }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < DAY)) hits.delete(k) // 오래된 키 정리
  return { ok: true }
}

export const _resetForTests = () => hits.clear()
