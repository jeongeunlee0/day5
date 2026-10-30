// 상품 데이터 점검·변환 도구
//   node scripts/products.mjs validate   JSON 의 중복·표기·값 범위를 점검한다 (문제가 있으면 종료 코드 1)
//   node scripts/products.mjs sql        supabase/seed_products.sql 을 JSON 에서 만든다
import fs from 'node:fs'
import path from 'node:path'

const FILE = path.resolve('public/data/products.json')
const SQL = path.resolve('supabase/seed_products.sql')
const ART_EMOJI = ['🍊', '🥕', '🌾', '🐖', '🐟', '🦑', '🐚', '🍫', '🍡', '🍶', '🍵', '🥣', '🍞', '🫓', '🧃', '🍯'] // index.html art() 가 그림을 가진 이모지

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const { meta, products } = data

// 규격(숫자+단위)과 공백을 뺀 "상품의 알맹이" 이름. 한라봉 3kg 과 한라봉 5kg 은 같은 알맹이다.
const core = (name) => name.replace(/\d+(\.\d+)?\s*(kg|g|ml|l|마리|개입|인분|종)/gi, '').replace(/\s+/g, '').toLowerCase()

function validate() {
  const errs = [], warns = []
  const err = (m) => errs.push(m)

  if (!Array.isArray(products) || !products.length) err('products 배열이 비어 있어요')
  const cats = new Set(meta.categories)

  const seen = { id: new Map(), name: new Map(), core: new Map(), desc: new Map() }
  const dup = (map, key, p, label) => {
    if (map.has(key)) err(`${label} 중복: #${map.get(key)} 와 #${p.id} ("${key}")`)
    else map.set(key, p.id)
  }

  for (const p of products) {
    const tag = `#${p.id} ${p.name ?? '(이름 없음)'}`
    for (const k of ['id', 'name', 'description', 'category', 'emoji', 'price']) if (p[k] === undefined || p[k] === '') err(`${tag}: ${k} 가 비어 있어요`)
    if (!Number.isInteger(p.id) || p.id < 1) err(`${tag}: id 는 1 이상의 정수여야 해요`)
    if (!Number.isInteger(p.price) || p.price <= 0) err(`${tag}: price 는 0보다 큰 정수여야 해요 (${p.price})`)
    else if (p.price < 1000 || p.price > 100000) warns.push(`${tag}: 가격 ${p.price} 이 일반적인 범위(1,000~100,000)를 벗어나요`)
    if (!cats.has(p.category)) err(`${tag}: category "${p.category}" 는 meta.categories 에 없는 표기예요`)
    if (!ART_EMOJI.includes(p.emoji)) err(`${tag}: emoji ${p.emoji} 에 맞는 상품 그림이 없어요`)
    if (typeof p.name === 'string' && p.name !== p.name.trim().replace(/\s+/g, ' ')) err(`${tag}: 이름에 불필요한 공백이 있어요`)
    if (typeof p.category === 'string' && p.category !== p.category.trim()) err(`${tag}: category 앞뒤 공백`)

    dup(seen.id, p.id, p, 'id')
    dup(seen.name, String(p.name).replace(/\s+/g, '').toLowerCase(), p, '이름')
    dup(seen.core, core(String(p.name)), p, '규격만 다른 같은 상품')
    dup(seen.desc, String(p.description).replace(/\s+/g, ''), p, '설명')
  }

  // id 는 1..N 연속 (원본 10종 id 를 유지한 채 이어 붙였는지)
  const ids = products.map((p) => p.id).sort((a, b) => a - b)
  ids.forEach((id, i) => { if (id !== i + 1) warns.push(`id 가 1..N 으로 이어지지 않아요 (${i + 1} 자리에 ${id})`) })

  // 쓰지 않는 카테고리 / 상품이 1개뿐인 카테고리
  const count = Object.fromEntries([...cats].map((c) => [c, products.filter((p) => p.category === c).length]))
  for (const [c, n] of Object.entries(count)) { if (n === 0) err(`카테고리 "${c}" 에 상품이 없어요`); else if (n === 1) warns.push(`카테고리 "${c}" 는 상품이 1개뿐이에요`) }

  return { errs, warns, count }
}

function sql() {
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`
  const rows = products.map((p) => `  (${p.id}, ${q(p.name)}, ${q(p.description)}, ${q(p.category)}, ${q(p.emoji)}, ${p.price})`).join(',\n')
  const out = `-- public/data/products.json 에서 scripts/products.mjs 로 만든 파일입니다. 직접 고치지 말고 JSON 을 고친 뒤 다시 만드세요.
-- 가격은 예시값입니다. 여러 번 실행해도 같은 결과가 되도록 id 기준으로 덮어씁니다.
insert into products (id, name, description, category, emoji, price) overriding system value values
${rows}
on conflict (id) do update set
  name = excluded.name, description = excluded.description, category = excluded.category, emoji = excluded.emoji, price = excluded.price;

-- identity 시퀀스를 최대 id 뒤로 맞춰서, 이후 직접 넣는 상품이 id 충돌을 내지 않게 한다.
select setval(pg_get_serial_sequence('products', 'id'), (select max(id) from products));
`
  fs.writeFileSync(SQL, out)
  console.log(`wrote ${path.relative(process.cwd(), SQL)} (${products.length} rows)`)
}

const cmd = process.argv[2]
if (cmd === 'sql') sql()
else if (cmd === 'validate' || !cmd) {
  const { errs, warns, count } = validate()
  console.log(`상품 ${products.length}개 · 카테고리별:`, count)
  warns.forEach((w) => console.log('  주의:', w))
  if (errs.length) { errs.forEach((e) => console.error('  오류:', e)); console.error(`\n실패: 오류 ${errs.length}건`); process.exit(1) }
  console.log('\n통과: 중복·표기·값 범위에 오류가 없어요')
} else { console.error('사용법: node scripts/products.mjs validate | sql'); process.exit(2) }
