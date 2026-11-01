// 결제 연동 지점.
// 지금은 "체험 결제"다: 실제 승인·청구가 없고 카드·계좌 정보도 받지 않는다.
// 실제 결제사(PG)를 붙일 때는 requestPayment 한 함수만 결제사 SDK/서버 호출로 바꾸면 된다.
// 주문(api.order)은 결제가 성공한 뒤에만 만들어지므로, 결제가 실패하면 주문도 장바구니 변경도 없다.
import { sleep } from './util.js';

const PAY_METHODS = [
  { id: 'card', label: '카드' },
  { id: 'transfer', label: '계좌이체' },
  { id: 'easy', label: '간편결제' },
  { id: 'fail', label: '결제 실패 체험' }, // 실패 흐름을 눈으로 확인하는 시험용 선택지
];

/**
 * @param {{ amount: number, orderName: string, method: string }} req
 * @returns {Promise<{ ok: boolean, provider: string, method: string, amount: number, paidAt?: string, message?: string }>}
 */
async function requestPayment({ amount, orderName, method }) {
  await sleep(700); // 승인 대기 느낌만 낸다
  if (method === 'fail') {
    return { ok: false, provider: 'demo', method, amount, message: '체험 결제에서 결제 실패를 선택했어요. 주문은 만들어지지 않았고 장바구니는 그대로예요.' };
  }
  void orderName;
  return { ok: true, provider: 'demo', method, amount, paidAt: new Date().toISOString() };
}

export { PAY_METHODS, requestPayment };
