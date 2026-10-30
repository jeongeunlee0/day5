// 작은 도우미 모음: DOM 선택, 이스케이프, 금액·시간 표기, 저장소, 카테고리, 토스트
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (n) => Number(n).toLocaleString('ko-KR') + '원';
const icon = (n, cls = '') => `<svg class="i ${cls}"><use href="#i-${n}"/></svg>`;
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ago = (iso) => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return '방금 전'; if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전'; return new Date(iso).toLocaleDateString('ko-KR');
};
const TINTS = ['#FFD23F', '#FF9B6B', '#A8D5BA', '#9CC9E8', '#F4B6B0', '#F2E3B3'];
const tint = (id) => TINTS[Number(id) % TINTS.length];
const category = (e) => ({ '🍊': '과일', '🥕': '채소·곡물', '🌾': '채소·곡물', '🐖': '육류', '🐟': '수산', '🦑': '수산', '🐚': '수산' }[e] || '간식·가공');
const catOf = (p) => p.category || category(p.emoji);
// 카테고리 표기·순서는 public/data/products.json 의 meta.categories 와 같게 유지한다
const CAT_ORDER = ['과일', '채소·곡물', '육류', '수산', '간식·가공'];
const sortCats = (cs) => [...cs].sort((a, b) => (CAT_ORDER.indexOf(a) + 1 || 99) - (CAT_ORDER.indexOf(b) + 1 || 99));
function toast(msg, err) {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), 3000);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export { $, esc, won, icon, load, save, ago, tint, category, catOf, CAT_ORDER, sortCats, toast, sleep };
