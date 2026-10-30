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
