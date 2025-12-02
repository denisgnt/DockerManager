import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import { spawn } from 'child_process';

import { readdir, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DOCKER_HOST } from './appsettings.js'; 
import { PORT } from './appsettings.js';
import { SCRIPTS_DIR } from './appsettings.js';
import { isUriBasedDependency } from './utils.js';
import { ContainersCacheManager, NodePositionsCacheManager } from './cacheManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map to track containers currently being rebuilt
const rebuildingContainers = new Map();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Serve static files in production
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
}

// Helper function to make Docker API requests
const dockerRequest = async (endpoint, method = 'GET', data = null) => {
  
  try {
    const config = {
      method,
      url: `${DOCKER_HOST}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Docker API Error: ${error.message}`);
    throw error;
  }
};

// Load containers from cache
const loadContainersCache = async () => {
  try {
    return await ContainersCacheManager.getAll();
  } catch (error) {
    console.error('Failed to load containers cache:', error.message);
    return [];
  }
};

// Update containers cache (fetch from Docker and save)
const updateContainersCache = async (containers) => {
  try {
    console.log('Updating containers cache...');
    if(!containers) {
      containers = await dockerRequest('/containers/json?all=true');
    }
  
    // Fetch full container info including environment variables
    const containersWithEnv = await Promise.all(
      containers.map(async (container) => {
        try {
          const inspect = await dockerRequest(`/containers/${container.Id}/json`);
          return {
            ...container,
            Env: (inspect.Config.Env || []).filter(envVar => isUriBasedDependency(envVar.split('=')[0]))
          };
        } catch (err) {
          console.error(`Failed to inspect container ${container.Id}:`, err.message);
          return container;
        }
      })
    );
    
    await ContainersCacheManager.saveContainers(containersWithEnv);
  } catch (error) {
    console.error('Failed to update containers cache:', error.message);
  }
};

// Merge current containers with cached ones
const mergeContainersWithCache = async () => {
  
  const currentContainers = await dockerRequest('/containers/json?all=true');

  const cachedContainers = await loadContainersCache();

  // Create a map of current containers by name
  const currentMap = new Map();
  currentContainers.forEach(container => {
    const name = container.Names?.[0]?.replace(/^\//, '') || container.Id;
    currentMap.set(name, container);
  });
  
  const cachedMap = new Map();
  // Merge with cache: add cached containers that are not in current list
  const mergedContainers = [...currentContainers]
  cachedContainers.forEach(cachedContainer => {
    const name = cachedContainer.Names?.[0]?.replace(/^\//, '') || cachedContainer.Id;
    cachedMap.set(name, cachedContainer);
    if (!currentMap.has(name)) {
      // Container not found in current list, add from cache with unavailable status
      mergedContainers.push({
        ...cachedContainer,
        State: 'unavailable',
        Status: 'Unavailable (cached)',
        Rebuilding: false
      });
    }
  });



  const newContainers = Array.from(currentMap.keys())
    .filter(key => !cachedMap.has(key))
    .map(key => currentMap.get(key));

  if (newContainers.length > 0) {
    console.log(`Adding ${newContainers.length} new containers from current list`);
    updateContainersCache(newContainers);
  }



  //console.log(`Merging containers: ${newContainers.length} current, ${cachedMap.size} cached, ${mergedContainers.length} total after merge`);
  
  return mergedContainers;
};

// Get all containers
app.get('/api/containers', async (req, res) => {
  try {
 
    // Merge with cached containers
    const mergedContainers = await mergeContainersWithCache();
    
    // Add rebuilding status to each container
    const containersWithStatus = mergedContainers.map(container => ({
      ...container,
      Rebuilding: rebuildingContainers.has(container.Id)
    }));
    
    res.json(containersWithStatus);
  } catch (error) {
    console.error('Docker API unavailable, using cached data:', error.message);
    
    // Try to load from cache
    const cachedContainers = await loadContainersCache();
    
    if (cachedContainers.length > 0) {
      // Mark all cached containers as unavailable since Docker is not available
      const containersWithUnavailableStatus = cachedContainers.map(container => ({
        ...container,
        State: 'unavailable',
        Status: 'Unavailable (Docker unavailable)',
        Rebuilding: false
      }));
      
      res.json(containersWithUnavailableStatus);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get container dependencies from environment variables
app.get('/api/containers/dependencies', async (req, res) => {
  try {
  
    // Merge with cached containers
    const containers = await mergeContainersWithCache();
    
    const dependencies = [];
    
    // First, create a map of ports to container names from _PORT env vars
    const portToContainerMap = new Map();
    
    for (const container of containers) {
      const containerName = container.Names?.[0]?.replace(/^\//, '') || container.Id;
      let env = [];
      
      // Get environment variables from cache if unavailable, otherwise from Docker API
      if (container.State === 'unavailable') {
        env = container.Env || [];
      } else {
        try {
          const inspect = await dockerRequest(`/containers/${container.Id}/json`);
          env = inspect.Config.Env || [];
        } catch (err) {
          console.error(`Failed to inspect container ${container.Id}:`, err.message);
          env = container.Env || [];
        }
      }
      
      // Find all _PORT environment variables
      env.forEach(envVar => {
        const [key, value] = envVar.split('=');
        if (key && key.endsWith('PORT') && value && !key.startsWith('VITE_')) {
          // Map port to container name
          portToContainerMap.set(value, containerName);
        }
      });
    }
    
    // Now find dependencies based on URI_* variables
    for (const container of containers) {
      const containerName = container.Names?.[0]?.replace(/^\//, '') || container.Id;
      let env = [];
      
      // Get environment variables from cache if unavailable, otherwise from Docker API
      if (container.State === 'unavailable') {
        env = container.Env || [];
      } else {
        try {
          const inspect = await dockerRequest(`/containers/${container.Id}/json`);
          env = inspect.Config.Env || [];
        } catch (err) {
          console.error(`Failed to inspect container ${container.Id}:`, err.message);
          env = container.Env || [];
        }
      }
      
      // Parse environment variables for dependencies
      const deps = [];
      env.forEach(envVar => {
        const [key, value] = envVar.split('=');
        if (key && value) {
          // Check for URI-based dependencies (ENDPOINT_MODULE_, URI_, VITE_URI_)
          if (isUriBasedDependency(key)) {  
            // Extract port from URL: http://host:port/path
            const urlMatch = value.match(/https?:\/\/[^:\/]+:(\d+)/);
            if (urlMatch) {
              const port = urlMatch[1];
              
              // Find target container by port
              if (portToContainerMap.has(port)) {
                const targetContainer = portToContainerMap.get(port);
                deps.push({
                  envVar: key,
                  target: targetContainer,
                  url: value,
                  port: port
                });
              }
            }
          }
        }
      });
      
      dependencies.push({
        id: container.Id,
        name: containerName,
        state: container.State,
        status: container.Status,
        dependencies: deps
      });
    }
  
    res.json(dependencies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get saved node positions
app.get('/api/graph/positions', async (req, res) => {
  try {
    const positions = await NodePositionsCacheManager.getPositions();
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save node positions
app.post('/api/graph/positions', async (req, res) => {
  try {
    const positions = req.body;
    const result = await NodePositionsCacheManager.savePositions(positions);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete node positions (reset layout)
app.delete('/api/graph/positions', async (req, res) => {
  try {
    const result = await NodePositionsCacheManager.reset();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get container details
app.get('/api/containers/:id', async (req, res) => {
  try {
    const container = await dockerRequest(`/containers/${req.params.id}/json`);
    res.json(container);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start container
app.post('/api/containers/:id/start', async (req, res) => {
  try {
    await dockerRequest(`/containers/${req.params.id}/start`, 'POST');
    res.json({ message: 'Container started successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop container
app.post('/api/containers/:id/stop', async (req, res) => {
  try {
    await dockerRequest(`/containers/${req.params.id}/stop`, 'POST');
    res.json({ message: 'Container stopped successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restart container
app.post('/api/containers/:id/restart', async (req, res) => {
  try {
    await dockerRequest(`/containers/${req.params.id}/restart`, 'POST');
    res.json({ message: 'Container restarted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove container
app.delete('/api/containers/:id', async (req, res) => {
  try {
    await dockerRequest(`/containers/${req.params.id}?force=true`, 'DELETE');
    res.json({ message: 'Container removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get container logs
app.get('/api/containers/:id/logs', async (req, res) => {
  try {
    const logs = await dockerRequest(
      `/containers/${req.params.id}/logs?stdout=true&stderr=true&tail=100`
    );
    res.send(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export container logs to file
app.get('/api/containers/:id/export-logs', async (req, res) => {
  try {
    const tail = req.query.tail || 5000;
    
    // Get logs without demux (as raw stream)
    const response = await axios({
      method: 'GET',
      url: `${DOCKER_HOST}/containers/${req.params.id}/logs?stdout=true&stderr=true&tail=${tail}&timestamps=true`,
      responseType: 'arraybuffer'
    });
    
    const buffer = Buffer.from(response.data);
    const lines = [];
    let offset = 0;
    
    // Parse Docker multiplexed stream format
    while (offset < buffer.length) {
      if (offset + 8 > buffer.length) break;
      
      // Header: [stream_type(1), 0, 0, 0, size(4 bytes big-endian)]
      const payloadSize = buffer.readUInt32BE(offset + 4);
      const payloadStart = offset + 8;
      const payloadEnd = payloadStart + payloadSize;
      
      if (payloadEnd > buffer.length) break;
      
      // Extract payload
      let line = buffer.slice(payloadStart, payloadEnd).toString('utf8');
      
      // Clean ANSI codes
      line = line.replace(/\x1b\[[0-9;]*m/g, '');
      line = line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
      
      // Remove carriage returns and trim
      line = line.replace(/\r/g, '').trim();
      
      if (line) {
        lines.push(line);
      }
      
      offset = payloadEnd;
    }
    
    const cleanedLogs = lines.join('\n');
    
    // Set headers for file download
    const container = await dockerRequest(`/containers/${req.params.id}/json`);
    const containerName = container.Name.replace(/^\//, '');
    const filename = `${containerName}_logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(cleanedLogs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get container stats
app.get('/api/containers/:id/stats', async (req, res) => {
  try {
    const stats = await dockerRequest(
      `/containers/${req.params.id}/stats?stream=false`
    );
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Docker info
app.get('/api/info', async (req, res) => {
  try {
    const info = await dockerRequest('/info');
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available scripts for containers
app.get('/api/scripts', async (req, res) => {
  try {
    const files = await readdir(SCRIPTS_DIR);
    const scripts = {};
    
    // Filter .sh files and parse names
    for (const file of files) {
      if (file.endsWith('.sh')) {
        const match = file.match(/^UP_(.+)\.sh$/);
        if (match) {
          const serviceName = match[1];
          scripts[serviceName] = file;
        }
      }
    }
    
    res.json(scripts);
  } catch (error) {
    console.error('Error reading scripts directory:', error.message);
    res.json({}); // Return empty object if directory doesn't exist
  }
});

// Execute script for container
app.post('/api/scripts/execute', async (req, res) => {
  try {
    const { scriptName, containerName, containerId } = req.body;
    
    if (!scriptName) {
      return res.status(400).json({ error: 'Script name is required' });
    }
    
    if (!containerId) {
      return res.status(400).json({ error: 'Container ID is required' });
    }
    
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    
    // Check if script exists and is accessible from container
    try {
      await access(scriptPath, constants.F_OK);
    } catch (err) {
      return res.status(404).json({ error: 'Script not found' });
    }
    
    // Mark container as rebuilding
    rebuildingContainers.set(containerId, { containerName, startTime: Date.now() });
    
    // Notify all clients about rebuild start
    io.emit('rebuild-status-changed', { 
      containerId, 
      rebuilding: true,
      containerName 
    });
      
    console.log(`Container ${containerId} (${containerName}) marked as rebuilding`);
    
    // Send immediate response to client
    res.json({
      success: true,
      message: 'Script execution started',
      containerId,
      containerName
    });
    
    // Execute script on HOST using nsenter to enter host's PID namespace
    console.log(`Executing script on host: ${scriptPath}`);
    
    const hostScriptPath = scriptPath.replace('/app/scripts', process.env.HOST_SCRIPTS_DIR || '/home/axitech/BPM2');
    const hostUser = process.env.HOST_USER || 'axitech';
    
    // Use spawn for streaming output
    const child = spawn('nsenter', [
      '--target', '1',
      '--mount', '--uts', '--ipc', '--net', '--pid',
      '--', 'su', '-', hostUser, '-c',
      `bash '${hostScriptPath}'`
    ]);
    
    let output = '';
    
    // Stream stdout
    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      io.emit('script-output', { 
        containerId, 
        containerName,
        data: text,
        type: 'stdout'
      });
    });
    
    // Stream stderr
    child.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      io.emit('script-output', { 
        containerId, 
        containerName,
        data: text,
        type: 'stderr'
      });
    });
    
    // Handle completion
    child.on('close', (exitCode) => {
      // Clear rebuilding status
      rebuildingContainers.delete(containerId);
      
      const success = exitCode === 0;
      
      // Notify all clients about rebuild completion
      io.emit('rebuild-status-changed', { 
        containerId, 
        rebuilding: false,
        containerName,
        success
      });
      
      // Send final output
      io.emit('script-completed', {
        containerId,
        containerName,
        output,
        exitCode,
        success
      });
      
      console.log(`Container ${containerId} (${containerName}) rebuild ${success ? 'completed successfully' : 'failed'} with exit code ${exitCode}`);
    });
    
    // Handle errors
    child.on('error', (error) => {
      console.error('Script execution error:', error.message);
      
      // Clear rebuilding status
      rebuildingContainers.delete(containerId);
      
      // Notify all clients about rebuild failure
      io.emit('rebuild-status-changed', { 
        containerId, 
        rebuilding: false,
        containerName,
        success: false,
        error: error.message
      });
      
      io.emit('script-completed', {
        containerId,
        containerName,
        output: output + `\nError: ${error.message}`,
        exitCode: 1,
        success: false,
        error: error.message
      });
    });
  } catch (error) {
    console.error('Error executing script:', error.message);
    
    // Clear rebuilding status on any error
    if (req.body.containerId) {
      rebuildingContainers.delete(req.body.containerId);
      
      // Notify all clients about rebuild failure
      io.emit('rebuild-status-changed', { 
        containerId: req.body.containerId, 
        rebuilding: false,
        containerName: req.body.containerName,
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// WebSocket for real-time logs
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe-logs', async (containerId) => {
    console.log(`Subscribing to logs for container: ${containerId}`);
    
    try {
      // Stream logs from Docker API
      const response = await axios({
        method: 'GET',
        url: `${DOCKER_HOST}/containers/${containerId}/logs?follow=true&stdout=true&stderr=true&tail=50`,
        responseType: 'stream'
      });

      response.data.on('data', (chunk) => {
        // Remove Docker stream header (first 8 bytes)
        const log = chunk.toString('utf8').substring(8);
        socket.emit('log-data', { containerId, data: log });
      });

      response.data.on('end', () => {
        console.log(`Log stream ended for container: ${containerId}`);
      });

      response.data.on('error', (error) => {
        console.error(`Log stream error: ${error.message}`);
        socket.emit('log-error', { containerId, error: error.message });
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        response.data.destroy();
      });

      socket.on('unsubscribe-logs', () => {
        console.log(`Unsubscribing from logs for container: ${containerId}`);
        response.data.destroy();
      });

    } catch (error) {
      console.error(`Error subscribing to logs: ${error.message}`);
      socket.emit('log-error', { containerId, error: error.message });
    }
  });
});

// Serve index.html for all non-API routes in production
if (isProduction) {
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(__dirname, '../dist/index.html'));
    } else {
      next();
    }
  });
}

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Docker API: ${DOCKER_HOST}`);
  console.log(`Scripts directory: ${SCRIPTS_DIR}`);
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
  
  // Update containers cache on startup
  updateContainersCache();
});
