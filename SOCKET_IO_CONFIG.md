# 🔌 Настройка подключения к Socket.IO

## Проблема

В `ContainerLogs.jsx` было жёстко прописано подключение к `localhost`, что не работает в production, когда приложение запущено в Docker на другом хосте.

## Решение

### ✅ Исправленный код

```javascript
useEffect(() => {
  // В production используем текущий хост (т.к. всё на одном сервере)
  // В development используем переменные окружения
  const backendUrl = import.meta.env.PROD 
    ? window.location.origin  // В production используем текущий URL
    : `http://localhost:${import.meta.env.VITE_BACKEND_PORT || '5005'}`
  
  console.log('Connecting to Socket.IO:', backendUrl)
  
  // Connect to Socket.IO server
  socketRef.current = io(backendUrl, {
    transports: ['websocket'],
  })
  // ...
}, [container.Id])
```

### Как это работает

#### Development режим (`import.meta.env.PROD = false`):
```
Браузер → http://localhost:3011/ (Vite Dev Server)
            ↓ proxy
          http://localhost:5005/api (Express)
            ↓ WebSocket
          http://localhost:5005 (Socket.IO)
```

**Подключение:** `http://localhost:5005`

#### Production режим (`import.meta.env.PROD = true`):
```
Браузер → http://10.174.18.242:3011/ (Express через Docker)
            ↓
          /api/* (Express API)
            ↓ WebSocket на том же сервере
          / (Socket.IO на том же Express)
```

**Подключение:** `window.location.origin` (тот же хост, откуда загружена страница)

## Преимущества

1. **Автоматическое определение окружения**
   - В dev: подключается к `localhost:5005`
   - В prod: подключается к текущему домену

2. **Нет хардкода**
   - URL формируется динамически на основе окружения

3. **Работает везде**
   - ✅ Локальная разработка
   - ✅ Docker на localhost
   - ✅ Docker на удалённом хосте
   - ✅ Production на любом домене

## API запросы (уже правильно настроены)

Все API запросы используют **относительные пути**:

```javascript
// ✅ Правильно - работает везде
axios.get('/api/containers')
axios.post('/api/scripts/execute')

// ❌ Неправильно - не будет работать в production
axios.get('http://localhost:5005/api/containers')
```

### Как работает в разных режимах:

#### Development:
```javascript
axios.get('/api/containers')
// Vite proxy перенаправляет:
// http://localhost:3011/api/containers → http://localhost:5005/api/containers
```

#### Production:
```javascript
axios.get('/api/containers')
// Браузер запрашивает:
// http://10.174.18.242:3011/api/containers
// Express обрабатывает напрямую (всё на одном сервере)
```

## Конфигурация Vite Proxy

В `vite.config.js` настроен proxy для dev режима:

```javascript
server: {
  host: '0.0.0.0',
  port: 3011,
  proxy: {
    '/api': {
      target: 'http://localhost:5005',
      changeOrigin: true,
    },
    '/socket.io': {
      target: 'http://localhost:5005',
      changeOrigin: true,
      ws: true,  // WebSocket support
    }
  }
}
```

## Переменные окружения

### Vite переменные (`.env`):

```env
VITE_PORT=3011               # Порт Vite dev сервера
VITE_BACKEND_PORT=5005       # Порт Express backend
VITE_DOCKER_API_HOST=10.174.18.242
VITE_DOCKER_API_PORT=2375
```

### Доступ к переменным в коде:

```javascript
// ✅ В коде Vite/React (браузер)
import.meta.env.VITE_BACKEND_PORT

// ❌ НЕ работает в браузере
process.env.VITE_BACKEND_PORT

// ✅ В Node.js (server/index.js)
process.env.VITE_BACKEND_PORT
```

### Специальные переменные Vite:

```javascript
import.meta.env.MODE        // 'development' или 'production'
import.meta.env.PROD        // true в production
import.meta.env.DEV         // true в development
```

## Проверка подключения

### В браузере (Console):

```javascript
// Должно быть в логах:
// Development: "Connecting to Socket.IO: http://localhost:5005"
// Production:  "Connecting to Socket.IO: http://10.174.18.242:3011"
```

### Проверка Socket.IO в DevTools:

1. Откройте **Network** → **WS** (WebSocket)
2. Найдите подключение к `socket.io`
3. Должен быть статус: **101 Switching Protocols**
4. Проверьте фреймы (Frames) - должны быть сообщения

## После изменений

После изменения `ContainerLogs.jsx` необходимо:

1. **Пересобрать фронтенд:**
   ```bash
   yarn build
   ```

2. **Пересобрать Docker образ:**
   ```bash
   ./docker_rebuild.sh
   ```

3. **Проверить подключение** в консоли браузера

## Troubleshooting

### Проблема: Socket.IO не подключается

**Проверка 1:** Проверьте URL в консоли браузера
```
Connecting to Socket.IO: <должен быть правильный URL>
```

**Проверка 2:** Проверьте Network → WS
- Должно быть подключение к `/socket.io/?EIO=4&transport=websocket`

**Проверка 3:** Проверьте CORS
- Socket.IO сервер должен разрешать подключения с вашего домена

### Проблема: В production подключается к localhost

**Причина:** Не пересобран фронтенд или Docker образ

**Решение:**
```bash
yarn build
./docker_rebuild.sh
```

### Проблема: API работает, но Socket.IO нет

**Причина:** Proxy в Vite настроен для `/api`, но не для `/socket.io`

**Проверка:** Убедитесь что в `vite.config.js` есть:
```javascript
proxy: {
  '/socket.io': {
    target: 'http://localhost:5005',
    changeOrigin: true,
    ws: true,
  }
}
```
