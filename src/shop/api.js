// 데이터 계층: Supabase 가 설정돼 있으면 remote, 아니면 브라우저 안에서 동작하는 demo.
// 화면 코드는 api 하나만 보고 둘 중 무엇인지 알 필요가 없다.
import { createClient } from '@supabase/supabase-js';
import { load, save } from './util.js';
import { S } from './state.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const ENV = import.meta.env || {};
const stored = load('jeju_sb', {});
const SB_URL = ENV.VITE_SUPABASE_URL || stored.url || SUPABASE_URL;
const SB_KEY = ENV.VITE_SUPABASE_ANON_KEY || stored.key || SUPABASE_ANON_KEY;
const sb = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

// 상품 원본은 public/data/products.json 한 곳. 체험 모드는 이 파일을, Supabase 모드는 같은 내용을 넣은 products 테이블을 쓴다.
const catalogUrl = new URL('data/products.json', document.baseURI);

/* 체험 모드 인증: Supabase 없이도 가입·로그인이 실제로 동작한다. 계정과 데이터는 이 브라우저(localStorage)에만 저장된다. */
async function hashPw(pw, salt) {
  const bytes = new TextEncoder().encode(salt + pw);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; for (const b of bytes) h = ((h << 5) + h + b) >>> 0; // 보안 컨텍스트가 아닐 때의 단순 대체
  return 'x' + h.toString(16);
}
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2));

const demo = {
  user: null,
  uk(name) { return `${name}:${this.user?.id}`; }, // 계정별 저장 키
  async signUp(email, password, name) {
    email = email.trim().toLowerCase();
    const users = load('d_users', []);
    if (users.some((u) => u.email === email)) throw new Error('already registered');
    const salt = newId();
    const u = { id: newId(), email, name, salt, hash: await hashPw(password, salt) };
    users.push(u); save('d_users', users); save('d_session', u.id);
    return { needsConfirm: false };
  },
  async signIn(email, password) {
    email = email.trim().toLowerCase();
    const u = load('d_users', []).find((x) => x.email === email);
    if (!u || (await hashPw(password, u.salt)) !== u.hash) throw new Error('Invalid login credentials');
    save('d_session', u.id);
  },
  async signOut() { try { localStorage.removeItem('d_session'); } catch {} this.user = null; },
  async getUser() {
    const id = load('d_session', null);
    const u = id && load('d_users', []).find((x) => x.id === id);
    this.user = u ? { id: u.id, name: u.name, email: u.email } : null;
    return this.user;
  },
  async products() {
    const r = await fetch(catalogUrl);
    if (!r.ok) throw new Error('상품 데이터를 불러오지 못했어요');
    return (await r.json()).products;
  },
  async cart() { return load(this.uk('d_cart'), []); },
  async setCart(pid, qty) {
    const k = this.uk('d_cart'); let c = load(k, []); const i = c.findIndex((x) => x.product_id === pid);
    if (i >= 0) c[i].quantity = qty; else c.push({ product_id: pid, quantity: qty }); save(k, c);
  },
  async removeCart(pid) { const k = this.uk('d_cart'); save(k, load(k, []).filter((x) => x.product_id !== pid)); },
  async order(items) {
    const k = this.uk('d_orders'), o = load(k, []);
    items.forEach((it, n) => o.unshift({ id: Date.now() + n, product_id: it.p.id, product_name: it.p.name, unit_price: it.p.price,
      quantity: it.quantity, total_price: it.p.price * it.quantity, status: 'ordered', created_at: new Date().toISOString() }));
    save(k, o); save(this.uk('d_cart'), []);
  },
  async orders() { return load(this.uk('d_orders'), []); },
  async returnOrder(id) { const k = this.uk('d_orders'); save(k, load(k, []).map((o) => (o.id === id ? { ...o, status: 'returned' } : o))); },
  async posts() {
    return load('d_posts', [
      { id: 1, user_id: 'x', author: '제주토박이', content: '한라봉 박스 열자마자 향이 확 퍼졌어요. 재구매 확정!', created_at: new Date(Date.now() - 3600e3 * 5).toISOString(), comments: [{ id: 1, user_id: 'y', author: '귤덕후', content: '저도 시켜봐야겠어요' }], likes: ['y'] },
      { id: 2, user_id: 'y', author: '귤덕후', content: '옥돔 손질이 깔끔해서 바로 구워 먹었어요.', created_at: new Date(Date.now() - 3600e3 * 30).toISOString(), comments: [], likes: [] },
      { id: 3, user_id: 'z', author: '바다집사', content: '오메기떡 쫀득함이 진짜예요. 선물용으로도 좋아요.', created_at: new Date(Date.now() - 3600e3 * 52).toISOString(), comments: [], likes: [] },
    ]);
  },
  async addPost(content) { const p = load('d_posts', await this.posts()); p.unshift({ id: Date.now(), user_id: this.user.id, author: this.user.name, content, created_at: new Date().toISOString(), comments: [], likes: [] }); save('d_posts', p); },
  async delPost(id) { save('d_posts', (await this.posts()).filter((p) => p.id !== id)); },
  async addComment(pid, content) { const p = await this.posts(); p.find((x) => x.id === pid)?.comments.push({ id: Date.now(), user_id: this.user.id, author: this.user.name, content }); save('d_posts', p); },
  async delComment(pid, cid) { const p = await this.posts(); const t = p.find((x) => x.id === pid); if (t) t.comments = t.comments.filter((c) => c.id !== cid); save('d_posts', p); },
  async toggleLike(pid) { const p = await this.posts(); const t = p.find((x) => x.id === pid); if (!t) return; const me = this.user.id; t.likes = t.likes.includes(me) ? t.likes.filter((u) => u !== me) : [...t.likes, me]; save('d_posts', p); },
};

const remote = {
  async signUp(email, password, name) {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw error;
    return { needsConfirm: !data.session };
  },
  async signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
  async signOut() { const { error } = await sb.auth.signOut(); if (error) throw error; },
  async products() { const { data, error } = await sb.from('products').select('*').order('id'); if (error) throw error; return data; },
  async getUser() {
    const { data } = await sb.auth.getUser(); const u = data?.user; if (!u) return null;
    return { id: u.id, email: u.email, name: u.user_metadata?.name || u.email.split('@')[0] };
  },
  async cart() { const { data, error } = await sb.from('cart_items').select('id,product_id,quantity').order('id'); if (error) throw error; return data; },
  async setCart(pid, qty) { const { error } = await sb.from('cart_items').upsert({ product_id: pid, quantity: qty }, { onConflict: 'user_id,product_id' }); if (error) throw error; },
  async removeCart(pid) { const { error } = await sb.from('cart_items').delete().eq('product_id', pid); if (error) throw error; },
  async order(items) {
    const rows = items.map((it) => ({ product_id: it.p.id, product_name: it.p.name, unit_price: it.p.price, quantity: it.quantity }));
    const { error } = await sb.from('orders').insert(rows); if (error) throw error;
    const { error: e2 } = await sb.from('cart_items').delete().in('product_id', items.map((i) => i.p.id)); if (e2) throw e2;
  },
  async orders() { const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }); if (error) throw error; return data; },
  async returnOrder(id) { const { error } = await sb.from('orders').update({ status: 'returned' }).eq('id', id); if (error) throw error; },
  async posts() {
    const { data, error } = await sb.from('guestbook_posts').select('*, guestbook_comments(*), guestbook_likes(user_id)').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map((p) => ({ ...p, comments: (p.guestbook_comments || []).sort((a, b) => a.id - b.id), likes: (p.guestbook_likes || []).map((l) => l.user_id) }));
  },
  async addPost(content) { const { error } = await sb.from('guestbook_posts').insert({ author: S.user.name, content }); if (error) throw error; },
  async delPost(id) { const { error } = await sb.from('guestbook_posts').delete().eq('id', id); if (error) throw error; },
  async addComment(pid, content) { const { error } = await sb.from('guestbook_comments').insert({ post_id: pid, author: S.user.name, content }); if (error) throw error; },
  async delComment(_p, cid) { const { error } = await sb.from('guestbook_comments').delete().eq('id', cid); if (error) throw error; },
  async toggleLike(pid) {
    const liked = S.posts.find((p) => p.id === pid)?.likes.includes(S.user.id);
    const q = liked ? sb.from('guestbook_likes').delete().match({ post_id: pid, user_id: S.user.id }) : sb.from('guestbook_likes').insert({ post_id: pid });
    const { error } = await q; if (error) throw error;
  },
};
const api = sb ? remote : demo;

export { sb, stored, api };
