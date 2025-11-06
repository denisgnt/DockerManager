# Zustand Store - Управление состоянием

## Обзор

В проекте Docker Manager используется **Zustand** — минималистичная библиотека для управления глобальным состоянием React-приложений. Zustand обеспечивает простой API без boilerplate-кода и отлично работает с React Compiler.

## Преимущества Zustand

✅ **Минималистичный** - всего ~1KB в gzip  
✅ **Простой API** - без Context, Provider, reducer и actions  
✅ **TypeScript-friendly** - полная поддержка типов  
✅ **DevTools** - интеграция с Redux DevTools  
✅ **Нет prop drilling** - доступ к состоянию из любого компонента  
✅ **Производительность** - минимальные ре-рендеры  
✅ **React Compiler совместимость** - автоматическая оптимизация

## Структура Store

```
src/
  store/
    useDockerStore.js  # Главный store приложения
```

## Архитектура Store

### Состояние (State)

```javascript
{
  // Данные контейнеров
  containers: [],                    // Список Docker-контейнеров
  selectedContainer: null,           // Контейнер для просмотра логов
  selectedContainerInfo: null,       // Контейнер для просмотра информации
  
  // UI состояние
  loading: true,                     // Индикатор загрузки
  error: null,                       // Сообщение об ошибке
  viewMode: 'list',                  // Режим отображения: 'list' | 'grid'
  
  // Скрипты
  availableScripts: {},              // Доступные скрипты
  rebuildingContainers: Set(),       // Контейнеры в процессе rebuild
  
  // Уведомления
  snackbar: { open: false, message: '' },
  scriptOutput: { open: false, data: null },
  
  // Конфигурация
  dockerApiUrl: 'host:port'          // URL Docker API
}
```

### Действия (Actions)

| Действие | Описание |
|----------|----------|
| `fetchContainers()` | Загрузить список контейнеров |
| `fetchScripts()` | Загрузить список скриптов |
| `handleContainerAction(id, action)` | Выполнить действие над контейнером |
| `executeScript(container, scriptName)` | Выполнить скрипт |
| `setSelectedContainer(container)` | Выбрать контейнер для логов |
| `setSelectedContainerInfo(container)` | Выбрать контейнер для информации |
| `setError(error)` | Установить ошибку |
| `closeSnackbar()` | Закрыть уведомление |
| `closeScriptOutput()` | Закрыть окно вывода скрипта |
| `setViewMode(mode)` | Изменить режим отображения |

## Использование в компонентах

### Базовое использование

```javascript
import useDockerStore from './store/useDockerStore'

function MyComponent() {
  // Получить всё состояние (не рекомендуется - вызовет ре-рендер при любом изменении)
  const store = useDockerStore()
  
  return <div>{store.containers.length}</div>
}
```

### Селекторы (рекомендуется)

Используйте селекторы для получения только необходимых данных:

```javascript
import useDockerStore from './store/useDockerStore'

function ContainerCount() {
  // Компонент ре-рендерится только при изменении containers
  const containers = useDockerStore(state => state.containers)
  
  return <div>Контейнеров: {containers.length}</div>
}
```

### Множественные селекторы

```javascript
function ContainerManager() {
  // Получить несколько значений
  const { containers, loading, error } = useDockerStore(state => ({
    containers: state.containers,
    loading: state.loading,
    error: state.error,
  }))
  
  if (loading) return <Spinner />
  if (error) return <Error message={error} />
  
  return <ContainerList containers={containers} />
}
```

### Использование действий

```javascript
function RefreshButton() {
  // Получить только действие (не вызовет ре-рендер при изменении состояния)
  const fetchContainers = useDockerStore(state => state.fetchContainers)
  
  return (
    <button onClick={fetchContainers}>
      Обновить
    </button>
  )
}
```

### Комбинирование состояния и действий

```javascript
function App() {
  const {
    containers,
    loading,
    error,
    fetchContainers,
    handleContainerAction,
    setError,
  } = useDockerStore()
  
  useEffect(() => {
    fetchContainers()
  }, [fetchContainers])
  
  return (
    <div>
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Spinner /> : <ContainerList />}
    </div>
  )
}
```

## Продвинутые паттерны

### Shallow сравнение для объектов

```javascript
import { shallow } from 'zustand/shallow'

function Component() {
  // Использовать shallow для предотвращения лишних ре-рендеров
  const { containers, loading } = useDockerStore(
    state => ({ containers: state.containers, loading: state.loading }),
    shallow
  )
}
```

### Подписка вне React-компонентов

```javascript
// Получить состояние в любом месте
const containers = useDockerStore.getState().containers

// Вызвать действие в любом месте
useDockerStore.getState().fetchContainers()

// Подписаться на изменения
const unsubscribe = useDockerStore.subscribe(
  state => console.log('Containers:', state.containers)
)

// Отписаться
unsubscribe()
```

### Селектор с вычислением

```javascript
function RunningContainers() {
  // Мемоизированный селектор
  const runningCount = useDockerStore(state => 
    state.containers.filter(c => c.State === 'running').length
  )
  
  return <div>Запущено: {runningCount}</div>
}
```

## Middleware: DevTools

Store использует middleware `devtools` для интеграции с Redux DevTools.

### Включение DevTools

DevTools включены только в режиме разработки:

```javascript
import { devtools } from 'zustand/middleware'

const useDockerStore = create(
  devtools(
    (set, get) => ({
      // ... state и actions
    }),
    {
      name: 'docker-store',
      enabled: import.meta.env.DEV,
    }
  )
)
```

### Использование Redux DevTools

1. Установите [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools)
2. Откройте DevTools в браузере
3. Выберите вкладку "Redux"
4. Наблюдайте за изменениями состояния в реальном времени

### Отладка действий

Все действия логируются в DevTools с понятными именами:

```javascript
// В store действия вызываются так:
set({ loading: true }, false, 'setLoading')
set({ containers: data }, false, 'fetchContainers/success')
```

## Оптимизация производительности

### 1. Гранулярные селекторы

❌ **Плохо** - компонент ре-рендерится при любом изменении:
```javascript
const store = useDockerStore()
```

✅ **Хорошо** - компонент ре-рендерится только при изменении containers:
```javascript
const containers = useDockerStore(state => state.containers)
```

### 2. Селекторы для производных данных

❌ **Плохо** - вычисление при каждом рендере:
```javascript
const containers = useDockerStore(state => state.containers)
const running = containers.filter(c => c.State === 'running')
```

✅ **Хорошо** - вычисление в селекторе:
```javascript
const running = useDockerStore(state => 
  state.containers.filter(c => c.State === 'running')
)
```

### 3. Мемоизация сложных селекторов

Для действительно дорогих вычислений используйте библиотеку для мемоизации:

```javascript
import { createSelector } from 'reselect'

const selectRunningContainers = createSelector(
  state => state.containers,
  containers => containers.filter(c => c.State === 'running')
)

// В компоненте
const running = useDockerStore(selectRunningContainers)
```

### 4. Разделение на несколько stores

Если приложение растёт, можно разделить на несколько stores:

```javascript
// useContainerStore.js
const useContainerStore = create(...)

// useScriptStore.js  
const useScriptStore = create(...)

// useUIStore.js
const useUIStore = create(...)
```

## Тестирование

### Мокирование store в тестах

```javascript
import { beforeEach, vi } from 'vitest'
import useDockerStore from './store/useDockerStore'

beforeEach(() => {
  // Сброс состояния перед каждым тестом
  useDockerStore.setState({
    containers: [],
    loading: false,
    error: null,
  })
})

test('should display containers', () => {
  // Установить тестовые данные
  useDockerStore.setState({
    containers: [{ Id: '1', Names: ['/test'] }]
  })
  
  // Ваш тест
})
```

### Тестирование действий

```javascript
test('should fetch containers', async () => {
  const { fetchContainers } = useDockerStore.getState()
  
  await fetchContainers()
  
  const { containers, loading } = useDockerStore.getState()
  expect(loading).toBe(false)
  expect(containers).toBeDefined()
})
```

## Миграция с useState на Zustand

### До (с useState)

```javascript
function App() {
  const [containers, setContainers] = useState([])
  const [loading, setLoading] = useState(true)
  
  const fetchContainers = async () => {
    setLoading(true)
    const data = await api.getContainers()
    setContainers(data)
    setLoading(false)
  }
  
  return (
    <ContainerList 
      containers={containers}
      onRefresh={fetchContainers}
    />
  )
}

// Дочерний компонент
function ContainerList({ containers, onRefresh }) {
  return (
    <div>
      <button onClick={onRefresh}>Refresh</button>
      {containers.map(c => <Container key={c.Id} data={c} />)}
    </div>
  )
}
```

### После (с Zustand)

```javascript
// App.jsx
function App() {
  const { fetchContainers } = useDockerStore()
  
  useEffect(() => {
    fetchContainers()
  }, [fetchContainers])
  
  return <ContainerList />
}

// ContainerList.jsx  
function ContainerList() {
  const containers = useDockerStore(state => state.containers)
  const fetchContainers = useDockerStore(state => state.fetchContainers)
  
  return (
    <div>
      <button onClick={fetchContainers}>Refresh</button>
      {containers.map(c => <Container key={c.Id} data={c} />)}
    </div>
  )
}
```

### Преимущества после миграции

✅ Нет prop drilling - компоненты получают данные напрямую  
✅ Меньше кода - не нужно передавать props через несколько уровней  
✅ Лучше производительность - только нужные компоненты ре-рендерятся  
✅ Проще тестирование - можно тестировать компоненты изолированно  

## Best Practices

### 1. Используйте селекторы

```javascript
// ✅ Хорошо
const containers = useDockerStore(state => state.containers)

// ❌ Плохо
const store = useDockerStore()
const containers = store.containers
```

### 2. Группируйте связанные данные

```javascript
// ✅ Хорошо
const { containers, loading, error } = useDockerStore(state => ({
  containers: state.containers,
  loading: state.loading,
  error: state.error,
}))

// ❌ Плохо - три отдельных подписки
const containers = useDockerStore(state => state.containers)
const loading = useDockerStore(state => state.loading)
const error = useDockerStore(state => state.error)
```

### 3. Действия не вызывают ре-рендер

```javascript
// ✅ Хорошо - компонент не ре-рендерится при изменении состояния
const fetchContainers = useDockerStore(state => state.fetchContainers)
```

### 4. Избегайте сложной логики в компонентах

```javascript
// ❌ Плохо
function Component() {
  const containers = useDockerStore(state => state.containers)
  const handleAction = async (id, action) => {
    // Сложная логика в компоненте
    const response = await api.action(id, action)
    // ...
  }
}

// ✅ Хорошо - логика в store
function Component() {
  const handleContainerAction = useDockerStore(state => state.handleContainerAction)
  // Просто вызываем действие
}
```

### 5. Документируйте состояние и действия

Используйте JSDoc комментарии для документирования:

```javascript
/**
 * Выполнить действие над контейнером
 * @param {string} containerId - ID контейнера
 * @param {'start'|'stop'|'restart'|'remove'} action - Действие
 * @returns {Promise<void>}
 */
handleContainerAction: async (containerId, action) => {
  // ...
}
```

## Часто задаваемые вопросы

### Как сбросить состояние?

```javascript
// В store добавьте действие
reset: () => set({
  containers: [],
  loading: true,
  error: null,
  // ...начальное состояние
})

// Использование
const reset = useDockerStore(state => state.reset)
reset()
```

### Как сделать persist (сохранение в localStorage)?

```javascript
import { persist } from 'zustand/middleware'

const useDockerStore = create(
  persist(
    (set, get) => ({
      // ... ваш store
    }),
    {
      name: 'docker-storage',
      partialize: (state) => ({
        viewMode: state.viewMode, // Сохранять только viewMode
      })
    }
  )
)
```

### Можно ли использовать с TypeScript?

Да! Zustand отлично работает с TypeScript:

```typescript
interface DockerStore {
  containers: Container[]
  loading: boolean
  fetchContainers: () => Promise<void>
}

const useDockerStore = create<DockerStore>((set, get) => ({
  containers: [],
  loading: true,
  fetchContainers: async () => {
    // ...
  }
}))
```

## Полезные ссылки

- [Официальная документация Zustand](https://github.com/pmndrs/zustand)
- [Zustand API Reference](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [Zustand Best Practices](https://docs.pmnd.rs/zustand/guides/practice-with-no-store-actions)
- [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools)
- [Reselect (мемоизация селекторов)](https://github.com/reduxjs/reselect)

## Примеры из проекта

### Загрузка контейнеров с обработкой ошибок

```javascript
// В store
fetchContainers: async () => {
  try {
    set({ loading: true, error: null })
    const response = await axios.get('/api/containers')
    set({ containers: response.data, loading: false })
  } catch (err) {
    set({ 
      error: `Ошибка подключения к Docker API: ${err.message}`,
      loading: false 
    })
  }
}

// В компоненте
function App() {
  const { containers, loading, error, fetchContainers } = useDockerStore()
  
  useEffect(() => {
    fetchContainers()
    const interval = setInterval(fetchContainers, 5000)
    return () => clearInterval(interval)
  }, [fetchContainers])
}
```

### Выполнение действия с оптимистичным обновлением

```javascript
// В store
handleContainerAction: async (containerId, action) => {
  try {
    set({ error: null })
    await axios.post(`/api/containers/${containerId}/${action}`)
    
    // Обновить список после действия
    setTimeout(() => get().fetchContainers(), 1000)
  } catch (err) {
    set({ error: `Ошибка: ${err.message}` })
  }
}
```

### Работа с Set для отслеживания состояния

```javascript
// В store
executeScript: async (container, scriptName) => {
  const containerId = container.Id
  
  // Добавить в Set
  set(state => ({
    rebuildingContainers: new Set(state.rebuildingContainers).add(containerId)
  }))
  
  try {
    await axios.post('/api/scripts/execute', { scriptName })
  } finally {
    // Удалить из Set
    setTimeout(() => {
      set(state => {
        const newSet = new Set(state.rebuildingContainers)
        newSet.delete(containerId)
        return { rebuildingContainers: newSet }
      })
    }, 2000)
  }
}
```

---

**Последнее обновление**: 6 ноября 2025 г.  
**Версия Zustand**: 5.x  
**Версия React**: 19.2.0
