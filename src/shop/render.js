// 상태(S) -> 화면. 상태가 바뀌면 해당 render 함수만 다시 부른다.
import { $, esc, won, icon, ago, tint, catOf, sortCats } from './util.js';
import { art } from './art.js';
import { S, cartLines } from './state.js';
import { sb } from './api.js';
import { WORDS, MARQUEE_WORDS } from './content.js';

function renderChrome() {
  $('#mode').textContent = sb ? 'Live' : 'Demo';
  $('#storage').textContent = sb ? 'Supabase' : '이 브라우저(체험)';
  $('#authbtn').innerHTML = `${icon('user')}<span class="lb">${S.user ? esc(S.user.name) + ' · 로그아웃' : '로그인'}</span>`;
  $('#gbwho').textContent = S.user ? `${S.user.name} 님으로 작성` : '로그인 후 작성할 수 있어요';
  $('#count').textContent = cartLines().reduce((a, c) => a + c.quantity, 0);
}

function renderShop() {
  const cats = ['전체', ...sortCats(new Set(S.products.map((p) => catOf(p))))];
  $('#chips').innerHTML = cats.map((c) => `<button class="chip ${c === S.cat ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('');
  let list = S.products.filter((p) => (S.cat === '전체' || catOf(p) === S.cat) && (p.name + (p.description || '')).includes(S.q));
  if (S.sort === 'asc') list = [...list].sort((a, b) => a.price - b.price);
  if (S.sort === 'desc') list = [...list].sort((a, b) => b.price - a.price);
  const g = $('#grid');
  if (S.loadingProducts) { g.innerHTML = '<div class="skeleton"></div>'.repeat(6); return; }
  if (S.loadError) { g.innerHTML = '<div class="empty">상품을 불러오지 못했어요.<br>Supabase 연결 설정(URL·키)과 네트워크를 확인해주세요.</div>'; return; }
  if (!S.products.length) { g.innerHTML = '<div class="empty">상품이 없어요. Supabase SQL Editor에서 supabase/schema.sql 다음에 supabase/seed_products.sql까지 실행했는지 확인해주세요.</div>'; return; }
  if (!list.length) { g.innerHTML = '<div class="empty">찾는 상품이 없어요. 바람이 가져갔나 봐요.</div>'; return; }
  g.innerHTML = list.map((p) => `
    <article class="card">
      <div class="thumb" style="background:${tint(p.id)}"><span class="no">No.${String(p.id).padStart(2, '0')}</span><span class="tag">${catOf(p)}</span>${art(p)}</div>
      <div class="cbody"><h3>${esc(p.name)}</h3><p class="desc">${esc(p.description)}</p>
        <div class="cfoot"><span class="price">${Number(p.price).toLocaleString('ko-KR')}<small>원</small></span>
          <button class="add" data-action="add" data-id="${p.id}" aria-label="${esc(p.name)} 담기">${icon('plus')}</button></div></div>
    </article>`).join('');
}

function renderCart() {
  const lines = cartLines();
  $('#cartbody').innerHTML = lines.length ? lines.map(({ p, quantity }) => `
    <div class="line"><div class="em" style="background:${tint(p.id)}">${art(p)}</div>
      <div><b>${esc(p.name)}</b><br><small>${won(p.price)}</small>
        <div class="qty"><button data-action="dec" data-id="${p.id}" aria-label="감소">${icon('minus')}</button><b>${quantity}</b><button data-action="inc" data-id="${p.id}" aria-label="증가">${icon('plus')}</button></div></div>
      <div style="text-align:right"><b>${won(p.price * quantity)}</b><br><button class="rm" data-action="rm" data-id="${p.id}">삭제</button></div></div>`).join('')
    : '<div class="empty">장바구니가 텅 비었어요.<br>귤 한 알 없는 장바구니는 쓸쓸합니다.</div>';
  $('#carttotal').textContent = won(lines.reduce((a, l) => a + l.p.price * l.quantity, 0));
  $('#checkout').disabled = !lines.length;
}

function renderOrders() {
  $('#ordersbody').innerHTML = S.orders.length ? S.orders.map((o) => `
    <div class="line" style="grid-template-columns:1fr auto"><div><b>${esc(o.product_name)}</b> × ${o.quantity}<br>
      <small>${won(o.total_price)} · ${ago(o.created_at)}</small></div>
      <div style="text-align:right"><span class="status ${o.status}">${o.status === 'ordered' ? '주문완료' : '반품됨'}</span>
      ${o.status === 'ordered' ? `<br><button class="rm" data-action="return" data-id="${o.id}">반품 신청</button>` : ''}</div></div>`).join('')
    : '<div class="empty">아직 주문이 없어요. 첫 주문의 주인공이 되어보세요.</div>';
}

function renderPosts() {
  const uid = S.user?.id;
  $('#posts').innerHTML = S.posts.length ? S.posts.map((p) => {
    const open = S.openComments.has(p.id), liked = uid && p.likes.includes(uid);
    return `<article class="post"><div class="meta"><span class="who"><span class="avatar">${esc(p.author[0] || '?')}</span>${esc(p.author)}</span>
        <span>${ago(p.created_at)}</span></div>
      <p>${esc(p.content)}</p>
      <div class="acts"><button class="pill ${liked ? 'liked' : ''}" data-action="like" data-id="${p.id}">${icon('heart')} ${p.likes.length}</button>
        <button class="pill" data-action="toggle-c" data-id="${p.id}">${icon('chat')} ${p.comments.length}</button>
        ${uid && p.user_id === uid ? `<button class="pill" data-action="del-post" data-id="${p.id}" aria-label="글 삭제">${icon('trash')}</button>` : ''}</div>
      ${open ? `<div class="comments">${p.comments.map((c) => `<div class="comment"><span><b>${esc(c.author)}</b>${esc(c.content)}</span>
        ${uid && c.user_id === uid ? `<button class="rm" data-action="del-c" data-id="${p.id}" data-cid="${c.id}">삭제</button>` : ''}</div>`).join('')}
        <form class="cform" data-id="${p.id}"><input class="field" placeholder="댓글 달기" maxlength="200" required /><button class="pill">등록</button></form></div>` : ''}</article>`;
  }).join('') : '<div class="empty">첫 방명록의 주인공이 되어주세요.</div>';
}

/* hero marketing blocks: every number comes from the loaded product data */
function renderHero() {
  const P = S.products; if (!P.length) return;
  const cats = sortCats(new Set(P.map((p) => catOf(p))));
  const min = Math.min(...P.map((p) => p.price));
  $('#quick').innerHTML = `<span>바로가기</span>` + cats.map((c) => `<a class="qchip" href="#shop" data-cat="${c}">${c}</a>`).join('');
  $('#stats').innerHTML = `<div><b>${P.length}<small>종</small></b><span>제주 특산품</span></div>
    <div><b>${min.toLocaleString('ko-KR')}<small>원~</small></b><span>시작 가격</span></div>
    <div><b>${cats.length}<small>개</small></b><span>카테고리</span></div>`;
  const day = Math.floor(Date.now() / 864e5), p = P[day % P.length];
  const sp = $('#spot'); sp.hidden = false;
  sp.innerHTML = `<span class="spot-tag">오늘의 PICK</span>
    <div class="spot-art" style="background:${tint(p.id)}">${art(p)}</div>
    <div><b class="n">${esc(p.name)}</b><small>${esc(p.description)}</small>
      <div class="row"><b>${won(p.price)}</b><button class="add" data-action="add" data-id="${p.id}" aria-label="${esc(p.name)} 담기">${icon('plus')}</button></div></div>`;
}

const renderAll = () => { renderChrome(); renderShop(); renderCart(); renderOrders(); renderPosts(); };

// 데이터와 무관한 고정 영역(제주어 카드, 마퀴)
function renderStatic() {
  $('#words').innerHTML = WORDS.map((x) => `<article class="word"><div class="w">${x.w}</div><span class="m">${x.m}</span><p class="j">${x.j}</p></article>`).join('');
  const one = MARQUEE_WORDS.map((w) => `<span>${w}${icon('star', 'fill')}</span>`).join('');
  $('#track').innerHTML = one + one + one + one;
}

export { renderChrome, renderShop, renderCart, renderOrders, renderPosts, renderHero, renderAll, renderStatic };
