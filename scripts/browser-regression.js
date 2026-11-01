/*
 * 쇼핑몰 브라우저 회귀 검사 (50개 항목)
 *
 * 사용법
 *   1) 체험 모드로 개발 서버를 켜고 http://localhost:5173/ 을 연다
 *      PowerShell: $env:VITE_SUPABASE_URL='off'; npm run dev   (실제 Supabase 에 시험 계정이 생기지 않게)
 *   2) 개발자 도구(F12) 콘솔에 이 파일 전체를 붙여 넣고 Enter
 *   3) 끝나면 { summary: "50 passed, 0 failed", fail: [] } 가 출력된다
 *
 * 주의: 이 브라우저의 localStorage 를 지우고 테스트 계정(qa1@example.com)을 만든 뒤 다시 지운다.
 *       자동 테스트 러너가 아니라 눈으로 확인하는 점검표를 코드로 옮긴 것이다.
 */
(async () => {
  const w = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const errs = [];
  addEventListener('error', (e) => errs.push('err:' + e.message));
  addEventListener('unhandledrejection', (e) => errs.push('rej:' + e.reason));
  const R = { pass: [], fail: [] };
  const ok = (name, cond, info) => (cond ? R.pass : R.fail).push(cond ? name : `${name} → ${JSON.stringify(info)}`);

  // 화면이 이미 로그인된 상태일 수 있으므로, 저장소를 지우기 전에 화면에서 먼저 로그아웃해 깨끗한 상태에서 시작한다
  if (/로그아웃/.test($('#authbtn').textContent)) { $('#authbtn').click(); await w(900); }
  localStorage.clear();
  location.hash = '';
  document.documentElement.style.scrollBehavior = 'auto';
  const toastClear = () => { $('#toasts').innerHTML = ''; };
  const lastToast = () => $$('.toast').at(-1)?.textContent;
  const chipClick = async (label) => { $$('#chips .chip').find((c) => c.textContent === label).click(); await w(90); };
  const num = (s) => Number(s.replace(/\D/g, ''));

  // 화면 시작
  ok('3D canvas exists', !!$('#bg') && $('#bg').width > 0, $('#bg')?.width);
  ok('title became 3D (gl)', $('#title3d').classList.contains('gl'), $('#title3d').className);
  ok('words + marquee rendered', $$('.word').length === 6 && $('#track').children.length > 20, [$$('.word').length, $('#track').children.length]);

  // 상품 목록 (원본: public/data/products.json)
  const data = (await (await fetch('/data/products.json')).json()).products;
  const perCat = {}; data.forEach((p) => { perCat[p.category] = (perCat[p.category] || 0) + 1; });
  ok('all products rendered', $$('.card').length === data.length, [$$('.card').length, data.length]);
  ok('chips follow the fixed category order', JSON.stringify($$('#chips .chip').map((c) => c.textContent)) === JSON.stringify(['전체', '과일', '채소·곡물', '육류', '수산', '간식·가공']), $$('#chips .chip').map((c) => c.textContent));
  ok('every card has price + art', $$('.card').every((c) => c.querySelector('.price') && c.querySelector('.art')), 0);
  for (const [k, v] of Object.entries(perCat)) { await chipClick(k); ok('filter ' + k, $$('.card').length === v, $$('.card').length); }
  await chipClick('전체');
  const q = $('#q');
  q.value = '만감류'; q.dispatchEvent(new Event('input')); await w(90);
  ok('search 만감류', $$('.card').length >= 2, $$('.card h3').map((h) => h.textContent));
  q.value = 'zzzz없음'; q.dispatchEvent(new Event('input')); await w(90);
  ok('empty search message', /바람이 가져갔/.test($('#grid').innerText), $('#grid').innerText);
  q.value = ''; q.dispatchEvent(new Event('input')); await w(90);
  const s = $('#sort');
  s.value = 'asc'; s.dispatchEvent(new Event('change')); await w(90);
  const asc = $$('.card .price').map((p) => num(p.textContent));
  ok('sort ascending', asc.every((v, i) => i === 0 || asc[i - 1] <= v), asc.slice(0, 4));
  s.value = 'desc'; s.dispatchEvent(new Event('change')); await w(90);
  const desc = $$('.card .price').map((p) => num(p.textContent));
  ok('sort descending', desc.every((v, i) => i === 0 || desc[i - 1] >= v), desc.slice(0, 4));
  s.value = 'id'; s.dispatchEvent(new Event('change')); await w(90);
  ok('hero stats come from the data', new RegExp(`${data.length}\\s*종`).test($('#stats').innerText), $('#stats').innerText);
  ok("today's PICK card", !$('#spot').hidden && !!$('#spot [data-action=add]'), 0);
  ok('hero quick chips', $$('#quick .qchip').length === Object.keys(perCat).length, $$('#quick .qchip').length);

  // 로그인 필요 + 가입 + 오류 안내
  toastClear(); $('#grid [data-action=add][data-id="1"]').click(); await w(300);
  ok('login gate on add', $('#authmodal').classList.contains('show') && lastToast() === '로그인이 필요해요', lastToast());
  const submit = async (mode, email, pw, nick) => {
    toastClear(); $(`.tabs [data-tab=${mode}]`).click();
    $('#email').value = email; $('#pw').value = pw; $('#nick').value = nick || '';
    $('#authform').requestSubmit(); await w(800);
    return { msg: lastToast(), err: $$('.toast').at(-1)?.classList.contains('err') };
  };
  let r = await submit('up', 'qa1@example.com', 'secret1', 'a');
  ok('nickname too short rejected', r.err && /2자/.test(r.msg), r);
  r = await submit('up', 'qa1@example.com', 'secret1', '품질검수');
  ok('signup works', !r.err && /환영/.test(r.msg) && /로그아웃/.test($('#authbtn').textContent), r);

  // 장바구니 (한라봉 #1 ×2, 구좌 당근 #14, 고기국수 #28 — 금액은 JSON 에서 읽는다)
  const price = (id) => data.find((p) => p.id === id).price;
  const add = async (id) => { $(`#grid [data-action=add][data-id="${id}"]`).click(); await w(350); };
  await add(1); await add(1); await add(14); await add(28);
  ok('cart count is 4', $('#count').textContent === '4', $('#count').textContent);
  ok('cart total is correct', num($('#carttotal').textContent) === price(1) * 2 + price(14) + price(28), [$('#carttotal').textContent]);
  $('#cartbody [data-action=inc][data-id="14"]').click(); await w(300);
  $('#cartbody [data-action=dec][data-id="14"]').click(); await w(300);
  $('#cartbody [data-action=dec][data-id="14"]').click(); await w(300);
  ok('decrement to zero removes the line', !$('#cartbody [data-action=inc][data-id="14"]'), 0);
  $('#cartbody [data-action=rm][data-id="28"]').click(); await w(300);
  ok('remove deletes the line', !$('#cartbody [data-action=inc][data-id="28"]'), 0);

  // 방명록
  $('#gbtext').value = '<b>검수</b> 글 & "따옴표"'; $('#gbform').requestSubmit(); await w(500);
  const p0 = $('.post p');
  ok('guestbook is XSS-safe and saved', p0.textContent.includes('<b>검수</b>') && !p0.querySelector('b'), p0.innerHTML);
  $('.post [data-action=like]').click(); await w(300);
  ok('like is counted', /1$/.test($('.post [data-action=like]').textContent.trim()), $('.post [data-action=like]').textContent);
  $('.post [data-action=toggle-c]').click(); await w(200);
  const ci = $('.post .cform input'); ci.value = '댓글 검수'; ci.closest('form').requestSubmit(); await w(400);
  ok('comment added', $$('.post .comment').length === 1, 0);
  $('.post [data-action=del-c]').click(); await w(300);
  ok('comment deleted', $$('.post .comment').length === 0, 0);
  window.confirm = () => true;
  const before = $$('.post').length; $('.post [data-action=del-post]').click(); await w(300);
  ok('own post deleted', $$('.post').length === before - 1, 0);

  // 주문 / 반품
  $('[data-action=open-cart]').click(); await w(400); $('#checkout').click(); await w(400);
  ok('checkout opens the demo payment step with a clear notice', $('#paymodal').classList.contains('show') && /체험 결제/.test($('#paymodal').innerText) && /실제로 돈이 청구되지 않/.test($('#paymodal').innerText), $('#paymodal').innerText.slice(0, 80));
  ok('payment summary total equals the cart total', num($('#paytotal').textContent) === num($('#carttotal').textContent) && num($('#paytotal').textContent) > 0, [$('#paytotal').textContent, $('#carttotal').textContent]);
  const cartBefore = $('#count').textContent, ordersBefore = $$('#ordersbody .line').length;
  $('#paymethods [data-method=fail]').click(); await w(100);
  toastClear(); $('#payconfirm').click(); await w(1300);
  ok('failed payment creates no order and keeps the cart', $$('#ordersbody .line').length === ordersBefore && $('#count').textContent === cartBefore && !!$('.toast.err'), [$$('#ordersbody .line').length, ordersBefore, $('#count').textContent, cartBefore]);
  ok('failed payment leaves the confirm button usable', !$('#payconfirm').disabled && /체험 결제하고 주문하기/.test($('#payconfirm').textContent), $('#payconfirm').textContent);
  $('#paymethods [data-method=card]').click(); await w(100);
  $('#payconfirm').click(); await w(1500);
  ok('order created and cart emptied after a successful payment', $$('#ordersbody .line').length >= 1 && $('#count').textContent === '0', [$$('#ordersbody .line').length, $('#count').textContent]);
  $('#ordersbody [data-action=return]').click(); await w(400);
  ok('return works', $$('#ordersbody .status').some((x) => x.textContent === '반품됨'), $$('#ordersbody .status').map((x) => x.textContent));
  $('#ordersdrawer [data-action=close]').click(); await w(300);

  // 로그아웃 / 로그인
  $('#authbtn').click(); await w(700);
  ok('logout clears the view', $('#count').textContent === '0' && !/로그아웃/.test($('#authbtn').textContent), $('#authbtn').textContent);
  r = await submit('in', 'qa1@example.com', 'wrongpw');
  ok('wrong password message', r.err && /맞지 않아요/.test(r.msg), r);
  r = await submit('up', 'qa1@example.com', 'secret1', '중복');
  ok('duplicate email message', r.err && /이미 가입/.test(r.msg), r);
  r = await submit('in', 'qa1@example.com', 'secret1');
  ok('login works', !r.err && /로그아웃/.test($('#authbtn').textContent), r);
  ok('password stored only as a hash', !localStorage.getItem('d_users').includes('secret1'), 0);

  // 문의 응대 채팅
  $('#chatbtn').click(); await w(300);
  const ask = async (t) => { $('#chatq').value = t; $('#chatform').requestSubmit(); await w(850); return $$('#clog .cmsg.bot').at(-1); };
  let b = await ask('한치 얼마예요?');
  ok('chat answers a product question', /22,000원/.test(b.innerText) && !!b.querySelector('[data-action=add]'), b.innerText);
  b.querySelector('[data-action=add]').click(); await w(400);
  ok('chat add-to-cart button works', $('#count').textContent === '1', $('#count').textContent);
  b = await ask('내 장바구니 보여줘');
  ok('chat shows the cart', /22,000/.test(b.innerText), b.innerText);
  b = await ask('3만원 이하 수산물');
  ok('chat applies budget + category', /수산 중/.test(b.innerText) && !/감귤잼/.test(b.innerText), b.innerText);
  b = await ask('배송 언제 와요?');
  ok('chat is honest about shipping', /등록되어 있지 않아요/.test(b.innerText), b.innerText);
  b = await ask('<img src=x onerror=alert(1)>');
  ok('chat input is escaped', !$('#clog img'), 0);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(200);
  ok('Esc closes the chat', !$('#chat').classList.contains('show'), 0);

  // 스크롤 효과
  window.scrollTo(0, innerHeight * 1.2);
  for (let i = 0; i < 40 && !$('#hdr').classList.contains('solid'); i++) await w(50); // 스크롤 이벤트 처리 시간은 기기마다 달라서 최대 2초까지 기다린다
  ok('header turns solid after scrolling', $('#hdr').classList.contains('solid'), $('#hdr').className);
  ok('no scripting errors during the run', errs.length === 0, errs);

  localStorage.clear();
  window.scrollTo(0, 0);
  const summary = `${R.pass.length} passed, ${R.fail.length} failed`;
  console.log(summary, R.fail.length ? R.fail : '');
  return { summary, fail: R.fail };
})();
