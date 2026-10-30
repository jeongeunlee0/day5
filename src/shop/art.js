// 상품 일러스트(SVG). DB 의 emoji 값은 어떤 그림을 쓸지만 고른다.
const INK = '#12201F';
function art(p) {
  const s = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const n = p.name || ''; let g;
  switch (p.emoji) {
    case '🍊': {
      if (n.includes('3종')) {
        g = `<circle cx="38" cy="76" r="22" fill="#FF9A1F" ${s}/><circle cx="82" cy="76" r="22" fill="#FF6B35" ${s}/><circle cx="60" cy="48" r="22" fill="#E8432B" ${s}/><path d="M60 28c2-9 10-12 18-9-2 9-10 12-18 9z" fill="#43A047" ${s}/>`; break;
      }
      const COL = { '천혜향': '#FF6B35', '레드향': '#E8432B', '황금향': '#FFB300' };
      const c = COL[Object.keys(COL).find((k) => n.includes(k))] || '#FF9A1F';
      g = `<circle cx="60" cy="68" r="34" fill="${c}" ${s}/>${n.includes('한라봉') ? `<path d="M50 36c0-8 20-8 20 0" fill="${c}" ${s}/>` : ''}
        <path d="M60 34c2-12 14-16 26-12-2 12-14 17-26 12z" fill="#43A047" ${s}/><path d="M40 64a22 22 0 0 1 14-16" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>`; break;
    }
    case '🐖':
      g = `<rect x="18" y="38" width="84" height="48" rx="18" fill="#F4A6A0" ${s}/><path d="M30 52c10-8 18 8 28 0s18 8 30 0M30 68c10-8 18 8 28 0s18 8 30 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`; break;
    case '🐟': {
      const silver = n.includes('갈치');
      const pinkBody = (fill, extra = '') => `<path d="M16 60c14-24 52-26 70-6l20-14v40L86 66C68 86 30 84 16 60z" fill="${fill}" ${s}/><circle cx="32" cy="56" r="3.5" fill="${INK}"/>${extra}`;
      if (n.includes('고등어')) { g = pinkBody('#6FA8B5', `<path d="M44 42l4 10M54 40l4 12M64 40l4 12M74 44l3 10" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".55"/>`); break; }
      if (n.includes('자리돔')) { g = `<g transform="translate(12 16) scale(.8)">${pinkBody('#9C6B4E', `<path d="M52 44c6 10 6 24 0 34" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>`)}</g>`; break; }
      g = silver
        ? `<path d="M10 62c20-18 56-20 80-4l16-12v32l-16-12c-24 16-60 14-80-4z" fill="#D5DEE4" ${s}/><circle cx="24" cy="60" r="3" fill="${INK}"/><path d="M40 52v20M54 50v22M68 52v18" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>`
        : `<path d="M16 60c14-24 52-26 70-6l20-14v40L86 66C68 86 30 84 16 60z" fill="#F58C8C" ${s}/><circle cx="32" cy="56" r="3.5" fill="${INK}"/><path d="M52 44c6 10 6 24 0 34M66 46c5 8 5 20 0 30" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>`;
      break;
    }
    case '🍫':
      g = `<rect x="24" y="26" width="72" height="68" rx="10" fill="#7B4A2D" transform="rotate(-8 60 60)" ${s}/><g stroke="#A8744F" stroke-width="3" transform="rotate(-8 60 60)"><path d="M60 26v68M24 60h72"/></g><path d="M22 70l46 24H26a6 6 0 0 1-6-6z" fill="#FF8A1F" ${s}/>`; break;
    case '🍡':
      g = `<circle cx="38" cy="76" r="21" fill="#F7ECD6" ${s}/><circle cx="82" cy="76" r="21" fill="#F7ECD6" ${s}/><circle cx="60" cy="48" r="21" fill="#F7ECD6" ${s}/>
        <g fill="${INK}"><circle cx="32" cy="72" r="1.8"/><circle cx="44" cy="82" r="1.8"/><circle cx="76" cy="72" r="1.8"/><circle cx="88" cy="82" r="1.8"/><circle cx="55" cy="44" r="1.8"/><circle cx="66" cy="54" r="1.8"/></g>`; break;
    case '🍶':
      g = `<rect x="44" y="40" width="32" height="56" rx="8" fill="#F7F1E1" ${s}/><rect x="52" y="20" width="16" height="24" fill="#F7F1E1" ${s}/><rect x="49" y="12" width="22" height="10" rx="3" fill="${INK}"/><circle cx="60" cy="68" r="11" fill="#FF5A1F" ${s}/>`; break;
    case '🍵':
      g = `<path d="M18 54h84a42 36 0 0 1-84 0z" fill="#8DBF6A" ${s}/><ellipse cx="60" cy="54" rx="42" ry="9" fill="#C9E4A8" ${s}/><path d="M46 38c-6-6 6-10 0-18M62 38c-6-6 6-10 0-18M78 38c-6-6 6-10 0-18" fill="none" ${s}/>`; break;
    case '🥣':
      g = `<path d="M16 58h88a44 36 0 0 1-88 0z" fill="#E8663C" ${s}/><ellipse cx="60" cy="58" rx="44" ry="10" fill="#7A4B2A" ${s}/><g fill="#2E6B3A"><ellipse cx="46" cy="58" rx="7" ry="3"/><ellipse cx="68" cy="60" rx="8" ry="3"/><ellipse cx="82" cy="56" rx="5" ry="2.5"/></g><path d="M78 22l18 30M88 20l16 30" ${s}/>`; break;
    case '🥕':
      g = `<path d="M26 40c24-10 58 12 68 40 4 12-8 18-18 10C52 78 30 62 26 40z" fill="#FF8A1F" ${s}/><path d="M44 52l10-4M58 62l10-4M70 74l9-3" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" opacity=".5"/><path d="M26 40c-8-10-6-20 2-24 2 8 6 14 12 18M26 40c-12 0-18-8-18-16 8-2 14 4 18 16" fill="#43A047" ${s}/>`; break;
    case '🌾':
      g = `<path d="M32 36h56l6 54H26z" fill="#F7ECD6" ${s}/><path d="M32 36l6-14h44l6 14" fill="#E9D7B0" ${s}/><circle cx="60" cy="64" r="15" fill="#8A6B4A" ${s}/><path d="M60 76V52M52 60l8-6 8 6M52 68l8-6 8 6" fill="none" stroke="#F7ECD6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`; break;
    case '🦑':
      g = `<path d="M60 14c18 14 24 36 16 56H44c-8-20-2-42 16-56z" fill="#F4A6A0" ${s}/><path d="M44 70c-2 14-8 20-14 24M53 70c0 14-2 22-4 28M67 70c0 14 2 22 4 28M76 70c2 14 8 20 14 24" fill="none" ${s}/><circle cx="53" cy="48" r="3" fill="${INK}"/><circle cx="67" cy="48" r="3" fill="${INK}"/><path d="M60 22v10" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`; break;
    case '🐚':
      g = `<ellipse cx="60" cy="64" rx="38" ry="32" fill="#EBC99A" ${s}/><path d="M60 64a4 4 0 0 1 8 0a10 10 0 0 1-20 0a18 18 0 0 1 36 0" fill="none" ${s}/><path d="M32 44l-8-8M44 34l-4-10M60 31V20" fill="none" ${s}/>`; break;
    case '🍞':
      g = `<path d="M22 66c0-20 16-32 38-32s38 12 38 32v22H22z" fill="#D9A066" ${s}/><path d="M42 46l8 14M58 42l8 16M76 46l8 12" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".6"/>`; break;
    case '🫓':
      g = `<rect x="22" y="40" width="76" height="16" rx="8" fill="#F2E3B3" ${s}/><rect x="22" y="58" width="76" height="16" rx="8" fill="#F2E3B3" ${s}/><rect x="22" y="76" width="76" height="16" rx="8" fill="#F2E3B3" ${s}/><g fill="${INK}" opacity=".7"><circle cx="34" cy="48" r="1.8"/><circle cx="62" cy="49" r="1.8"/><circle cx="86" cy="48" r="1.8"/><circle cx="44" cy="66" r="1.8"/><circle cx="76" cy="66" r="1.8"/><circle cx="34" cy="84" r="1.8"/><circle cx="64" cy="85" r="1.8"/></g>`; break;
    case '🧃':
      g = `<path d="M38 34h44l4 60H34z" fill="${n.includes('한라봉') ? '#FFB300' : '#FF9A1F'}" ${s}/><path d="M38 34l6-12h32l6 12" fill="#FFF3DE" ${s}/><path d="M68 22V12h14" fill="none" ${s}/><circle cx="60" cy="64" r="13" fill="#FFF3DE" ${s}/><path d="M60 54v20M50 64h20" stroke="#FF9A1F" stroke-width="2.5"/>`; break;
    case '🍯':
      g = `<path d="M32 46h56v42a10 10 0 0 1-10 10H42a10 10 0 0 1-10-10z" fill="#E8A23A" ${s}/><rect x="30" y="30" width="60" height="16" rx="4" fill="#FF5A1F" ${s}/><circle cx="60" cy="72" r="14" fill="#FFF3DE" ${s}/><path d="M60 62v20M50 72h20" stroke="#FF8A1F" stroke-width="2.5"/>`; break;
    default:
      g = `<circle cx="60" cy="60" r="34" fill="#fff" ${s}/>`;
  }
  return `<svg class="art" viewBox="0 0 120 120" aria-hidden="true">${g}</svg>`;
}

export { art };
