# Docker Manager - Созданные файлы для Docker

## Список созданных файлов:

### 1. `Dockerfile`
Multi-stage Docker образ для production сборки:
- **Builder stage**: Устанавливает зависимости и собирает frontend
- **Production stage**: Создает минимальный образ с только необходимыми зависимостями
- Включает wget для healthcheck
- Устанавливает NODE_ENV=production

### 2. `docker-compose.yml`
Конфигурация для запуска приложения:
- Определяет сервис `docker-manager`
- Настраивает порты (3001 для frontend, 5001 для backend)
- Монтирует директорию скриптов как volume (read-only)
- Передает все необходимые переменные окружения
- Включает healthcheck для мониторинга состояния
- Создает изолированную bridge-сеть

### 3. `.dockerignore`
Исключает из Docker образа ненужные файлы:
- node_modules (будут установлены внутри контейнера)
- Исходники и конфиги разработки
- Git и IDE файлы
- Логи и временные файлы

### 4. `.env.docker`
Шаблон файла с переменными окружения для Docker:
- Настройки Docker API
- Порты приложения
- **SCRIPTS_DIR** - путь к директории со скриптами на хосте

### 5. `DOCKER_DEPLOYMENT.md`
Подробная документация по развертыванию:
- Инструкции по быстрому старту
- Команды управления контейнерами
- Описание volumes и портов
- Troubleshooting (решение проблем)
- Процесс обновления

### 6. `start.sh`
Скрипт для быстрого запуска:
- Создает .env из .env.docker (если не существует)
- Проверяет, что Docker запущен
- Собирает образ
- Запускает контейнеры
- Выводит информацию о доступе

### 7. Обновления в существующих файлах:

#### `server/index.js`
- Добавлена поддержка production режима
- Статические файлы обслуживаются Express в production
- SPA routing (все запросы возвращают index.html)
- Расширенное логирование при старте

#### `package.json`
- Добавлен скрипт `"start"` для production запуска
- Устанавливает NODE_ENV=production

#### `README.md`
- Добавлен раздел о запуске в Docker
- Обновлена информация о технологиях
- Ссылка на DOCKER_DEPLOYMENT.md

## Как использовать:

### Вариант 1: Быстрый старт (рекомендуется)
```bash
./start.sh
```

### Вариант 2: Ручной запуск
```bash
# 1. Настройте .env
cp .env.docker .env
nano .env  # отредактируйте под свои нужды

# 2. Запустите
docker-compose up -d

# 3. Откройте http://localhost:3001
```

## Важные особенности:

### Volume для скриптов
Директория со скриптами монтируется из хост-системы в контейнер:
- Хост: `${SCRIPTS_DIR}` (из .env)
- Контейнер: `/app/scripts`
- Режим: read-only (ro)

Это позволяет:
- ✅ Обновлять скрипты без пересборки контейнера
- ✅ Хранить скрипты вне контейнера
- ✅ Защитить от случайного изменения скриптов из контейнера

### Переменная SCRIPTS_DIR
В docker-compose.yml SCRIPTS_DIR **перезаписывается** на `/app/scripts`:
```yaml
environment:
  - SCRIPTS_DIR=/app/scripts  # внутренний путь в контейнере
volumes:
  - ${SCRIPTS_DIR}:/app/scripts:ro  # монтирование с хоста
```

### Порты
По умолчанию:
- **3001** - веб-интерфейс (frontend + static files)
- **5001** - backend API (используется фронтендом)

В production режиме оба сервиса работают на одном порту (3001).

### Production режим
В контейнере:
- NODE_ENV=production
- Vite собирает оптимизированный bundle
- Express обслуживает статические файлы из /dist
- Установлены только production зависимости

## Структура запущенного контейнера:

```
/app
├── dist/              # Собранный frontend
├── server/            # Backend код
│   ├── index.js
│   └── appsettings.js
├── scripts/           # Примонтированная директория скриптов
│   └── UP_*.sh
├── node_modules/      # Production зависимости
└── package.json
```

## Healthcheck

Контейнер включает проверку здоровья:
- Проверяет `/api/containers` каждые 30 секунд
- Время ожидания: 10 секунд
- Количество попыток: 3
- Начальная задержка: 40 секунд

Посмотреть статус:
```bash
docker-compose ps
# или
docker inspect docker-manager --format='{{.State.Health.Status}}'
```

## Логи

```bash
# Все логи
docker-compose logs -f

# С указанием количества строк
docker-compose logs -f --tail=100

# Только ошибки
docker-compose logs -f | grep -i error
```

## Остановка и очистка

```bash
# Остановка
docker-compose down

# Остановка с удалением volumes (НЕ удаляет SCRIPTS_DIR!)
docker-compose down -v

# Полная очистка (включая образ)
docker-compose down
docker rmi docker-manager_docker-manager
```
