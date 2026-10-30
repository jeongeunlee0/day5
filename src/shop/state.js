// 화면이 읽는 상태 객체(S) 한 곳과 그 위의 작은 도우미
import { toast } from './util.js';

const S = { loadError: false, products: [], cart: [], orders: [], posts: [], user: null, cat: '전체', q: '', sort: 'id', openComments: new Set(), loadingProducts: true };
const prod = (id) => S.products.find((p) => p.id === id);
const cartLines = () => S.cart.map((c) => ({ ...c, p: prod(c.product_id) })).filter((c) => c.p);
const need = async (fn) => { try { return await fn(); } catch (e) { console.error(e); toast(e.message || '요청에 실패했어요', true); } };

export { S, prod, cartLines, need };
