// 귤 마우스 커서: SVG 원본을 읽기 쉽게 두고 public/cursor.css 를 만든다.
//   node scripts/make-cursor.mjs
// 커서 이미지는 128px 이하여야 하고, 32px 가 가장 안정적이다. 핫스팟(클릭 지점)은 귤의 한가운데.
import fs from 'node:fs'
import path from 'node:path'

const INK = '#12201F'
const svg = (body) => `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>${body}</svg>`
const leaf = `<path d='M16 7c0-3 2.5-5 6-4.5-.5 3-3 5-6 4.5z' fill='#43A047' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/>`
const shine = `<path d='M9.5 14a7.5 7.5 0 0 1 5-4' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' opacity='.85'/>`
const blush = (o) => `<circle cx='8.6' cy='22' r='1.9' fill='#FF5A1F' opacity='${o}'/><circle cx='23.4' cy='22' r='1.9' fill='#FF5A1F' opacity='${o}'/>`

const CURSORS = {
  // 기본: 동그란 눈, 작은 미소
  default: svg(
    `<ellipse cx='16' cy='18' rx='12.5' ry='11.5' fill='#FF8A1F' stroke='${INK}' stroke-width='2'/>${leaf}${shine}` +
    `<circle cx='12' cy='18.5' r='1.7' fill='${INK}'/><circle cx='20' cy='18.5' r='1.7' fill='${INK}'/>` +
    `<path d='M13.5 22q2.5 2.2 5 0' fill='none' stroke='${INK}' stroke-width='1.6' stroke-linecap='round'/>${blush(0.55)}`),
  // 누를 수 있는 곳 위: 웃는 눈, 활짝 웃는 입, 살짝 기울임
  point: svg(
    `<g transform='rotate(-10 16 17)'><ellipse cx='16' cy='18' rx='12.5' ry='11.5' fill='#FFA23A' stroke='${INK}' stroke-width='2'/>${leaf}${shine}` +
    `<path d='M9.6 18.4q2.2-2.6 4.4 0M18 18.4q2.2-2.6 4.4 0' fill='none' stroke='${INK}' stroke-width='1.7' stroke-linecap='round'/>` +
    `<path d='M12.6 21.6q3.4 4.4 6.8 0z' fill='#C2410C' stroke='${INK}' stroke-width='1.4' stroke-linejoin='round'/>${blush(0.8)}</g>`),
  // 누르는 중: 살짝 눌린 모양, > < 눈
  active: svg(
    `<ellipse cx='16' cy='20' rx='13.5' ry='9.8' fill='#FF8A1F' stroke='${INK}' stroke-width='2'/>` +
    `<path d='M16 10.5c0-2.6 2.4-4.4 5.6-4-.5 2.6-2.8 4.4-5.6 4z' fill='#43A047' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/>` +
    `<path d='M9.6 17.4l3.2 1.6-3.2 1.6M22.4 17.4l-3.2 1.6 3.2 1.6' fill='none' stroke='${INK}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/>` +
    `<path d='M14 23.4q2 1.4 4 0' fill='none' stroke='${INK}' stroke-width='1.6' stroke-linecap='round'/>` +
    `<circle cx='8' cy='22.6' r='1.9' fill='#FF5A1F' opacity='.7'/><circle cx='24' cy='22.6' r='1.9' fill='#FF5A1F' opacity='.7'/>`),
}

const uri = (s) => `url("data:image/svg+xml,${encodeURIComponent(s).replace(/'/g, '%27')}")`
const css = `/* scripts/make-cursor.mjs 가 만든 파일입니다. 고치려면 스크립트의 SVG 를 고치고 다시 만드세요. */
:root {
  --cursor-default: ${uri(CURSORS.default)} 16 16, auto;
  --cursor-point: ${uri(CURSORS.point)} 16 16, pointer;
  --cursor-active: ${uri(CURSORS.active)} 16 16, pointer;
}
/* 터치 화면에는 커서가 없으므로 마우스 같은 포인터에서만 적용한다 */
@media (hover: hover) and (pointer: fine) {
  html { cursor: var(--cursor-default); }
  a, button, summary, select, label[for], [role="button"], [data-action], [data-ask], [data-cat], [data-tab] { cursor: var(--cursor-point); }
  a:active, button:active, summary:active, [data-action]:active, [data-ask]:active, [data-cat]:active, [data-tab]:active { cursor: var(--cursor-active); }
  input:not([type="checkbox"]):not([type="radio"]), textarea { cursor: text; } /* 글자를 쓰는 곳은 글자 커서를 그대로 */
  button:disabled, [aria-disabled="true"] { cursor: not-allowed; }
}
`
const out = path.resolve('public/cursor.css')
fs.writeFileSync(out, css)
console.log(`wrote ${path.relative(process.cwd(), out)} (${(css.length / 1024).toFixed(1)} KB)`)
