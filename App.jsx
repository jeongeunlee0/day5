import Vibe from './components/Vibe.jsx'
import { vibes } from './data/vibes.js'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="hero">
        <p className="hero-sub">Welcome to</p>
        <h1>🏝️ Jeju Vibe</h1>
        <p>바람, 돌, 여자가 많다는 삼다도. 지금 가장 제주다운 10가지 순간을 만나보세요.</p>
        <a className="cta" href="#vibes">여행 시작하기</a>
      </header>

      <main id="vibes" className="grid">
        {vibes.map((v) => (
          <Vibe key={v.id} {...v} />
        ))}
      </main>

      <footer className="footer">© 2026 Jeju Vibe · 제주도 홍보 사이트</footer>
    </div>
  )
}

export default App
