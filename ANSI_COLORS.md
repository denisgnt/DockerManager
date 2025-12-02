# Поддержка ANSI Color Codes в логах

## Обновление

Добавлена поддержка отображения цветных логов с ANSI escape codes (bash colors).

## Что изменено

### Установлена библиотека
```bash
npm install --legacy-peer-deps ansi-to-react
```

### Обновлен компонент ContainerLogs.jsx

1. **Добавлен импорт:**
   ```javascript
   import Ansi from 'ansi-to-react'
   ```

2. **Обновлен рендеринг логов:**
   ```javascript
   {logs.map((log, index) => (
     <div key={index}>
       <Ansi>{log}</Ansi>
     </div>
   ))}
   ```

3. **Добавлены стили для span элементов:**
   ```javascript
   '& span': {
     fontFamily: 'monospace',
   }
   ```

## Поддерживаемые ANSI коды

### Цвета текста
- `\x1b[30m` - черный
- `\x1b[31m` - красный
- `\x1b[32m` - зеленый
- `\x1b[33m` - желтый
- `\x1b[34m` - синий
- `\x1b[35m` - пурпурный
- `\x1b[36m` - голубой
- `\x1b[37m` - белый

### Яркие цвета
- `\x1b[90m` - яркий черный (серый)
- `\x1b[91m` - яркий красный
- `\x1b[92m` - яркий зеленый
- `\x1b[93m` - яркий желтый
- `\x1b[94m` - яркий синий
- `\x1b[95m` - яркий пурпурный
- `\x1b[96m` - яркий голубой
- `\x1b[97m` - яркий белый

### Цвета фона
- `\x1b[40m` - черный фон
- `\x1b[41m` - красный фон
- `\x1b[42m` - зеленый фон
- `\x1b[43m` - желтый фон
- `\x1b[44m` - синий фон
- `\x1b[45m` - пурпурный фон
- `\x1b[46m` - голубой фон
- `\x1b[47m` - белый фон

### Стили текста
- `\x1b[0m` - сброс
- `\x1b[1m` - жирный
- `\x1b[2m` - тусклый
- `\x1b[3m` - курсив
- `\x1b[4m` - подчеркнутый
- `\x1b[7m` - инверсия
- `\x1b[8m` - скрытый
- `\x1b[9m` - зачеркнутый

## Примеры использования

### Docker контейнеры с цветными логами

Многие приложения выводят цветные логи:

#### Node.js приложения
```javascript
console.log('\x1b[32m%s\x1b[0m', '✓ Server started successfully');
console.log('\x1b[31m%s\x1b[0m', '✗ Error: Connection failed');
console.log('\x1b[33m%s\x1b[0m', '⚠ Warning: High memory usage');
```

#### Python приложения
```python
print('\033[92m' + 'SUCCESS: Operation completed' + '\033[0m')
print('\033[91m' + 'ERROR: Something went wrong' + '\033[0m')
```

#### Shell скрипты
```bash
echo -e "\e[32mINFO:\e[0m Starting application..."
echo -e "\e[31mERROR:\e[0m Failed to start"
echo -e "\e[33mWARN:\e[0m Low disk space"
```

### Популярные логгеры с ANSI поддержкой

#### Winston (Node.js)
```javascript
const winston = require('winston');
const logger = winston.createLogger({
  format: winston.format.colorize(),
  transports: [new winston.transports.Console()]
});
```

#### Pino (Node.js)
```javascript
const pino = require('pino');
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});
```

#### Loguru (Python)
```python
from loguru import logger
logger.add(sys.stderr, colorize=True)
```

## Как это работает

1. **Docker контейнер** выводит логи с ANSI escape codes
2. **Backend сервер** получает сырые логи через Docker API
3. **WebSocket** передает логи на клиент без изменений
4. **React компонент** использует `ansi-to-react` для преобразования
5. **Браузер** отображает логи с цветами и стилями

## Тестирование

Создайте тестовый Docker контейнер с цветными логами:

```dockerfile
FROM alpine:latest
RUN apk add --no-cache bash
CMD while true; do \
  echo -e "\e[32m$(date) INFO: Application running\e[0m"; \
  echo -e "\e[33m$(date) WARN: High CPU usage\e[0m"; \
  echo -e "\e[31m$(date) ERROR: Connection timeout\e[0m"; \
  echo -e "\e[36m$(date) DEBUG: Processing request\e[0m"; \
  sleep 5; \
done
```

Запустите:
```bash
docker build -t color-logs-test .
docker run -d --name color-test color-logs-test
```

Теперь откройте логи этого контейнера в Docker Manager - вы увидите цветные логи!

## Преимущества

✅ **Читабельность** - легче различать типы логов (INFO, WARN, ERROR)  
✅ **Совместимость** - работает с любыми контейнерами, использующими ANSI  
✅ **Без настройки** - автоматически определяет и отображает цвета  
✅ **Производительность** - библиотека легковесная и быстрая  
✅ **Стандартные коды** - поддержка всех стандартных ANSI escape sequences  

## Известные ограничения

- Использован флаг `--legacy-peer-deps` из-за несовместимости с React 18
- Работает только в современных браузерах
- Не поддерживает 256-цветную палитру (только 16 базовых цветов)

## Альтернативы

Если потребуется более продвинутая поддержка:

1. **ansi-to-html** + `dangerouslySetInnerHTML`
2. **xterm.js** - полноценный терминальный эмулятор
3. **react-console-emulator** - эмулятор консоли

---

**Дата обновления:** 2 ноября 2025 г.  
**Версия:** 1.1.0  
**Добавлено:** Поддержка ANSI color codes
