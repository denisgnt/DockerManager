# 🏗️ Архитектура Docker Manager

## Режимы работы

### 🔧 Development (локальная разработка)

```
┌─────────────────────────┐
│   npm run dev           │
│   (concurrently)        │
└───────────┬─────────────┘
            │
            ├─────────────────────────────┐
            │                             │
            ▼                             ▼
    ┌───────────────┐           ┌────────────────┐
    │ Vite Dev      │           │ Express Server │
    │ Port: 3011    │  Proxy    │ Port: 5005     │
    │               ├──────────►│                │
    │ - Hot Reload  │  /api/*   │ - API          │
    │ - Source Maps │  /socket  │ - WebSocket    │
    └───────────────┘           └────────────────┘
```

**Запуск:**
```bash
npm run dev
# или
yarn dev
```

**Доступ:**
- Frontend: http://localhost:3011/
- Backend: http://localhost:5005/api/*

---

### 🚀 Production (Docker)

```
┌──────────────────────────────────────┐
│  http://10.174.18.242:3011/         │
│  (Внешний запрос)                    │
└──────────────┬───────────────────────┘
               │
               │ Docker port mapping
               │ 3011 → 5005
               ▼
┌──────────────────────────────────────┐
│  Express Server (в Docker)           │
│  Port: 5005 (внутренний)             │
│  ├─ Static files: /dist/*            │
│  ├─ API: /api/*                      │
│  └─ WebSocket: /socket.io            │
└──────────────────────────────────────┘
```

**Сборка:**
```bash
# 1. Сборка фронтенда (Vite)
yarn build  # → создаёт /dist

# 2. Сборка Docker образа
docker compose build

# 3. Запуск
docker compose up -d
```

**Важно:**
- ❌ Vite **НЕ запускается** в production
- ✅ Express отдаёт статику из `/dist`
- ✅ Только один порт: 5005

---

## Dockerfile - Двухэтапная сборка

### Stage 1: Builder (сборка фронтенда)
```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build  # ← создаёт /dist
```

### Stage 2: Production (финальный образ)
```dockerfile
FROM node:24-alpine
WORKDIR /app

# Копируем только нужное для production
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

# Копируем собранные файлы из builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

ENV NODE_ENV=production
EXPOSE 5005
CMD ["yarn", "start"]  # ← node server/index.js
```

---

## package.json - Скрипты

```json
{
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "client": "vite",
    "server": "node server/index.js",
    "build": "vite build",
    "start": "NODE_ENV=production node server/index.js"
  }
}
```

| Скрипт | Когда используется | Что запускает |
|--------|-------------------|---------------|
| `dev` | Локально | Vite (3011) + Express (5005) |
| `build` | Перед production | Vite build → /dist |
| `start` | В Docker | Express (5005) + статика |

---

## server/index.js - Логика сервера

```javascript
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // В production отдаём статику из /dist
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
}

// API endpoints
app.get('/api/containers', async (req, res) => { ... });
app.post('/api/containers/:id/start', async (req, res) => { ... });
// ... другие API

// Catch-all для SPA (только в production)
if (isProduction) {
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(__dirname, '../dist/index.html'));
    } else {
      next();
    }
  });
}

httpServer.listen(PORT);  // 5005
```

---

## docker-compose.yml - Конфигурация

```yaml
services:
  docker-manager:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3011:5005"  # внешний:внутренний
    environment:
      - VITE_BACKEND_PORT=5005
      - NODE_ENV=production
```

**Проброс портов:**
- Внешний порт: `3011` (доступен с хоста)
- Внутренний порт: `5005` (слушает Express)
- Vite: не используется в production

---

## Частые ошибки

### ❌ Проблема: "Cannot GET /"
**Причина:** Не собран фронтенд (`/dist` пустой)
**Решение:** 
```bash
yarn build
docker compose build --no-cache
```

### ❌ Проблема: Порт 3011 недоступен извне
**Причина:** Контейнер запустился в dev режиме
**Решение:** Проверить логи:
```bash
docker logs docker-manager
```
Должно быть: `Environment: production`
НЕ должно быть: `concurrently` или `Environment: development`

### ❌ Проблема: Старый код после пересборки
**Причина:** Docker использует кэш
**Решение:**
```bash
docker compose build --no-cache
```

---

## Проверка правильности работы

### 1. Проверка режима
```bash
docker logs docker-manager | grep "Environment:"
```
✅ Должно быть: `Environment: production`

### 2. Проверка порта
```bash
docker logs docker-manager | grep "running on port"
```
✅ Должно быть: `Server is running on port 5005`

### 3. Проверка статики
```bash
docker exec docker-manager ls -la /app/dist
```
✅ Должны быть файлы: `index.html`, `assets/`

### 4. Проверка доступности
```bash
curl -I http://10.174.18.242:3011/
```
✅ Должен вернуть: `HTTP/1.1 200 OK`

---

## Когда использовать что

| Задача | Команда |
|--------|---------|
| Локальная разработка | `yarn dev` |
| Сборка фронтенда | `yarn build` |
| Локальный production тест | `yarn start` |
| Docker сборка | `docker compose build` |
| Docker запуск | `docker compose up -d` |
| Полная пересборка | `./docker_rebuild.sh` |
