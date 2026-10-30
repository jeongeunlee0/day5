import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// 개발 중에는 Vercel 함수(api/agent.js)를 Vite 서버에 그대로 붙여 쓴다.
const devApi = (env) => ({
  name: 'dev-api',
  configureServer(server) {
    Object.assign(process.env, env) // ANTHROPIC_API_KEY, KMA_SERVICE_KEY 는 서버에서만 사용
    server.middlewares.use('/api/agent', async (req, res) => {
      const { default: handler } = await server.ssrLoadModule('/api/agent.js')
      return handler(req, res)
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ''))],
  build: {
    rollupOptions: { input: { main: 'index.html', guide: 'guide.html' } },
  },
}))
