# Store Best Practices - Когда использовать Store vs useState

## 🎯 Золотое правило

> **Используйте Store для глобального состояния, useState для локального UI**

## 📋 Матрица принятия решений

### ✅ Должно быть в STORE:

| Критерий | Пример из проекта |
|----------|-------------------|
| Используется в 2+ компонентах | `containers`, `selectedContainer` |
| Данные от API/сервера | `containers`, `availableScripts` |
| Нужно переиспользовать | `viewMode`, `dockerApiUrl` |
| Бизнес-логика | `handleContainerAction`, `executeScript` |
| Состояние приложения | `loading`, `error` |
| Сохраняется при навигации | `viewMode` (сохраняется в localStorage) |

### ❌ Должно остаться в useState:

| Критерий | Пример из проекта |
|----------|-------------------|
| Локально для компонента | `page`, `rowsPerPage`, `searchQuery` |
| UI-интерактивность | `columnMenuAnchor` (открыто/закрыто меню) |
| Временные данные | `searchQuery` (поиск в конкретном списке) |
| Не влияет на другие компоненты | `visibleColumns` (настройки таблицы) |
| Сбрасывается при размонтировании | Состояние формы, временные фильтры |

## 🏗 Архитектура Store

### Один Store vs Множество Stores

#### ✅ ОДИН Store (Рекомендуется для малых/средних проектов)

**Преимущества:**
- Проще управление
- Легче отладка
- Один источник истины
- Меньше imports

**Когда использовать:**
- Проект малого/среднего размера (до 50 компонентов)
- Связанные данные (Docker контейнеры, логи, скрипты)
- Команда до 5 разработчиков

**Ваш случай:** ✅ **ОДИН Store идеален!**

```javascript
// ✅ ХОРОШО - Один store для Docker Manager
src/store/
  └── useDockerStore.js  // Все состояние Docker Manager
```

#### 🔀 Множество Stores (Для больших проектов)

**Когда использовать:**
- Проект большого размера (100+ компонентов)
- Несвязанные домены (User, Products, Settings, Chat)
- Большая команда (10+ разработчиков)
- Микрофронтенды

```javascript
// Для больших проектов
src/store/
  ├── useDockerStore.js      // Docker данные
  ├── useAuthStore.js        // Аутентификация
  ├── useSettingsStore.js    // Настройки
  └── useNotificationStore.js // Уведомления
```

## 📊 Примеры из вашего проекта

### ContainerList.jsx - Текущее состояние ✅ ПРАВИЛЬНО

```javascript
// ❌ НЕ НУЖНО переносить в Store:
const [page, setPage] = useState(0)              // Локальная пагинация
const [rowsPerPage, setRowsPerPage] = useState(30)
const [orderBy, setOrderBy] = useState('created')
const [order, setOrder] = useState('desc')
const [searchQuery, setSearchQuery] = useState('') // Локальный поиск
const [columnMenuAnchor, setColumnMenuAnchor] = useState(null) // UI меню
const [visibleColumns, setVisibleColumns] = useState({...}) // UI настройки

// ✅ ПРАВИЛЬНО - получаем из Store через props:
const { containers, onAction, onViewLogs, ... } = props
```

**Почему правильно:**
- Состояние используется **только в ContainerList**
- При размонтировании компонента состояние **не нужно**
- Другие компоненты **не зависят** от этого состояния

### App.jsx - ✅ ПРАВИЛЬНО использует Store

```javascript
// ✅ ПРАВИЛЬНО - в Store:
const {
  containers,           // Глобальные данные
  loading,              // Состояние приложения
  error,                // Состояние приложения
  fetchContainers,      // Бизнес-логика
  handleContainerAction // Бизнес-логика
} = useDockerStore()
```

## 🎨 Паттерны проектирования

### Паттерн 1: Container/Presentational

```javascript
// ✅ Smart Component (Container) - использует Store
function ContainerListContainer() {
  const { containers, loading, handleAction } = useDockerStore()
  
  return (
    <ContainerListView 
      containers={containers}
      loading={loading}
      onAction={handleAction}
    />
  )
}

// ✅ Presentational Component - локальный UI state
function ContainerListView({ containers, loading, onAction }) {
  const [searchQuery, setSearchQuery] = useState('') // Локальный поиск
  const [page, setPage] = useState(0) // Локальная пагинация
  
  const filtered = containers.filter(c => 
    c.name.includes(searchQuery)
  )
  
  return (
    <div>
      <SearchInput value={searchQuery} onChange={setSearchQuery} />
      <Table data={filtered} page={page} />
    </div>
  )
}
```

### Паттерн 2: Прямое использование Store (Ваш случай)

```javascript
// ✅ ТЕКУЩИЙ ПОДХОД - ОПТИМАЛЬНЫЙ
function ContainerList({ 
  containers,      // Из Store через props (от App)
  onAction,        // Из Store через props
  onViewLogs       // Из Store через props
}) {
  // Локальный UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  
  // Работа с данными из Store + локальное состояние
  const filtered = containers.filter(c => 
    c.name.includes(searchQuery)
  )
  
  return (...)
}
```

### Паттерн 3: Прямой доступ к Store (Альтернатива)

```javascript
// 🔀 АЛЬТЕРНАТИВА - если нужно в нескольких местах
function ContainerList() {
  // Получаем напрямую из Store
  const containers = useDockerStore(state => state.containers)
  const handleAction = useDockerStore(state => state.handleContainerAction)
  
  // Локальный UI state
  const [searchQuery, setSearchQuery] = useState('')
  
  return (...)
}
```

## 🚦 Когда НУЖНО мигрировать в Store

### Сценарий 1: Состояние используется в нескольких компонентах

```javascript
// ❌ ПЛОХО - searchQuery дублируется
function ContainerList() {
  const [searchQuery, setSearchQuery] = useState('')
}

function ContainerHeader() {
  const [searchQuery, setSearchQuery] = useState('') // Дубликат!
}

// ✅ ХОРОШО - в Store
const useDockerStore = create((set) => ({
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query })
}))
```

### Сценарий 2: Нужно сохранить при навигации

```javascript
// ❌ ПЛОХО - при размонтировании теряется
function Settings() {
  const [theme, setTheme] = useState('dark')
}

// ✅ ХОРОШО - сохраняется в Store + localStorage
const useSettingsStore = create(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme })
    }),
    { name: 'settings' }
  )
)
```

### Сценарий 3: Бизнес-логика

```javascript
// ❌ ПЛОХО - логика в компоненте
function ContainerCard({ container }) {
  const handleRebuild = async () => {
    // Сложная бизнес-логика
    await api.stopContainer()
    await api.rebuild()
    await api.startContainer()
  }
}

// ✅ ХОРОШО - логика в Store
const useDockerStore = create((set) => ({
  rebuildContainer: async (id) => {
    // Вся логика централизована
  }
}))
```

## 📏 Правила для вашего проекта

### Текущая архитектура ✅ ОПТИМАЛЬНА:

```
useDockerStore (ОДИН Store)
│
├── Глобальное состояние:
│   ├── containers
│   ├── loading
│   ├── error
│   ├── selectedContainer
│   ├── availableScripts
│   └── viewMode
│
├── Бизнес-логика:
│   ├── fetchContainers()
│   ├── handleContainerAction()
│   └── executeScript()
│
└── Используется в:
    ├── App.jsx
    ├── (через props в дочерних компонентах)
    └── (можно добавить прямой доступ где нужно)

Локальный useState в компонентах:
├── ContainerList.jsx
│   ├── page, rowsPerPage (пагинация)
│   ├── searchQuery (поиск)
│   └── visibleColumns (UI)
├── ContainerLogs.jsx
│   └── (UI состояния модалки)
└── ContainerInfo.jsx
    └── (UI состояния модалки)
```

## 🎯 Рекомендации для вашего проекта

### ✅ Оставьте как есть:

1. **Один useDockerStore** - достаточно для вашего проекта
2. **useState в ContainerList** - правильно для локального UI
3. **Props drilling от App** - нормально для небольшого проекта

### 🔄 Опциональные улучшения:

#### Вариант 1: Прямой доступ где нужно (рекомендуется)

```javascript
// ContainerList.jsx - можно упростить
function ContainerList() {
  // Прямой доступ к Store
  const containers = useDockerStore(s => s.containers)
  const handleAction = useDockerStore(s => s.handleContainerAction)
  const rebuildingContainers = useDockerStore(s => s.rebuildingContainers)
  
  // Локальный UI state остаётся
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  
  // Теперь не нужны props!
}

// App.jsx упрощается
function App() {
  // Только для UI App.jsx
  return <ContainerList /> // Без props!
}
```

#### Вариант 2: Сохранение настроек таблицы

```javascript
// Если хотите сохранять настройки между сессиями
const useDockerStore = create(
  persist(
    (set) => ({
      // ... остальное состояние
      
      // UI настройки, которые нужно сохранять
      tableSettings: {
        visibleColumns: { name: true, status: true, ... },
        rowsPerPage: 30,
      },
      setTableSettings: (settings) => set({ tableSettings: settings })
    }),
    {
      name: 'docker-store',
      partialize: (state) => ({
        viewMode: state.viewMode,
        tableSettings: state.tableSettings // Сохранять настройки таблицы
      })
    }
  )
)
```

## 🎓 Общие Best Practices

### 1. Селекторы для производительности

```javascript
// ✅ ХОРОШО - ре-рендер только при изменении containers
const containers = useDockerStore(s => s.containers)

// ❌ ПЛОХО - ре-рендер при любом изменении Store
const store = useDockerStore()
```

### 2. Не дублируйте состояние

```javascript
// ❌ ПЛОХО
function MyComponent() {
  const containers = useDockerStore(s => s.containers)
  const [localContainers, setLocal] = useState(containers) // Дубликат!
}

// ✅ ХОРОШО
function MyComponent() {
  const containers = useDockerStore(s => s.containers)
  // Работаем напрямую с containers
}
```

### 3. Вычисляемые значения в селекторе

```javascript
// ✅ ХОРОШО - вычисление в селекторе
const runningCount = useDockerStore(s => 
  s.containers.filter(c => c.State === 'running').length
)

// ❌ ПЛОХО - дублирование логики
const containers = useDockerStore(s => s.containers)
const runningCount = containers.filter(c => c.State === 'running').length
```

## 📊 Сравнительная таблица

| Состояние | useState | Zustand Store | Рекомендация для проекта |
|-----------|----------|---------------|--------------------------|
| `containers` | ❌ | ✅ | Store (используется глобально) |
| `loading` | ❌ | ✅ | Store (состояние приложения) |
| `error` | ❌ | ✅ | Store (состояние приложения) |
| `viewMode` | ❌ | ✅ | Store (сохраняется, глобально) |
| `page` | ✅ | ❌ | useState (локальная пагинация) |
| `searchQuery` | ✅ | ❌ | useState (локальный поиск) |
| `visibleColumns` | ✅ | 🟡 | useState (или Store если нужно сохранять) |
| `columnMenuAnchor` | ✅ | ❌ | useState (временное UI состояние) |

**Легенда:**
- ✅ Рекомендуется
- ❌ Не рекомендуется
- 🟡 Зависит от требований

## 🎉 Выводы

### Для вашего проекта Docker Manager:

1. ✅ **Один Store** - оптимальное решение
2. ✅ **useState в ContainerList** - правильно
3. ✅ **Текущая архитектура** - хорошо спроектирована
4. 🔄 **Можно улучшить** - добавить прямой доступ к Store в компонентах (опционально)

### Когда расширять:

- Если добавите аутентификацию → создайте `useAuthStore`
- Если добавите настройки → создайте `useSettingsStore`
- Если проект вырастет > 50 компонентов → разделите на домены

---

**Ваша текущая архитектура - отличный пример правильного использования Zustand!** 🎯

*Документ создан: 7 ноября 2025 г.*
