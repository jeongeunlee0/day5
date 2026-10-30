// 액션 레지스트리: data-action 이름 -> 함수. 버튼이 몇 개든 클릭 리스너는 하나.
import { $, toast } from './util.js';
import { S, prod, cartLines, need } from './state.js';
import { api, stored } from './api.js';
import { renderCart, renderChrome, renderPosts, renderShop } from './render.js';
import { refreshUserData, refreshPosts } from './session.js';
import { closeAll, openEl, setAuthMode, requireUser } from './ui.js';
import { flyToCart } from './effects.js';
import { ADD_LINES } from './content.js';
import { Chat } from './chat.js';

let addN = 0;

async function changeQty(id, d) {
  const cur = S.cart.find((c) => c.product_id === id); if (!cur) return;
  const q = cur.quantity + d;
  await need(async () => {
    if (q < 1) await api.removeCart(id); else await api.setCart(id, q);
    S.cart = await api.cart();
  });
  renderCart(); renderChrome();
}

const ACTIONS = {
  close: () => closeAll(),
  'open-cart': () => openEl('#cartdrawer'),
  'open-orders': async () => { if (requireUser()) { await refreshUserData(); openEl('#ordersdrawer'); } },
  settings: () => { $('#sburl').value = stored.url || ''; $('#sbkey').value = stored.key || ''; openEl('#setmodal'); },
  auth: async () => {
    if (S.user) { await api.signOut(); await refreshUserData(); await refreshPosts(); toast('로그아웃했어요'); } else { setAuthMode('in'); openEl('#authmodal'); }
  },
  add: async (el, id) => {
    if (!requireUser()) return;
    const cur = S.cart.find((c) => c.product_id === id);
    await need(async () => { await api.setCart(id, (cur?.quantity || 0) + 1); S.cart = await api.cart(); });
    flyToCart(el, prod(id)); renderCart(); renderChrome(); toast(ADD_LINES[addN++ % ADD_LINES.length]);
    const c = $('#count'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
  },
  inc: (el, id) => changeQty(id, 1),
  dec: (el, id) => changeQty(id, -1),
  rm: async (el, id) => { await need(async () => { await api.removeCart(id); S.cart = await api.cart(); }); renderCart(); renderChrome(); },
  checkout: async (el) => {
    const items = cartLines(); if (!items.length) return;
    el.disabled = true;
    await need(async () => { await api.order(items); toast('주문 완료! 폭삭 속았수다 (수고하셨습니다)'); });
    await refreshUserData(); closeAll(); openEl('#ordersdrawer');
  },
  return: async (el, id) => {
    if (!confirm('이 주문을 반품 처리할까요?')) return;
    await need(async () => { await api.returnOrder(id); toast('반품 처리되었어요'); }); await refreshUserData();
  },
  like: async (el, id) => { if (requireUser()) { await need(() => api.toggleLike(id)); await refreshPosts(); } },
  'toggle-c': (el, id) => {
    if (S.openComments.has(id)) S.openComments.delete(id); else S.openComments.add(id);
    renderPosts();
  },
  'del-post': async (el, id) => { if (confirm('글을 삭제할까요?')) { await need(() => api.delPost(id)); await refreshPosts(); } },
  'del-c': async (el, id) => { await need(() => api.delComment(id, Number(el.dataset.cid))); await refreshPosts(); },
  chat: () => Chat.toggle(),
  'chat-close': () => Chat.setOpen(false),
};

function bindActions() {
  document.addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-tab]'); if (tab) return setAuthMode(tab.dataset.tab);
    const cat = e.target.closest('[data-cat]'); if (cat) { S.cat = cat.dataset.cat; return renderShop(); }
    const ask = e.target.closest('[data-ask]'); if (ask) return Chat.ask(ask.dataset.ask);
    const el = e.target.closest('[data-action]'); if (!el) return;
    const run = ACTIONS[el.dataset.action]; if (!run) return;
    await run(el, Number(el.dataset.id));
  });
}

export { ACTIONS, bindActions };
