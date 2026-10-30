// 문의 응대 채팅: 찾기(질문 의도 읽기) -> 판단(실제 데이터 조회) -> 실행(답변·버튼).
// 상품·가격·장바구니는 불러온 데이터로만 답하고, 사이트에 등록되지 않은 정책은 추측하지 않고 모른다고 말한다.
import { $, esc, won, catOf, sleep } from './util.js';
import { S, cartLines } from './state.js';
import { sb } from './api.js';
import { WORDS } from './content.js';

const SUGGEST = ['주문은 어떻게 해요?', '반품하고 싶어요', '가장 저렴한 상품은?', '과일 추천해줘', '내 장바구니 보여줘', '로그인이 안 돼요'];
const productTokens = (p) => p.name.split(/\s+/).filter((t) => t.length >= 2 && !/^\d|제주|우도|세트|마리|개입/.test(t));
const matchProducts = (q) => S.products.filter((p) => productTokens(p).some((t) => q.includes(t)));
const catIn = (q) => (/과일/.test(q) ? '과일' : /채소|야채|곡물/.test(q) ? '채소·곡물' : /수산|생선|해산물/.test(q) ? '수산' : /육류|고기|돼지/.test(q) ? '육류' : /간식|가공|디저트|막걸리/.test(q) ? '간식·가공' : null);
const dayPick = (pool) => pool[Math.floor(Date.now() / 864e5) % pool.length];
const line = (p) => `${p.name} — ${won(p.price)}`;
const addBtn = (p) => ({ label: `${p.name} 담기`, action: 'add', id: p.id });
const NO_DATA = { text: '상품 정보를 아직 불러오지 못했어요. 잠시 후 다시 물어봐 주세요.' };

// 한 줄이 한 가지 의도: test(질문) 이 참이면 reply(질문) 이 { text, actions } 를 돌려준다
const INTENTS = [
  { name: 'product', test: (q) => matchProducts(q).length > 0, reply(q) {
    const ps = matchProducts(q).slice(0, 3);
    return { text: ps.map((p) => `${line(p)}\n${p.description}`).join('\n\n'), actions: ps.map(addBtn) };
  } },
  { name: 'cart', test: (q) => /장바구니|담은|카트/.test(q), reply() {
    if (!S.user) return { text: '장바구니는 로그인 후에 확인할 수 있어요.', actions: [{ label: '로그인·가입 열기', action: 'auth' }] };
    const ls = cartLines();
    if (!ls.length) return { text: '장바구니가 비어 있어요. 마음에 드는 상품을 담아 보세요.', actions: [{ label: '상품 보러 가기', href: '#shop' }] };
    const sum = ls.reduce((a, l) => a + l.p.price * l.quantity, 0);
    return { text: ls.map((l) => `${l.p.name} × ${l.quantity} — ${won(l.p.price * l.quantity)}`).join('\n') + `\n\n합계 ${won(sum)}`, actions: [{ label: '장바구니 열기', action: 'open-cart' }] };
  } },
  { name: 'return', test: (q) => /반품|환불|취소|교환/.test(q), reply: () => ({
    text: '주문내역에서 해당 주문의 "반품 신청"을 누르면 상태가 "반품됨"으로 바뀌어요.\n다만 환불 금액 처리 같은 정산은 이 사이트에서 다루지 않아요.',
    actions: [{ label: '주문내역 열기', action: 'open-orders' }] }) },
  { name: 'order', test: (q) => /주문|결제|구매|사고|사려|어떻게 사/.test(q), reply: () => ({
    text: '① 상품 카드의 + 버튼으로 장바구니에 담아요.\n② 장바구니에서 "주문하기"를 눌러요.\n③ 주문내역에서 확인할 수 있어요.\n\n참고로 이 사이트는 아직 실제 결제가 연결되어 있지 않고, 주문 기록만 남겨요.',
    actions: [{ label: '장바구니 열기', action: 'open-cart' }, { label: '주문내역 열기', action: 'open-orders' }] }) },
  { name: 'delivery', test: (q) => /배송|택배|도착|언제 와|운송|송장/.test(q), reply: () => ({
    text: '배송 일정·방법·비용에 대한 안내는 이 사이트에 등록되어 있지 않아요. 확인되지 않은 내용을 추측해서 말씀드리지 않을게요.' }) },
  { name: 'login', test: (q) => /로그인|가입|비밀번호|계정|회원|로그아웃/.test(q), reply: () => ({
    text: '화면 위쪽 사람 아이콘에서 이메일로 가입하거나 로그인할 수 있어요. 가입에는 닉네임(2자 이상)이 필요해요.\n비밀번호 찾기·재설정 기능은 아직 없어요.' + (sb ? '' : '\n지금은 체험 모드라 계정이 이 브라우저에만 저장돼요.'),
    actions: [{ label: S.user ? '로그아웃' : '로그인·가입 열기', action: 'auth' }] }) },
  { name: 'price', test: (q) => /저렴|싼|가격|얼마|비싼|예산|이하/.test(q), reply(q) {
    if (!S.products.length) return NO_DATA;
    const m = q.match(/(\d+(?:\.\d+)?)\s*만\s*원?/) || null;
    const budget = m ? Math.round(Number(m[1]) * 10000) : (q.match(/(\d{4,6})\s*원/) ? Number(q.match(/(\d{4,6})\s*원/)[1]) : 0);
    const c = catIn(q), pool = c ? S.products.filter((p) => catOf(p) === c) : S.products; // 카테고리를 함께 물으면 그 안에서만 찾는다
    if (!pool.length) return NO_DATA;
    const asc = [...pool].sort((a, b) => a.price - b.price), where = c ? `${c} 중 ` : '';
    if (budget) {
      const ok = asc.filter((p) => p.price <= budget).slice(0, 5);
      return ok.length ? { text: `${where}${won(budget)} 이하 상품이에요.\n` + ok.map(line).join('\n'), actions: ok.slice(0, 3).map(addBtn) }
        : { text: `${where}${won(budget)} 이하 상품은 없어요. 가장 저렴한 건 ${line(asc[0])}이에요.`, actions: [addBtn(asc[0])] };
    }
    const top = asc.slice(0, 3), max = asc[asc.length - 1];
    return { text: `${where}가장 저렴한 상품이에요.\n` + top.map(line).join('\n') + `\n\n${where}가장 높은 가격은 ${line(max)}이에요.`, actions: top.slice(0, 2).map(addBtn) };
  } },
  { name: 'recommend', test: (q) => /추천|뭐 살|선물|인기|뭐가 좋|고민/.test(q), reply(q) {
    if (!S.products.length) return NO_DATA;
    const c = catIn(q), pool = c ? S.products.filter((p) => catOf(p) === c) : S.products;
    if (!pool.length) return { text: '해당하는 상품이 없어요.' };
    const pick = dayPick(pool), cheap = [...pool].sort((a, b) => a.price - b.price)[0];
    const acts = [addBtn(pick)]; if (cheap.id !== pick.id) acts.push(addBtn(cheap));
    return { text: `${c ? c + ' 중에서 ' : ''}오늘의 PICK은 ${line(pick)}이에요.\n${pick.description}` + (cheap.id !== pick.id ? `\n\n부담 없이 고르신다면 ${line(cheap)}도 있어요.` : '') + '\n\n(별도 판매 순위 자료가 없어서 오늘의 PICK은 날짜 기준으로 돌아가며 골라요.)', actions: acts };
  } },
  { name: 'category', test: (q) => !!catIn(q), reply(q) {
    const c = catIn(q), ps = S.products.filter((p) => catOf(p) === c);
    return ps.length ? { text: `${c} 상품이에요.\n` + ps.map(line).join('\n'), actions: ps.slice(0, 3).map(addBtn) } : NO_DATA;
  } },
  { name: 'jejueo', test: (q) => /제주어|사투리|방언/.test(q), reply() {
    const w = WORDS[Math.floor(Date.now() / 864e5) % WORDS.length];
    return { text: `오늘의 제주어는 "${w.w}" — ${w.m}이에요.\n${w.j}`, actions: [{ label: '제주어 더 보기', href: '#jejueo' }] };
  } },
  { name: 'human', test: (q) => /상담원|직원|사람|전화|연락|담당자/.test(q), reply: () => ({
    text: '이 채팅은 자동 안내라서 상담원 연결이나 전화 문의는 제공하지 않아요.\n상품·가격·장바구니·주문·반품·로그인에 대해서는 바로 답해 드릴게요.' }) },
  { name: 'hello', test: (q) => /^(안녕|하이|hi|hello|혼저)/i.test(q.trim()), reply: () => ({ text: '혼저 옵서예! 상품이나 주문에 대해 궁금한 걸 물어보세요.' }) },
];
const FALLBACK = { text: '그건 제가 정확히 답할 수 있는 내용이 아니에요. 상품·가격·장바구니·주문·반품·로그인에 대해 물어봐 주세요.' };

const Chat = {
  open: false, started: false,
  setOpen(v) {
    this.open = v;
    $('#chat').classList.toggle('show', v);
    $('#chatbtn').setAttribute('aria-expanded', String(v));
    $('#chatbtn').classList.toggle('on', v);
    if (v) { $('#chatdot').hidden = true; if (!this.started) this.start(); setTimeout(() => $('#chatq').focus(), 60); }
  },
  toggle() { this.setOpen(!this.open); },
  say(cls, html) {
    const d = document.createElement('div'); d.className = 'cmsg ' + cls; d.innerHTML = html;
    $('#clog').appendChild(d); $('#clog').scrollTop = $('#clog').scrollHeight; return d;
  },
  html(r) {
    const text = esc(r.text).replace(/\n/g, '<br>');
    const acts = (r.actions || []).map((a) => a.href
      ? `<a class="cact" href="${a.href}" data-action="chat-close">${esc(a.label)}</a>`
      : `<button type="button" class="cact" data-action="${a.action}"${a.id != null ? ` data-id="${a.id}"` : ''}>${esc(a.label)}</button>`).join('');
    return text + (acts ? `<div class="cacts">${acts}</div>` : '');
  },
  chips() { return `<div class="cchips">${SUGGEST.map((s) => `<button type="button" data-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>`; },
  start() {
    this.started = true;
    this.say('bot', esc('혼저 옵서예! (어서 오세요) 상품·주문·반품·로그인에 대해 궁금한 걸 물어보세요.') + this.chips());
  },
  async ask(text) {
    text = String(text).trim(); if (!text) return;
    if (!this.open) this.setOpen(true);
    this.say('me', esc(text)); $('#chatq').value = '';
    const wait = this.say('bot', '<span class="dots"><span></span><span></span><span></span></span>');
    await sleep(500);
    const hit = INTENTS.find((i) => i.test(text));
    wait.innerHTML = this.html(hit ? hit.reply(text) : FALLBACK) + (hit ? '' : this.chips());
    $('#clog').scrollTop = $('#clog').scrollHeight;
  },
};

function bindChat() {
  $('#chatform').addEventListener('submit', (e) => { e.preventDefault(); Chat.ask($('#chatq').value); });
}

export { Chat, bindChat };
