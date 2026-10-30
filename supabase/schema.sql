-- 1. 상품
create table if not exists products (
  id          bigint generated always as identity primary key,
  name        text    not null,
  description text,
  category    text    not null check (category in ('과일', '채소·곡물', '육류', '수산', '간식·가공')),
  emoji       text,
  price       integer not null check (price > 0),
  created_at  timestamptz default now()
);

-- 2. 장바구니
create table if not exists cart_items (
  id         bigint generated always as identity primary key,
  user_id    uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  quantity   integer not null default 1 check (quantity > 0),
  unique (user_id, product_id)
);

-- 3. 주문 (total_price = 수량 x 단가, DB가 자동 계산)
create table if not exists orders (
  id           bigint generated always as identity primary key,
  user_id      uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  product_id   bigint references products(id) on delete set null,
  product_name text    not null,
  unit_price   integer not null,
  quantity     integer not null check (quantity > 0),
  total_price  integer generated always as (unit_price * quantity) stored,
  status       text    not null default 'ordered' check (status in ('ordered', 'returned')),
  created_at   timestamptz default now()
);

-- 4. 방명록 / 댓글 / 좋아요
create table if not exists guestbook_posts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author     text not null,
  content    text not null,
  created_at timestamptz default now()
);

create table if not exists guestbook_comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references guestbook_posts(id) on delete cascade,
  user_id    uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  author     text   not null,
  content    text   not null,
  created_at timestamptz default now()
);

create table if not exists guestbook_likes (
  post_id bigint not null references guestbook_posts(id) on delete cascade,
  user_id uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);

-- 5. RLS (행 단위 보안)
alter table products            enable row level security;
alter table cart_items          enable row level security;
alter table orders              enable row level security;
alter table guestbook_posts     enable row level security;
alter table guestbook_comments  enable row level security;
alter table guestbook_likes     enable row level security;

create policy "products read" on products for select using (true);

create policy "cart own"   on cart_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "orders own" on orders     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "posts read"   on guestbook_posts for select using (true);
create policy "posts insert" on guestbook_posts for insert with check (auth.uid() = user_id);
create policy "posts delete" on guestbook_posts for delete using (auth.uid() = user_id);

create policy "comments read"   on guestbook_comments for select using (true);
create policy "comments insert" on guestbook_comments for insert with check (auth.uid() = user_id);
create policy "comments delete" on guestbook_comments for delete using (auth.uid() = user_id);

create policy "likes read"   on guestbook_likes for select using (true);
create policy "likes insert" on guestbook_likes for insert with check (auth.uid() = user_id);
create policy "likes delete" on guestbook_likes for delete using (auth.uid() = user_id);

-- 6. 상품 데이터는 supabase/seed_products.sql 을 이어서 실행하세요.
--    (public/data/products.json 에서 `node scripts/products.mjs sql` 로 만든 파일이라 화면의 체험 모드와 같은 28개 상품이에요.)
