# Переменные окружения (Environment Variables)

Проект использует переменные окружения для конфигурации. Создайте файл `.env` в корне проекта на основе `.env.example`.

## Структура .env файла

```env
# Docker API Configuration
VITE_DOCKER_API_HOST=10.174.18.242
VITE_DOCKER_API_PORT=2375

# Service Links Configuration
# VITE_SERVICE_HOST=10.174.18.242

# Vite Development Server
VITE_PORT=3001

# Backend Server
VITE_BACKEND_PORT=5001
```

## Описание переменных

### Docker API

- **VITE_DOCKER_API_HOST** - IP адрес или hostname Docker API сервера
- **VITE_DOCKER_API_PORT** - Порт Docker API (по умолчанию 2375)

### Service Links

- **VITE_SERVICE_HOST** - (Опционально) IP адрес или hostname для ссылок на сервисы контейнеров. Если не указан, используется hostname текущей страницы (window.location.hostname)

### Порты приложения

- **VITE_PORT** - Порт для фронтенд dev-сервера Vite (по умолчанию 3001)
- **VITE_BACKEND_PORT** - Порт для backend Express сервера (по умолчанию 5001)

## Использование

### В клиентском коде (React)
```javascript
const dockerApiHost = import.meta.env.VITE_DOCKER_API_HOST || '10.174.18.242'
const dockerApiPort = import.meta.env.VITE_DOCKER_API_PORT || '2375'
```

### В серверном коде (Node.js)
```javascript
const DOCKER_API_HOST = process.env.VITE_DOCKER_API_HOST || '10.174.18.242'
const DOCKER_API_PORT = process.env.VITE_DOCKER_API_PORT || '2375'
```

### В Vite конфигурации
```javascript
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // используйте env.VITE_* переменные
})
```

## Важно!
- Файл `.env` не коммитится в git (добавлен в .gitignore)
- Используйте `.env.example` как шаблон
- Все переменные для фронтенда должны начинаться с `VITE_`
- Изменения в `.env` требуют перезапуска dev-сервера
