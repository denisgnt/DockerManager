import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Chip,
  Stack,
  useTheme,
  useMediaQuery,
  Button,
  TextField,
  InputAdornment
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import InfoIcon from '@mui/icons-material/Info';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import axios from 'axios';

// Custom node component
const CustomNode = ({ data }) => {
  const theme = useTheme();
  const isRunning = data.state === 'running';
  const isExited = data.state === 'exited';
  const isSelected = data.isSelected;
  const isHighlighted = data.isHighlighted;
  const isIncoming = data.isIncoming; // Входящие связи (другие зависят от этого)
  const isOutgoing = data.isOutgoing; // Исходящие связи (этот зависит от других)
  const hasBrokenDependency = data.hasBrokenDependency;
  const isSearchMatch = data.isSearchMatch; // Найден в поиске
  
  // Определяем цвет фона
  let backgroundColor;
  let textColor;
  let borderColor;
  let borderWidth = 2;
  
  if (isSelected) {
    // Выбранный блок - светло-зеленый фон
    backgroundColor = theme.palette.mode === 'dark' ? '#65cc6aff' : '#81c784';
    textColor = '#000';
    borderColor = theme.palette.mode === 'dark' ? '#388e3c' : '#2e7d32';
  } else if (isIncoming) {
    // Входящие блоки - синий фон
    backgroundColor = theme.palette.mode === 'dark' ? '#1976d2' : '#2196f3';
    textColor = '#fff';
    borderColor = theme.palette.mode === 'dark' ? '#1565c0' : '#1976d2';
  } else if (isOutgoing) {
    // Исходящие блоки - оранжевый фон
    backgroundColor = theme.palette.mode === 'dark' ? '#f57c00' : '#ff9800';
    textColor = '#fff';
    borderColor = theme.palette.mode === 'dark' ? '#e65100' : '#f57c00';
  } else {
    // Обычные блоки
    backgroundColor = theme.palette.mode === 'dark' ? 'grey.900' : 'background.paper';
    textColor = theme.palette.text.primary;
    borderColor = hasBrokenDependency
      ? (theme.palette.mode === 'dark' ? '#f44336' : '#d32f2f')
      : isRunning ? 'success.main' : 'error.main';
  }
  
  // Если найден в поиске - желтая рамка
  if (isSearchMatch) {
    borderColor = theme.palette.mode === 'dark' ? '#fdd835' : '#fbc02d';
    borderWidth = 6;
  }
  
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Card
        sx={{
          minWidth: 200,
          border: borderWidth,
          borderColor: borderColor,
          boxShadow: isSelected ? 8 : isIncoming || isOutgoing ? 4 : isSearchMatch ? 6 : 3,
          backgroundColor: backgroundColor,
          transform: isSelected ? 'scale(1.05)' : isSearchMatch ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 0.2s ease-in-out',
          cursor: 'pointer',
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ color: textColor }}>
              {data.label}
            </Typography>
            <Chip
              label={data.state}
              size="small"
              color={isRunning ? 'success' : 'error'}
              sx={{ width: 'fit-content' }}
            />
            {data.dependencies && data.dependencies.length > 0 && (
              <Tooltip
                title={
                  <Box>
                    <Typography variant="caption" fontWeight="bold">
                      Dependencies:
                    </Typography>
                    {data.dependencies.map((dep, idx) => (
                      <Typography key={idx} variant="caption" display="block">
                        {dep.envVar}: {dep.target}
                      </Typography>
                    ))}
                  </Box>
                }
              >
                <Chip
                  icon={<InfoIcon />}
                  label={`${data.dependencies.length} deps`}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    width: 'fit-content',
                    color: textColor,
                    borderColor: textColor
                  }}
                />
              </Tooltip>
            )}
          </Stack>
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export default function DependencyGraph({ searchQuery = '', onSearchChange, mode, refreshTrigger = 0 }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [allDependencies, setAllDependencies] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Save node positions when they change
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    
    // Check if any node was dragged (position changed)
    const positionChange = changes.find(change => 
      change.type === 'position' && change.dragging === false && change.position
    );
    
    if (positionChange) {
      // Save positions after drag ends
      setNodes(currentNodes => {
        const positions = {};
        currentNodes.forEach(node => {
          // Сохраняем по имени контейнера (node.data.label) вместо ID
          positions[node.data.label] = node.position;
        });
        
        // Save to backend
        axios.post(`/api/graph/positions`, positions)
          .catch(err => console.error('Failed to save positions:', err));
        
        return currentNodes;
      });
    }
  }, [onNodesChange, setNodes]);

  const fetchDependencies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/containers/dependencies`);
      const dependencies = response.data;
      setAllDependencies(dependencies);

      // Load saved positions
      let savedPositions = {};
      try {
        const positionsResponse = await axios.get(`/api/graph/positions`);
        savedPositions = positionsResponse.data;
      } catch (err) {
        console.log('No saved positions found, using default layout');
      }

      // Create a map of all containers
      const containerMap = new Map();
      dependencies.forEach(container => {
        containerMap.set(container.name, container);
      });

      // Find containers with broken dependencies (depending on exited containers)
      const containersBrokenDeps = new Set();
      dependencies.forEach(container => {
        let hasBrokenDep = false;
        container.dependencies.forEach(dep => {
          const targetContainer = containerMap.get(dep.target);
          if (targetContainer && targetContainer.state === 'exited') {
            hasBrokenDep = true;
          }
        });
        if (hasBrokenDep) {
          containersBrokenDeps.add(container.id);
        }
      });

      // Create nodes
      const nodePositions = calculateNodePositions(dependencies);
      const newNodes = dependencies.map((container, index) => ({
        id: container.id,
        type: 'custom',
        // Используем имя контейнера для загрузки сохранённой позиции
        position: savedPositions[container.name] || nodePositions[container.name] || { x: 250, y: index * 150 },
        data: {
          label: container.name,
          state: container.state,
          status: container.status,
          dependencies: container.dependencies,
          isSelected: false,
          isHighlighted: false,
          hasBrokenDependency: containersBrokenDeps.has(container.id),
          isSearchMatch: false,
        },
      }));

      // Create edges based on dependencies
      const newEdges = [];
      dependencies.forEach(container => {
        container.dependencies.forEach(dep => {
          // Find the target container
          const targetContainer = dependencies.find(c => c.name === dep.target);
          if (targetContainer) {
            // Check if both containers have broken states (exited or broken dependencies)
            const sourceIsBroken = container.state === 'exited' || containersBrokenDeps.has(container.id);
            const targetIsBroken = targetContainer.state === 'exited' || containersBrokenDeps.has(targetContainer.id);
            const bothBroken = sourceIsBroken && targetIsBroken;
            
            newEdges.push({
              id: `${container.id}-${targetContainer.id}-${dep.envVar}`,
              source: container.id,
              target: targetContainer.id,
              label: dep.envVar.replace(/^(ENDPOINT_MODULE_|URI_|VITE_URI_)/, ''),
              type: 'smoothstep',
              animated: false,
              hidden: true, // Скрыть все линии по умолчанию
              pathOptions: { 
                offset: 25,
                borderRadius: 50
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: bothBroken 
                  ? (theme.palette.mode === 'dark' ? '#f44336' : '#d32f2f')
                  : (theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2'),
              },
              style: {
                stroke: bothBroken
                  ? (theme.palette.mode === 'dark' ? '#f44336' : '#d32f2f')
                  : (theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2'),
                strokeWidth: 2,
              },
              labelStyle: {
                fontSize: 10,
                fill: theme.palette.text.primary,
              },
              labelBgStyle: {
                fill: theme.palette.background.paper,
                fillOpacity: 0.8,
              },
            });
          } else {
            console.log(`Target not found: ${dep.target} for ${container.name}`, dep);
          }
        });
      });

      console.log(`Created ${newEdges.length} edges from ${dependencies.length} containers`);

      setNodes(newNodes);
      setEdges(newEdges);
    } catch (err) {
      console.error('Error fetching dependencies:', err);
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Не удается подключиться к серверу. Проверьте, что сервер запущен и доступен.');
      } else if (err.response) {
        setError(`Ошибка сервера: ${err.response.status} - ${err.response.data?.error || err.message}`);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

  // Обновление зависимостей при изменении refreshTrigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('Refreshing dependencies graph...');
      fetchDependencies();
    }
  }, [refreshTrigger, fetchDependencies]);

  // Load saved viewport from localStorage on mount
  useEffect(() => {
    if (reactFlowInstance && !isInitialized) {
      try {
        const savedViewport = localStorage.getItem('dependency-graph-viewport');
        if (savedViewport) {
          const viewport = JSON.parse(savedViewport);
          reactFlowInstance.setViewport(viewport);
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('Failed to load viewport:', err);
      }
    }
  }, [reactFlowInstance, isInitialized]);

  // Auto-fit view after graph is loaded and ReactFlow is initialized (only if no saved viewport)
  useEffect(() => {
    if (reactFlowInstance && nodes.length > 0 && !loading && !isInitialized) {
      const savedViewport = localStorage.getItem('dependency-graph-viewport');
      if (!savedViewport) {
        // Используем requestAnimationFrame для применения fitView сразу после рендера
        requestAnimationFrame(() => {
          reactFlowInstance.fitView({ padding: 0.15, duration: 0 });
        });
      }
      setIsInitialized(true);
    }
  }, [reactFlowInstance, nodes.length, loading, isInitialized]);

  const calculateNodePositions = useCallback((dependencies) => {
    const positions = {};
    const columnWidth = 650; // Ширина столбца (увеличено с 500)
    const rowHeight = 280; // Высота строки (увеличено с 220)
    const maxPerColumn = 8; // Максимум контейнеров в одном столбце
    
    // Построить граф зависимостей
    const depGraph = new Map();
    const reverseDeps = new Map();
    
    dependencies.forEach(container => {
      depGraph.set(container.name, []);
      reverseDeps.set(container.name, []);
    });
    
    dependencies.forEach(container => {
      container.dependencies.forEach(dep => {
        if (depGraph.has(dep.target)) {
          // container зависит от dep.target
          depGraph.get(container.name).push(dep.target);
          reverseDeps.get(dep.target).push(container.name);
        }
      });
    });
    
    // Найти контейнеры без зависимостей (корневые узлы)
    const levels = new Map();
    const processed = new Set();
    
    // BFS для определения уровней
    const queue = [];
    dependencies.forEach(container => {
      if (depGraph.get(container.name).length === 0) {
        queue.push(container.name);
        levels.set(container.name, 0);
        processed.add(container.name);
      }
    });
    
    // Обработка очереди
    while (queue.length > 0) {
      const current = queue.shift();
      const currentLevel = levels.get(current);
      
      // Найти все контейнеры, которые зависят от текущего
      const dependents = reverseDeps.get(current) || [];
      dependents.forEach(dependent => {
        if (!processed.has(dependent)) {
          // Проверить, все ли зависимости уже обработаны
          const allDepsProcessed = depGraph.get(dependent).every(dep => processed.has(dep));
          if (allDepsProcessed) {
            const maxDepLevel = Math.max(...depGraph.get(dependent).map(dep => levels.get(dep) || 0));
            levels.set(dependent, maxDepLevel + 1);
            processed.add(dependent);
            queue.push(dependent);
          }
        }
      });
    }
    
    // Обработать необработанные узлы (циклические зависимости)
    dependencies.forEach(container => {
      if (!levels.has(container.name)) {
        levels.set(container.name, 0);
      }
    });
    
    // Сгруппировать по уровням
    const levelGroups = new Map();
    levels.forEach((level, name) => {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level).push(name);
    });
    
    // Отсортировать уровни
    const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
    
    // Расположить узлы в столбцы
    sortedLevels.forEach(level => {
      const nodes = levelGroups.get(level);
      
      nodes.forEach((name, index) => {
        const column = level;
        const row = index;
        
        positions[name] = {
          x: column * columnWidth,
          y: row * rowHeight,
        };
      });
    });
    
    return positions;
  }, []);

  const handleZoomIn = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomIn({ duration: 400 });
    }
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomOut({ duration: 400 });
    }
  }, [reactFlowInstance]);

  // Search functionality
  useEffect(() => {
    if (!localSearchQuery.trim()) {
      // Clear all search highlights
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: { ...node.data, isSearchMatch: false },
        }))
      );
      return;
    }

    const query = localSearchQuery.toLowerCase();
    setNodes((nds) =>
      nds.map((node) => {
        const label = node.data.label?.toLowerCase() || '';
        const state = node.data.state?.toLowerCase() || '';
        const status = node.data.status?.toLowerCase() || '';
        
        const isMatch = label.includes(query) || state.includes(query) || status.includes(query);
        
        return {
          ...node,
          data: { ...node.data, isSearchMatch: isMatch },
        };
      })
    );
  }, [localSearchQuery, setNodes]);

  const handleResetLayout = useCallback(async () => {
    try {
      await axios.delete(`/api/graph/positions`);
      // Reload dependencies with default positions
      await fetchDependencies();
    } catch (err) {
      console.error('Failed to reset layout:', err);
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Не удается подключиться к серверу при сбросе схемы.');
      } else if (err.response) {
        setError(`Ошибка при сбросе: ${err.response.data?.error || err.message}`);
      } else {
        setError('Ошибка при сбросе схемы: ' + err.message);
      }
    }
  }, [fetchDependencies]);

  // Save viewport (zoom and position) to localStorage
  const handleMoveEnd = useCallback((event, viewport) => {
    try {
      localStorage.setItem('dependency-graph-viewport', JSON.stringify(viewport));
    } catch (err) {
      console.error('Failed to save viewport:', err);
    }
  }, []);

  const handleNodeClick = useCallback((event, node) => {
    const nodeId = node.id;
    
    // Переключаем выделение
    if (selectedNodeId === nodeId) {
      // Снять выделение
      setSelectedNodeId(null);
      
      // Сбросить подсветку у всех узлов и рёбер
      setNodes(nds => nds.map(n => ({
        ...n,
        data: { ...n.data, isSelected: false, isHighlighted: false, isIncoming: false, isOutgoing: false }
      })));
      
      // Скрыть все линии
      setEdges(eds => eds.map(e => ({
        ...e,
        hidden: true,
        animated: false,
      })));
    } else {
      // Выделить узел
      setSelectedNodeId(nodeId);
      
      // Найти все зависимости выбранного контейнера
      const selectedContainer = allDependencies.find(c => c.id === nodeId);
      const dependencyTargets = new Set(); // Исходящие блоки (от кого зависит выбранный)
      const dependentSources = new Set(); // Входящие блоки (кто зависит от выбранного)
      const outgoingEdges = new Set(); // Исходящие связи (зависимости выбранного блока)
      const incomingEdges = new Set(); // Входящие связи (кто зависит от выбранного блока)
      
      if (selectedContainer) {
        // Исходящие: выбранный блок зависит от других
        selectedContainer.dependencies.forEach(dep => {
          const targetContainer = allDependencies.find(c => c.name === dep.target);
          if (targetContainer) {
            dependencyTargets.add(targetContainer.id);
            const edgeId = `${nodeId}-${targetContainer.id}-${dep.envVar}`;
            outgoingEdges.add(edgeId);
          }
        });
      }
      
      // Входящие: другие блоки зависят от выбранного
      allDependencies.forEach(container => {
        if (container.id !== nodeId) {
          container.dependencies.forEach(dep => {
            const targetContainer = allDependencies.find(c => c.name === dep.target);
            if (targetContainer && targetContainer.id === nodeId) {
              dependentSources.add(container.id);
              const edgeId = `${container.id}-${nodeId}-${dep.envVar}`;
              incomingEdges.add(edgeId);
            }
          });
        }
      });
      
      // Обновить узлы
      setNodes(nds => nds.map(n => ({
        ...n,
        data: {
          ...n.data,
          isSelected: n.id === nodeId,
          isOutgoing: dependencyTargets.has(n.id), // Оранжевый фон
          isIncoming: dependentSources.has(n.id), // Синий фон
          isHighlighted: false,
        }
      })));
      
      // Обновить рёбра - показать только линии связанные с выбранным блоком
      setEdges(eds => eds.map(e => {
        const isOutgoing = outgoingEdges.has(e.id);
        const isIncoming = incomingEdges.has(e.id);
        
        // Check if selected container is exited
        const selectedIsExited = selectedContainer && selectedContainer.state === 'exited';
        
        return {
          ...e,
          hidden: !isOutgoing && !isIncoming, // Показать только линии связанные с выбранным блоком
          animated: isOutgoing || isIncoming,
          style: {
            ...e.style,
            strokeWidth: isOutgoing ? 8 : (isIncoming ? 8 : 2),
            stroke: isOutgoing 
              ? (theme.palette.mode === 'dark' ? '#f57c00' : '#ff9800') // Оранжевый для исходящих
              : isIncoming
                ? (theme.palette.mode === 'dark' ? '#1976d2' : '#2196f3') // Синий для входящих
                : (theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2'), // Синий по умолчанию
          },
          markerEnd: {
            ...e.markerEnd,
            color: isOutgoing 
              ? (theme.palette.mode === 'dark' ? '#f57c00' : '#ff9800')
              : isIncoming
                ? (theme.palette.mode === 'dark' ? '#1976d2' : '#2196f3')
                : (theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2'),
          }
        };
      }));
    }
  }, [selectedNodeId, allDependencies, setNodes, setEdges, theme.palette.mode]);

  const handlePaneClick = useCallback(() => {
    if (selectedNodeId) {
      // Снять выделение при клике на пустое место
      setSelectedNodeId(null);
      
      // Сбросить подсветку у всех узлов и рёбер
      setNodes(nds => nds.map(n => ({
        ...n,
        data: { ...n.data, isSelected: false, isHighlighted: false, isIncoming: false, isOutgoing: false }
      })));
      
      // Скрыть все линии
      setEdges(eds => eds.map(e => ({
        ...e,
        hidden: true,
        animated: false,
      })));
    }
  }, [selectedNodeId, allDependencies, setNodes, setEdges, theme.palette.mode]);

  const miniMapStyle = useMemo(
    () => ({
      backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f5f5f5',
    }),
    [theme.palette.mode]
  );

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', width: '100%', position: 'relative' }}>
      {/* Легенда */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 1000,
          p: 1.5,
          backgroundColor: mode === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          minWidth: 200,
        }}
      >
        <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 1, color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)' }}>
          Легенда
        </Typography>
        <Stack spacing={0.5}>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 16, height: 16, bgcolor: mode === 'dark' ? '#65cc6aff' : '#81c784', border: '2px solid #388e3c', borderRadius: 0.5 }} />
            <Typography variant="caption" sx={{ color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)' }}>Выбранный контейнер</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 16, height: 16, bgcolor: mode === 'dark' ? '#1976d2' : '#2196f3', border: '2px solid #1565c0', borderRadius: 0.5 }} />
            <Typography variant="caption" sx={{ color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)' }}>Входящие (кто зависит)</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 16, height: 16, bgcolor: mode === 'dark' ? '#f57c00' : '#ff9800', border: '2px solid #e65100', borderRadius: 0.5 }} />
            <Typography variant="caption" sx={{ color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)' }}>Исходящие (от кого зависит)</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 16, height: 16, bgcolor: 'transparent', border: '3px solid #fdd835', borderRadius: 0.5 }} />
            <Typography variant="caption" sx={{ color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)' }}>Найдено в поиске</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 16, height: 16, bgcolor: 'transparent', border: '2px solid #4caf50', borderRadius: 0.5 }} />
            <Typography variant="caption" sx={{ color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)' }}>Running</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 16, height: 16, bgcolor: 'transparent', border: '2px solid #f44336', borderRadius: 0.5 }} />
            <Typography variant="caption" sx={{ color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)' }}>Exited / Broken</Typography>
          </Box>
          
          <Box sx={{ height: 8 }} />
          
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 20, height: 3, bgcolor: mode === 'dark' ? '#f57c00' : '#ff9800', borderRadius: 0.5 }} />
            <Typography variant="caption" sx={{ color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)' }}>→ Исходящая связь</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 20, height: 3, bgcolor: mode === 'dark' ? '#1976d2' : '#2196f3', borderRadius: 0.5 }} />
            <Typography variant="caption" sx={{ color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)' }}>→ Входящая связь</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 20, height: 3, bgcolor: mode === 'dark' ? '#f44336' : '#d32f2f', borderRadius: 0.5 }} />
            <Typography variant="caption" sx={{ color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)' }}>→ Broken (оба контейнера)</Typography>
          </Box>
        </Stack>
      </Paper>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%" p={3}>
            <Alert severity="error" sx={{ maxWidth: 600 }}>
              Ошибка загрузки зависимостей: {error}
            </Alert>
          </Box>
        ) : nodes.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%" p={3}>
            <Alert severity="info" sx={{ maxWidth: 600 }}>
              Зависимости между контейнерами не найдены. Убедитесь, что у ваших контейнеров есть
              переменные окружения, начинающиеся с ENDPOINT_MODULE_, URI_ или VITE_URI_.
            </Alert>
          </Box>
        ) : (
          <Box sx={{ 
            height: '100%', 
            width: '100%',
            opacity: isInitialized ? 1 : 0,
            transition: 'opacity 0.1s ease-in'
          }}>
            <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onInit={setReactFlowInstance}
            onMoveEnd={handleMoveEnd}
            nodeTypes={nodeTypes}
            attributionPosition="bottom-left"
            minZoom={0.2}
            maxZoom={2.0}
            defaultEdgeOptions={{
              animated: false,
            }}
          >
            <Background
              color={theme.palette.mode === 'dark' ? '#555' : '#aaa'}
              gap={16}
            />
            <Panel position="top-left">
              <Paper
                elevation={3}
                sx={{
                  p: 1,
                  backgroundColor: mode === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <TextField
                  size="small"
                  placeholder="Поиск по графу..."
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  autoComplete="off"
                  sx={{ 
                    minWidth: 300,
                    '& .MuiOutlinedInput-root': {
                      color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)',
                      '& fieldset': {
                        borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                      },
                      '&:hover fieldset': {
                        borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: mode === 'dark' ? '#90caf9' : '#1976d2',
                      },
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.54)' }} />
                      </InputAdornment>
                    ),
                    endAdornment: localSearchQuery && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setLocalSearchQuery('')} edge="end">
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Paper>
            </Panel>
            {!isMobile && (
              <MiniMap
                style={miniMapStyle}
                nodeColor={(node) => {
                  return node.data.state === 'running'
                    ? theme.palette.success.main
                    : theme.palette.error.main;
                }}
              />
            )}
          </ReactFlow>
          </Box>
        )}
    </Box>
  );
}
