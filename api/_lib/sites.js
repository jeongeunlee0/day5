// 서귀포시 직영 관광지 6곳 (공공데이터 15125100 의 열 이름과 같은 이름 사용)
export const SITES = [
  { id: 'cheonjiyeon', name: '천지연폭포', column: '천지연폭포', lat: 33.2471, lon: 126.5545, indoor: false },
  { id: 'cheonjeyeon', name: '천제연폭포', column: '천제연폭포', lat: 33.2548, lon: 126.4159, indoor: false },
  { id: 'jeongbang', name: '정방폭포', column: '정방폭포', lat: 33.2442, lon: 126.5724, indoor: false },
  { id: 'jusangjeolli', name: '중문대포 주상절리대', column: '중문대포 주상절리대', lat: 33.2381, lon: 126.4249, indoor: false },
  { id: 'sanbangsan', name: '산방산·용머리', column: '산방산_용머리', lat: 33.2323, lon: 126.3141, indoor: false },
  { id: 'citrus', name: '감귤박물관', column: '감귤박물관', lat: 33.2933, lon: 126.6213, indoor: true },
]

export const findSite = (idOrName) =>
  SITES.find((s) => s.id === idOrName || s.name === idOrName || s.column === idOrName)

// 위경도 -> 기상청 격자(nx, ny). 기상청 공식 Lambert Conformal Conic 변환식.
export function toGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136
  const D = Math.PI / 180
  const re = RE / GRID
  const slat1 = SLAT1 * D, slat2 = SLAT2 * D, olon = OLON * D, olat = OLAT * D
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = (re * sf) / Math.pow(ro, sn)
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5)
  ra = (re * sf) / Math.pow(ra, sn)
  let theta = lon * D - olon
  if (theta > Math.PI) theta -= 2 * Math.PI
  if (theta < -Math.PI) theta += 2 * Math.PI
  theta *= sn
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  }
}
