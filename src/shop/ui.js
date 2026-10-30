// 서랍·모달 열고 닫기, 로그인 탭 전환, 로그인 필요 안내
import { $, toast } from './util.js';
import { S } from './state.js';
import { sb } from './api.js';

const scrim = $('#scrim');
function closeAll() { document.querySelectorAll('.drawer,.modal').forEach((e) => e.classList.remove('show')); scrim.classList.remove('show'); }
function openEl(sel) { closeAll(); $(sel).classList.add('show'); scrim.classList.add('show'); }
let authMode = 'in';
function setAuthMode(m) {
  authMode = m;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === m));
  $('#nick').style.display = m === 'up' ? '' : 'none'; $('#nick').required = m === 'up';
  $('#authsubmit').textContent = m === 'up' ? '가입하기' : '로그인';
  $('#pw').autocomplete = m === 'up' ? 'new-password' : 'current-password';
  $('#authnote').textContent = sb ? '' : '체험 모드: 계정은 이 브라우저에만 저장돼요. 실제 서비스 연결은 하단 "Supabase 연결 설정"에서 할 수 있어요.';
}
const requireUser = () => { if (S.user) return true; toast('로그인이 필요해요'); setAuthMode('in'); openEl('#authmodal'); return false; };
const getAuthMode = () => authMode;

export { closeAll, openEl, setAuthMode, getAuthMode, requireUser };
