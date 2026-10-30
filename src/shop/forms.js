// 폼·입력 이벤트: 로그인/가입, 연결 설정, 방명록 글·댓글, 검색·정렬, Esc 닫기
import { $, toast, save } from './util.js';
import { S, need } from './state.js';
import { api } from './api.js';
import { renderShop } from './render.js';
import { refreshUserData, refreshPosts } from './session.js';
import { closeAll, getAuthMode, requireUser } from './ui.js';
import { Chat } from './chat.js';

const AUTH_ERRORS = [
  [/invalid login credentials/i, '이메일 또는 비밀번호가 맞지 않아요'],
  [/already registered|already been registered/i, '이미 가입된 이메일이에요. 로그인해 주세요'],
  [/email not confirmed/i, '이메일 인증을 먼저 완료해 주세요'],
  [/rate limit|too many/i, '잠시 후 다시 시도해 주세요'],
  [/password.*(at least|short|weak)|weak password/i, '비밀번호는 6자 이상으로 입력해 주세요'],
  [/failed to fetch|network/i, '서버에 연결하지 못했어요. 연결 설정과 네트워크를 확인해 주세요'],
];
const authError = (e) => AUTH_ERRORS.find(([re]) => re.test(e?.message || ''))?.[1] || e?.message || '요청에 실패했어요';

function bindForms() {
  $('#authform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#email').value.trim(), password = $('#pw').value, name = $('#nick').value.trim();
    const btn = $('#authsubmit'); btn.disabled = true;
    try {
      if (getAuthMode() === 'up') {
        if (name.length < 2) throw new Error('닉네임은 2자 이상 입력해 주세요');
        const r = await api.signUp(email, password, name);
        if (r?.needsConfirm) { toast('가입 완료! 이메일 인증 후 로그인해주세요'); e.target.reset(); closeAll(); return; }
        toast(`환영합니다, ${name}님`);
      } else {
        await api.signIn(email, password);
        toast('로그인되었어요');
      }
      e.target.reset(); closeAll();
      await refreshUserData(); await refreshPosts();
    } catch (err) {
      toast(authError(err), true);
    } finally {
      btn.disabled = false;
    }
  });
  $('#setform').addEventListener('submit', (e) => {
    e.preventDefault(); save('jeju_sb', { url: $('#sburl').value.trim(), key: $('#sbkey').value.trim() }); location.reload();
  });
  $('#gbform').addEventListener('submit', async (e) => {
    e.preventDefault(); if (!requireUser()) return;
    const t = $('#gbtext').value.trim(); if (!t) return;
    await need(async () => { await api.addPost(t); $('#gbtext').value = ''; toast('방명록을 남겼어요'); }); await refreshPosts();
  });
  $('#posts').addEventListener('submit', async (e) => {
    const f = e.target.closest('.cform'); if (!f) return; e.preventDefault();
    if (!requireUser()) return; const input = f.querySelector('input'); const pid = Number(f.dataset.id);
    await need(() => api.addComment(pid, input.value.trim())); await refreshPosts();
  });
  $('#q').addEventListener('input', (e) => { S.q = e.target.value.trim(); renderShop(); });
  $('#sort').addEventListener('change', (e) => { S.sort = e.target.value; renderShop(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeAll(); Chat.setOpen(false); } });
}

export { bindForms };
