import { useState } from 'react'
import './Vibe.css'

function Vibe({ emoji, title, tag, desc, from, to }) {
  const [liked, setLiked] = useState(false)

  return (
    <article className="vibe">
      <div
        className="vibe-cover"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      >
        <span className="vibe-emoji">{emoji}</span>
        <span className="vibe-tag">#{tag}</span>
      </div>
      <div className="vibe-body">
        <h3>{title}</h3>
        <p>{desc}</p>
        <button
          className={liked ? 'vibe-like liked' : 'vibe-like'}
          onClick={() => setLiked((v) => !v)}
          aria-pressed={liked}
        >
          {liked ? '♥ 좋아요' : '♡ 좋아요'}
        </button>
      </div>
    </article>
  )
}

export default Vibe
