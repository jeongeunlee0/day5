// 장바구니로 날아가는 효과, 스크롤에 따른 헤더·섹션 등장
import { $ } from './util.js';
import { art } from './art.js';

function flyToCart(from, p) {
  const a = from.getBoundingClientRect(), b = $('.cartbtn').getBoundingClientRect();
  const f = document.createElement('div'); f.className = 'fly'; f.innerHTML = p ? art(p) : '';
  f.style.left = a.left + 'px'; f.style.top = a.top + 'px'; document.body.append(f);
  f.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${(b.left - a.left) / 2}px, ${(b.top - a.top) / 2 - 90}px) scale(1.15)`, opacity: 1, offset: .5 },
    { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(.3)`, opacity: .2 }],
    { duration: 750, easing: 'cubic-bezier(.4,.1,.3,1)' }).onfinish = () => f.remove();
}

function initScrollEffects() {
  const hdr = $('#hdr');
  const io = new IntersectionObserver((es) => es.forEach((x) => x.isIntersecting && x.target.classList.add('in')), { threshold: .05 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  addEventListener('scroll', () => hdr.classList.toggle('solid', scrollY > innerHeight * .6), { passive: true });
}

export { flyToCart, initScrollEffects };
