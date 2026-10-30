// 쇼핑몰 진입점: 각 모듈을 연결하고 화면을 시작한다.
import { need, S } from './state.js';
import { sb, api } from './api.js';
import { renderAll, renderShop, renderHero, renderStatic } from './render.js';
import { refreshUserData, refreshPosts } from './session.js';
import { bindActions } from './actions.js';
import { bindChat } from './chat.js';
import { bindForms } from './forms.js';
import { initScrollEffects } from './effects.js';
import { initScene } from './scene.js';

/* 공유 링크(#shop 등)로 처음 열었을 때 해당 섹션에 바로 도착시킨다.
   html 의 smooth 스크롤 때문에 첫 이동이 뒤이은 화면 구성 변화에 끊기므로, 상품·폰트가 준비된 뒤 즉시 이동한다. */
let userMoved = false;
['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((ev) => addEventListener(ev, () => { userMoved = true; }, { once: true, passive: true }));
function jumpToHash() {
  if (userMoved || location.hash.length < 2) return;
  let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
}
async function init() {
  renderAll();
  const prods = await need(() => api.products());
  S.loadError = !prods; S.products = prods || [];
  S.loadingProducts = false;
  renderShop(); renderHero();
  jumpToHash();
  await refreshUserData();
  await refreshPosts();
  jumpToHash();
  document.fonts?.ready.then(jumpToHash);
  if (sb) sb.auth.onAuthStateChange(async () => { await refreshUserData(); await refreshPosts(); });
}

renderStatic();
bindActions();
bindChat();
bindForms();
initScrollEffects();
try { initScene(); } catch (err) { console.warn('WebGL을 사용할 수 없어 3D 배경을 건너뜁니다.', err); }
init();
