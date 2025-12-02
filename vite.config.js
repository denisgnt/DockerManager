import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * React Compiler Configuration
 * 
 * React Compiler (ранее известный как React Forget) автоматически оптимизирует
 * React-приложения, мемоизируя компоненты и значения без необходимости 
 * использовать useMemo, useCallback и React.memo вручную.
 * 
 * Доступные опции:
 * - target: '17' | '18' | '19' - целевая версия React (по умолчанию автоопределение)
 * - sources: (filename: string) => boolean - функция фильтрации файлов для компиляции
 * - compilationMode: 'annotation' | 'infer' - режим компиляции
 *   - 'annotation': компилирует только компоненты с директивой 'use memo'
 *   - 'infer': автоматически компилирует все компоненты (по умолчанию)
 * 
 * Подробнее: https://react.dev/learn/react-compiler
 */
const ReactCompilerConfig = {
  // Опции можно раскомментировать при необходимости:
  // target: '19', // Целевая версия React
  // compilationMode: 'infer', // Режим компиляции (по умолчанию)
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(env.VITE_PORT || '3011')
  const backendPort = parseInt(env.VITE_BACKEND_PORT || '5005')

  return {
    plugins: [
      react({
        babel: {
          plugins: [
            ['babel-plugin-react-compiler', ReactCompilerConfig],
          ],
        },
      }),
    ],
    server: {
      host: '0.0.0.0', // Слушать на всех интерфейсах (важно для Docker)
      port,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/socket.io': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
          ws: true,
        }
      }
    }
  }
})
