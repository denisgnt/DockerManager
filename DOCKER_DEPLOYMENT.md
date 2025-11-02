# Docker Manager - Deployment Guide

## Запуск с помощью Docker Compose

### Предварительные требования
- Docker
- Docker Compose

### Быстрый старт

1. **Настройте переменные окружения**

   Скопируйте `.env.docker` в `.env` и настройте значения:
   ```bash
   cp .env.docker .env
   ```

   Основные параметры:
   - `VITE_DOCKER_API_HOST` - IP адрес Docker API
   - `VITE_DOCKER_API_PORT` - порт Docker API (обычно 2375)
   - `VITE_PORT` - порт для фронтенда (по умолчанию 3001)
   - `VITE_BACKEND_PORT` - порт для бэкенда (по умолчанию 5001)
   - `SCRIPTS_DIR` - путь к директории со скриптами на хосте

2. **Запустите приложение**

   ```bash
   docker-compose up -d
   ```

3. **Откройте в браузере**

   ```
   http://localhost:3001
   ```

### Команды управления

**Запуск:**
```bash
docker-compose up -d
```

**Остановка:**
```bash
docker-compose down
```

**Пересборка после изменений:**
```bash
docker-compose up -d --build
```

**Просмотр логов:**
```bash
docker-compose logs -f
```

**Просмотр логов конкретного сервиса:**
```bash
docker-compose logs -f docker-manager
```

**Перезапуск:**
```bash
docker-compose restart
```

### Структура Volume

- **Scripts Directory**: Директория со скриптами монтируется из `SCRIPTS_DIR` (хост) в `/app/scripts` (контейнер) в режиме read-only
- Скрипты должны иметь имена в формате `UP_<service-name>.sh`

### Healthcheck

Приложение включает healthcheck, который проверяет доступность API каждые 30 секунд.

Проверить статус:
```bash
docker-compose ps
```

### Порты

По умолчанию используются порты:
- **3001** - веб-интерфейс
- **5001** - backend API

Можно изменить в `.env` файле.

### Сети

Приложение использует bridge-сеть `docker-manager-network` для изоляции.

## Разработка

Для локальной разработки без Docker:

```bash
yarn install
yarn dev
```

## Переменные окружения

### Docker API
- `VITE_DOCKER_API_HOST` - хост Docker API
- `VITE_DOCKER_API_PORT` - порт Docker API

### Application
- `VITE_PORT` - порт фронтенда
- `VITE_BACKEND_PORT` - порт бэкенда
- `VITE_APP_NAME` - название приложения
- `SCRIPTS_DIR` - путь к директории со скриптами

## Troubleshooting

### Контейнер не запускается

Проверьте логи:
```bash
docker-compose logs docker-manager
```

### Проблемы с доступом к Docker API

Убедитесь, что:
1. Docker API доступен по указанному адресу
2. Порт 2375 открыт
3. В настройках Docker разрешен удаленный доступ

### Скрипты не работают

1. Проверьте, что `SCRIPTS_DIR` указывает на правильную директорию
2. Убедитесь, что скрипты имеют права на выполнение:
   ```bash
   chmod +x /path/to/scripts/*.sh
   ```
3. Проверьте формат имен скриптов: `UP_<service-name>.sh`

### Порты уже используются

Измените порты в `.env`:
```properties
VITE_PORT=3002
VITE_BACKEND_PORT=5002
```

Затем пересоздайте контейнеры:
```bash
docker-compose down
docker-compose up -d
```

## Обновление

```bash
# Остановите контейнеры
docker-compose down

# Получите последние изменения
git pull

# Пересоберите и запустите
docker-compose up -d --build
```

## Удаление

Полное удаление контейнеров, сетей и образов:

```bash
docker-compose down
docker rmi docker-manager_docker-manager
```
