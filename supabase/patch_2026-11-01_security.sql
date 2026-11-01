-- day5 보안 보완 (2026-11-01) · schema.sql 다음에 실행
-- 1) 같은 프로젝트의 day4 게임이 '익명 로그인'을 쓰므로, day5의 쓰기(장바구니 · 주문 · 방명록)는 실제 가입한 계정만 허용
-- 2) 주문의 상품 이름 · 단가는 브라우저가 보낸 값이 아니라 products 표에서 DB가 직접 채움 (가격 조작 방지)
--    주문 수정은 상태(반품)만 바뀌게 함
-- 3) 방명록 · 댓글의 작성자 이름은 로그인한 계정 정보로 DB가 채움 (다른 사람 이름 사칭 방지)
-- 여러 번 실행해도 같은 결과가 되도록 작성

-- 실제 가입한(익명이 아닌) 사용자인지
create or replace function public.is_real_user() returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

-- 1. 쓰기 정책을 실제 계정으로 제한
drop policy if exists "cart own" on public.cart_items;
create policy "cart own" on public.cart_items for all to authenticated
  using (public.is_real_user() and auth.uid() = user_id) with check (public.is_real_user() and auth.uid() = user_id);

drop policy if exists "orders own" on public.orders;
create policy "orders own" on public.orders for all to authenticated
  using (public.is_real_user() and auth.uid() = user_id) with check (public.is_real_user() and auth.uid() = user_id);

drop policy if exists "posts insert" on public.guestbook_posts;
drop policy if exists "posts delete" on public.guestbook_posts;
create policy "posts insert" on public.guestbook_posts for insert to authenticated with check (public.is_real_user() and auth.uid() = user_id);
create policy "posts delete" on public.guestbook_posts for delete to authenticated using (public.is_real_user() and auth.uid() = user_id);

drop policy if exists "comments insert" on public.guestbook_comments;
drop policy if exists "comments delete" on public.guestbook_comments;
create policy "comments insert" on public.guestbook_comments for insert to authenticated with check (public.is_real_user() and auth.uid() = user_id);
create policy "comments delete" on public.guestbook_comments for delete to authenticated using (public.is_real_user() and auth.uid() = user_id);

drop policy if exists "likes insert" on public.guestbook_likes;
drop policy if exists "likes delete" on public.guestbook_likes;
create policy "likes insert" on public.guestbook_likes for insert to authenticated with check (public.is_real_user() and auth.uid() = user_id);
create policy "likes delete" on public.guestbook_likes for delete to authenticated using (public.is_real_user() and auth.uid() = user_id);

-- 2. 주문 가격 · 이름은 DB가 채움, 수정은 상태만
create or replace function public.orders_guard() returns trigger
language plpgsql set search_path = '' as $$
declare p record;
begin
  if tg_op = 'INSERT' then
    select name, price into p from public.products where id = new.product_id;
    if not found then raise exception '없는 상품이에요 (id %)', new.product_id; end if;
    new.product_name := p.name;
    new.unit_price   := p.price;
    new.status       := 'ordered';
    new.created_at   := now();
  else
    new.user_id      := old.user_id;
    new.product_id   := old.product_id;
    new.product_name := old.product_name;
    new.unit_price   := old.unit_price;
    new.quantity     := old.quantity;
    new.created_at   := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists orders_guard on public.orders;
create trigger orders_guard before insert or update on public.orders for each row execute function public.orders_guard();

-- 3. 작성자 이름은 계정 정보로
create or replace function public.guestbook_author() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.author := coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''), split_part(auth.jwt() ->> 'email', '@', 1), new.author);
  return new;
end $$;
drop trigger if exists guestbook_posts_author on public.guestbook_posts;
create trigger guestbook_posts_author before insert on public.guestbook_posts for each row execute function public.guestbook_author();
drop trigger if exists guestbook_comments_author on public.guestbook_comments;
create trigger guestbook_comments_author before insert on public.guestbook_comments for each row execute function public.guestbook_author();

-- 확인용: 지금 적용된 정책 목록
select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename in ('cart_items', 'orders', 'guestbook_posts', 'guestbook_comments', 'guestbook_likes')
order by tablename, policyname;
