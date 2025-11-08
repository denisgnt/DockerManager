import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import axios from 'axios'

/**
 * Docker Manager Global Store
 * 
 * Централизованное хранилище состояния приложения Docker Manager.
 * Использует Zustand для простого и эффективного управления состоянием.
 * 
 * @see {@link /ZUSTAND_STORE.md} - Подробная документация по использованию
 */
const useDockerStore = create(
  devtools(
    (set, get) => ({
      // ==================== STATE ====================
      
      /** @type {Array} Список Docker-контейнеров */
      containers: [],
      
      /** @type {Object|null} Выбранный контейнер для просмотра логов */
      selectedContainer: null,
      
      /** @type {Object|null} Выбранный контейнер для просмотра информации */
      selectedContainerInfo: null,
      
      /** @type {Object|null} Выбранный контейнер для просмотра телеметрии */
      selectedContainerStats: null,
      
      /** @type {boolean} Индикатор загрузки списка контейнеров */
      loading: true,
      
      /** @type {string|null} Сообщение об ошибке */
      error: null,
      
      /** @type {Object} Доступные скрипты для контейнеров */
      availableScripts: {},
      
      /** @type {Object} Состояние snackbar уведомлений */
      snackbar: { open: false, message: '' },
      
      /** @type {Object} Состояние окна вывода скриптов */
      scriptOutput: { open: false, data: null },
      
      /** @type {string} Режим отображения: 'list' или 'grid' */
      viewMode: localStorage.getItem('dockerManagerViewMode') || 'list',
      
      /** @type {string} URL Docker API */
      dockerApiUrl: `${import.meta.env.VITE_DOCKER_API_HOST || '10.174.18.242'}:${import.meta.env.VITE_DOCKER_API_PORT || '2375'}`,

      // ==================== ACTIONS ====================

      /**
       * Загрузка списка контейнеров
       */
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
          console.error('Error fetching containers:', err)
        }
      },

      /**
       * Загрузка списка доступных скриптов
       */
      fetchScripts: async () => {
        try {
          const response = await axios.get('/api/scripts')
          set({ availableScripts: response.data })
        } catch (err) {
          console.error('Error fetching scripts:', err)
        }
      },

      /**
       * Выполнение действия над контейнером (start, stop, restart, remove)
       * @param {string} containerId - ID контейнера
       * @param {string} action - Действие: 'start' | 'stop' | 'restart' | 'remove'
       */
      handleContainerAction: async (containerId, action) => {
        try {
          set({ error: null })
          let response

          switch (action) {
            case 'start':
              response = await axios.post(`/api/containers/${containerId}/start`)
              break
            case 'stop':
              response = await axios.post(`/api/containers/${containerId}/stop`)
              break
            case 'restart':
              response = await axios.post(`/api/containers/${containerId}/restart`)
              break
            case 'remove':
              response = await axios.delete(`/api/containers/${containerId}`)
              const { selectedContainer } = get()
              if (selectedContainer?.Id === containerId) {
                set({ selectedContainer: null })
              }
              break
            default:
              break
          }

          // Обновить список контейнеров после действия
          setTimeout(() => get().fetchContainers(), 1000)
        } catch (err) {
          set({ error: `Ошибка при выполнении операции: ${err.message}` })
          console.error('Error performing container action:', err)
        }
      },

      /**
       * Выполнение скрипта для контейнера
       * @param {Object} container - Объект контейнера
       * @param {string} scriptName - Имя скрипта для выполнения
       */
      executeScript: async (container, scriptName) => {
        const containerId = container.Id
        const containerName = container.Names[0].replace(/^\//, '')

        try {
          set({ error: null })

          const response = await axios.post('/api/scripts/execute', {
            scriptName,
            containerName,
            containerId
          })

          if (response.data.success) {
            set({
              snackbar: {
                open: true,
                message: `Скрипт успешно выполнен для ${containerName}`
              },
              scriptOutput: {
                open: true,
                data: {
                  containerName,
                  output: response.data.output || '',
                  exitCode: response.data.exitCode
                }
              }
            })

            // Обновить список контейнеров
            setTimeout(() => get().fetchContainers(), 1000)
          }
        } catch (err) {
          const errorMsg = err.response?.data?.error || err.message
          const output = err.response?.data?.output || ''

          set({ error: `Ошибка выполнения скрипта: ${errorMsg}` })

          // Показать вывод ошибки если доступен
          if (output) {
            set({
              scriptOutput: {
                open: true,
                data: {
                  containerName,
                  output,
                  exitCode: err.response?.data?.exitCode
                }
              }
            })
          }

          console.error('Error executing script:', err)
        }
      },

      /**
       * Установить выбранный контейнер для просмотра логов
       * @param {Object|null} container - Объект контейнера или null
       */
      setSelectedContainer: (container) => {
        set({ selectedContainer: container })
      },

      /**
       * Установить выбранный контейнер для просмотра информации
       * @param {Object|null} container - Объект контейнера или null
       */
      setSelectedContainerInfo: (container) => {
        set({ selectedContainerInfo: container })
      },

      /**
       * Установить выбранный контейнер для просмотра телеметрии
       * @param {Object|null} container - Объект контейнера или null
       */
      setSelectedContainerStats: (container) => {
        set({ selectedContainerStats: container })
      },

      /**
       * Установить сообщение об ошибке
       * @param {string|null} error - Сообщение об ошибке
       */
      setError: (error) => {
        set({ error })
      },

      /**
       * Закрыть snackbar уведомление
       */
      closeSnackbar: () => {
        set({ snackbar: { open: false, message: '' } })
      },

      /**
       * Закрыть окно вывода скрипта
       */
      closeScriptOutput: () => {
        set({ scriptOutput: { open: false, data: null } })
      },

      /**
       * Изменить режим отображения
       * @param {string} mode - Режим: 'list' или 'grid'
       */
      setViewMode: (mode) => {
        set({ viewMode: mode })
        localStorage.setItem('dockerManagerViewMode', mode)
      },
    }),
    {
      name: 'docker-store', // Имя для Redux DevTools
      enabled: import.meta.env.DEV, // Включить devtools только в dev-режиме
    }
  )
)

export default useDockerStore
