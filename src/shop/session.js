// 로그인한 사용자의 데이터(장바구니·주문)와 방명록을 다시 불러와 화면에 반영
import { S, need } from './state.js';
import { api } from './api.js';
import { renderChrome, renderCart, renderOrders, renderPosts } from './render.js';

async function refreshUserData() {
  S.user = await need(() => api.getUser());
  S.cart = S.user ? (await need(() => api.cart())) || [] : [];
  S.orders = S.user ? (await need(() => api.orders())) || [] : [];
  renderChrome(); renderCart(); renderOrders(); renderPosts();
}
async function refreshPosts() { S.posts = (await need(() => api.posts())) || S.posts; renderPosts(); }

export { refreshUserData, refreshPosts };
