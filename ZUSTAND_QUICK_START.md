# Быстрый старт: Zustand Store

## Установка

```bash
npm install zustand --legacy-peer-deps
```

## Создание Store

```javascript
// src/store/useDockerStore.js
import { create } from 'zustand'

const useDockerStore = create((set) => ({
  // Состояние
  containers: [],
  loading: false,
  
  // Действия
  setContainers: (containers) => set({ containers }),
  setLoading: (loading) => set({ loading }),
}))

export default useDockerStore
```

## Использование в компонентах

### 1. Получить состояние

```javascript
import useDockerStore from './store/useDockerStore'

function MyComponent() {
  const containers = useDockerStore(state => state.containers)
  
  return <div>{containers.length} контейнеров</div>
}
```

### 2. Вызвать действие

```javascript
function RefreshButton() {
  const setLoading = useDockerStore(state => state.setLoading)
  
  return <button onClick={() => setLoading(true)}>Загрузить</button>
}
```

### 3. Получить несколько значений

```javascript
function Dashboard() {
  const { containers, loading } = useDockerStore(state => ({
    containers: state.containers,
    loading: state.loading,
  }))
  
  if (loading) return <Spinner />
  return <ContainerList containers={containers} />
}
```

## Асинхронные действия

```javascript
const useDockerStore = create((set) => ({
  containers: [],
  loading: false,
  
  fetchContainers: async () => {
    set({ loading: true })
    const response = await fetch('/api/containers')
    const data = await response.json()
    set({ containers: data, loading: false })
  },
}))
```

## DevTools

```javascript
import { devtools } from 'zustand/middleware'

const useDockerStore = create(
  devtools(
    (set) => ({
      // ... ваш store
    }),
    { name: 'docker-store' }
  )
)
```

## Полная документация

См. [ZUSTAND_STORE.md](./ZUSTAND_STORE.md) для подробной информации.

## Ключевые правила

✅ **DO**: Используйте селекторы для оптимизации  
✅ **DO**: Группируйте связанные данные  
✅ **DO**: Храните бизнес-логику в store  

❌ **DON'T**: Не получайте весь store без селектора  
❌ **DON'T**: Не мутируйте состояние напрямую  
❌ **DON'T**: Не дублируйте состояние в useState
