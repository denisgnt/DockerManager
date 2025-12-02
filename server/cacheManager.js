import NodeCache from 'node-cache';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Пути для персистентного хранения
const CONTAINERS_CACHE_FILE = path.join(__dirname, '../data/cache/containers.json');
const NODE_POSITIONS_FILE = path.join(__dirname, '../data/cache/node-positions.json');

// Создание директорий для кеша
const ensureCacheDir = async () => {
  const cacheDir = path.join(__dirname, '../data/cache');
  try {
    await mkdir(cacheDir, { recursive: true });
  } catch (err) {
    // Директория уже существует
  }
};

// Инициализация кеша
await ensureCacheDir();

// In-memory кеш для containers (TTL = 0 означает бессрочное хранение)
const containersCache = new NodeCache({ 
  stdTTL: 0, 
  checkperiod: 0,
  useClones: false // Для производительности, но нужно быть осторожным с мутациями
});

// In-memory кеш для node positions
const nodePositionsCache = new NodeCache({ 
  stdTTL: 0, 
  checkperiod: 0,
  useClones: false
});

// Загрузка данных из файлов при старте
const loadFromFile = async (filePath, cache, key) => {
  try {
    const data = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    cache.set(key, parsed);
    console.log(`Loaded ${key} from file into memory cache`);
    return parsed;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Error loading ${key} from file:`, err.message);
    }
    return null;
  }
};

// Сохранение данных в файл
const saveToFile = async (filePath, data) => {
  try {
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error saving to file ${filePath}:`, err.message);
    throw err;
  }
};

// Инициализация: загрузка существующих данных
await loadFromFile(CONTAINERS_CACHE_FILE, containersCache, 'containers-list');
await loadFromFile(NODE_POSITIONS_FILE, nodePositionsCache, 'node-positions');

/**
 * Containers cache manager
 */
export const ContainersCacheManager = {
  /**
   * Получить все контейнеры из кеша
   */
  async getAll() {
    const cached = containersCache.get('containers-list');
    return cached || [];
  },

  /**
   * Сохранить контейнеры в кеш (мердж с существующими)
   */
  async saveContainers(containers) {
    try {
      // Загрузить существующий кеш
      let existingCache = await this.getAll();
      
      // Создать мапу существующих контейнеров по имени
      const existingMap = new Map();
      existingCache.forEach(container => {
        const name = container.Names?.[0]?.replace(/^\//, '') || container.Id;
        existingMap.set(name, container);
      });
      
      // Мердж новых контейнеров с существующим кешем
      containers.forEach(container => {
        const name = container.Names?.[0]?.replace(/^\//, '') || container.Id;
        existingMap.set(name, container);
      });
      
      // Конвертировать мапу обратно в массив
      const mergedCache = Array.from(existingMap.values());
      
      // Сохранить в memory cache
      containersCache.set('containers-list', mergedCache);
      
      // Сохранить в файл для персистентности
      await saveToFile(CONTAINERS_CACHE_FILE, mergedCache);
      
      console.log(`Cached ${mergedCache.length} containers (${containers.length} new/updated)`);
      return mergedCache;
    } catch (error) {
      console.error('Failed to save containers cache:', error.message);
      throw error;
    }
  },

  /**
   * Очистить весь кеш контейнеров
   */
  async clear() {
    containersCache.del('containers-list');
    await saveToFile(CONTAINERS_CACHE_FILE, []);
    console.log('Containers cache cleared');
  }
};

/**
 * Node positions cache manager
 */
export const NodePositionsCacheManager = {
  /**
   * Получить позиции узлов из кеша
   */
  async getPositions() {
    const positions = nodePositionsCache.get('node-positions');
    return positions || {};
  },

  /**
   * Сохранить позиции узлов в кеш
   */
  async savePositions(positions) {
    try {
      // Сохранить в memory cache
      nodePositionsCache.set('node-positions', positions);
      
      // Сохранить в файл для персистентности
      await saveToFile(NODE_POSITIONS_FILE, positions);
      
      console.log('Node positions saved to cache');
      return { success: true, message: 'Positions saved' };
    } catch (error) {
      console.error('Failed to save node positions:', error.message);
      throw error;
    }
  },

  /**
   * Удалить позиции узлов (сброс раскладки)
   */
  async reset() {
    try {
      // Удалить из memory cache
      nodePositionsCache.del('node-positions');
      
      // Сохранить пустой объект в файл
      await saveToFile(NODE_POSITIONS_FILE, {});
      
      console.log('Node positions cache reset');
      return { success: true, message: 'Positions reset' };
    } catch (error) {
      console.error('Failed to reset node positions:', error.message);
      throw error;
    }
  }
};

export default {
  containers: ContainersCacheManager,
  nodePositions: NodePositionsCacheManager
};
