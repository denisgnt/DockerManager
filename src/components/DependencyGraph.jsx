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
  AppBar,
  Toolbar
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005';

// Custom node component
const CustomNode = ({ data }) => {
  const theme = useTheme();
  const isRunning = data.state === 'running';
  const isExited = data.state === 'exited';
  const isSelected = data.isSelected;
  const isHighlighted = data.isHighlighted;
  const hasBrokenDependency = data.hasBrokenDependency;
  
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Card
        sx={{
          minWidth: 200,
          border: isSelected ? 4 : 2,
          borderColor: isSelected 
            ? (isExited 
              ? (theme.palette.mode === 'dark' ? '#f44336' : '#d32f2f')
              : (theme.palette.mode === 'dark' ? '#ffd700' : '#ffa000'))
            : isHighlighted
            ? (theme.palette.mode === 'dark' ? '#ffcc80' : '#ffb74d')
            : hasBrokenDependency
            ? (theme.palette.mode === 'dark' ? '#f44336' : '#d32f2f')
            : isRunning ? 'success.main' : 'error.main',
          boxShadow: isSelected ? 8 : isHighlighted ? 4 : 3,
          backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'background.paper',
          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
          transition: 'all 0.2s ease-in-out',
          cursor: 'pointer',
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight="bold" noWrap>
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
                  sx={{ width: 'fit-content' }}
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

export default function DependencyGraph({ open, onClose }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [layoutDirection, setLayoutDirection] = useState('TB'); // TB = top-bottom, LR = left-right
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [allDependencies, setAllDependencies] = useState([]);

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
          positions[node.id] = node.position;
        });
        
        // Save to backend
        axios.post(`${API_URL}/api/graph/positions`, positions)
          .catch(err => console.error('Failed to save positions:', err));
        
        return currentNodes;
      });
    }
  }, [onNodesChange, setNodes]);

  const fetchDependencies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/containers/dependencies`);
      const dependencies = response.data;
      setAllDependencies(dependencies);

      // Load saved positions
      let savedPositions = {};
      try {
        const positionsResponse = await axios.get(`${API_URL}/api/graph/positions`);
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
      const nodePositions = calculateNodePositions(dependencies, layoutDirection);
      const newNodes = dependencies.map((container, index) => ({
        id: container.id,
        type: 'custom',
        position: savedPositions[container.id] || nodePositions[container.name] || { x: 250, y: index * 150 },
        data: {
          label: container.name,
          state: container.state,
          status: container.status,
          dependencies: container.dependencies,
          isSelected: false,
          isHighlighted: false,
          hasBrokenDependency: containersBrokenDeps.has(container.id),
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges, theme.palette.mode, layoutDirection]);

  useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

  const calculateNodePositions = (dependencies, direction) => {
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
  };

  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.15, duration: 400, minZoom: 0.5, maxZoom: 1.5 });
    }
  }, [reactFlowInstance]);

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

  const toggleLayout = useCallback(() => {
    setLayoutDirection(prev => prev === 'TB' ? 'LR' : 'TB');
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
        data: { ...n.data, isSelected: false, isHighlighted: false }
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
      const dependencyTargets = new Set();
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
          isHighlighted: dependencyTargets.has(n.id),
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
              ? (theme.palette.mode === 'dark' ? '#ffa726' : '#f57c00') // Оранжевый для исходящих (всегда)
              : isIncoming
                ? (selectedIsExited
                  ? (theme.palette.mode === 'dark' ? '#f44336' : '#d32f2f') // Красный если выбранный exited
                  : (theme.palette.mode === 'dark' ? '#4caf50' : '#2e7d32')) // Зелёный если выбранный running
                : (theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2'), // Синий по умолчанию
          },
          markerEnd: {
            ...e.markerEnd,
            color: isOutgoing 
              ? (theme.palette.mode === 'dark' ? '#ffa726' : '#f57c00')
              : isIncoming
                ? (selectedIsExited
                  ? (theme.palette.mode === 'dark' ? '#f44336' : '#d32f2f')
                  : (theme.palette.mode === 'dark' ? '#4caf50' : '#2e7d32'))
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
        data: { ...n.data, isSelected: false, isHighlighted: false }
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

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.palette.background.default,
        zIndex: 1300,
      }}
    >
      {/* AppBar для страницы графа */}
      <AppBar
        position="static"
        elevation={1}
        sx={{
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          color: theme.palette.mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)',
        }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Граф зависимостей контейнеров
          </Typography>
          
          <Tooltip title="Обновить">
            <IconButton onClick={fetchDependencies} size="small" color="inherit" sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Вместить все">
            <IconButton onClick={handleFitView} size="small" color="inherit" sx={{ mr: 1 }}>
              <FitScreenIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Увеличить">
            <IconButton onClick={handleZoomIn} size="small" color="inherit" sx={{ mr: 1 }}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Уменьшить">
            <IconButton onClick={handleZoomOut} size="small" color="inherit" sx={{ mr: 1 }}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          
          <Button
            size="small"
            variant="outlined"
            onClick={toggleLayout}
            sx={{ mr: 2, color: 'inherit', borderColor: 'inherit' }}
          >
            {layoutDirection === 'TB' ? 'Горизонтально' : 'Вертикально'}
          </Button>
          
          <Tooltip title="Закрыть">
            <IconButton onClick={onClose} size="small" color="inherit">
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Контент графа */}
      <Box sx={{ height: 'calc(100vh - 64px)', width: '100%', position: 'relative' }}>
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
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            defaultZoom={1.0}
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
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </Box>
    </Box>
  );
}
