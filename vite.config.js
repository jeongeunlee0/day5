import { defineConfig, loadEnv } from 'vite'

// 개발 중에는 Vercel 함수(api/agent.js)를 Vite 서버에 그대로 붙여 쓴다.
const devApi = (env) => ({
  name: 'dev-api',
  configureServer(server) {
    Object.assign(process.env, env) // ANTHROPIC_API_KEY 는 서버에서만 사용
    server.middlewares.use('/api/agent', async (req, res) => {
      const { default: handler } = await server.ssrLoadModule('/api/agent.js')
      return handler(req, res)
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [devApi(loadEnv(mode, process.cwd(), ''))],
  build: {
    rollupOptions: { input: { main: 'index.html', guide: 'guide.html' } },
    chunkSizeWarningLimit: 600, // three.js 는 쇼핑몰·길잡이가 함께 쓰는 하나의 청크(약 546KB)라서 경고 기준만 올린다
  },
}))
