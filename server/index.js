import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DOCKER_HOST } from './appsettings.js'; 
import { PORT } from './appsettings.js';
import { SCRIPTS_DIR } from './appsettings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

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

// Get all containers
app.get('/api/containers', async (req, res) => {
  try {
    const containers = await dockerRequest('/containers/json?all=true');
    
    // Add rebuilding status to each container
    const containersWithStatus = containers.map(container => ({
      ...container,
      Rebuilding: rebuildingContainers.has(container.Id)
    }));
    
    res.json(containersWithStatus);
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
    
    // Execute script on HOST using nsenter to enter host's PID namespace
    // This allows running commands directly on the host without temporary containers
    console.log(`Executing script on host: ${scriptPath}`);
    
    const hostScriptPath = scriptPath.replace('/app/scripts', process.env.HOST_SCRIPTS_DIR || '/home/axitech/BPM2');
    const hostUser = process.env.HOST_USER || 'axitech';
    
    // Use nsenter to run command in host's namespaces as the host user
    // This ensures SSH keys and git config are available
    const command = `nsenter --target 1 --mount --uts --ipc --net --pid -- su - ${hostUser} -c "bash '${hostScriptPath}'"`;
    
    console.log(`Executing command as user ${hostUser}: ${command}`);
    
    try {
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer
      
      console.log('Script executed successfully');
      if (stderr) {
        console.error('Script stderr:', stderr);
      }

      const output = stdout + (stderr ? `\n${stderr}` : '');
      
      // Clear rebuilding status
      rebuildingContainers.delete(containerId);
      
      // Notify all clients about rebuild completion
      io.emit('rebuild-status-changed', { 
        containerId, 
        rebuilding: false,
        containerName,
        success: true
      });
            
      console.log(`Container ${containerId} (${containerName}) rebuild completed successfully`);

      res.json({
        success: true,
        output: output,
        exitCode: 0,
        message: `Script executed successfully on host for ${containerName}`
      });
    } catch (execError) {
      // Command failed but we have output
      const output = (execError.stdout || '') + (execError.stderr ? `\n${execError.stderr}` : '');
      
      console.error('Script execution failed:', execError.message);
      
      // Clear rebuilding status even on error
      rebuildingContainers.delete(containerId);
      
      // Notify all clients about rebuild failure
      io.emit('rebuild-status-changed', { 
        containerId, 
        rebuilding: false,
        containerName,
        success: false,
        error: execError.message
      });

      console.log(`Container ${containerId} (${containerName}) rebuild failed`);
      
      res.status(500).json({
        success: false,
        error: execError.message,
        output: output,
        exitCode: execError.code || 1
      });
    }
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
      error: error.message,
      output: error.stdout || error.stderr || '',
      exitCode: error.code || 1
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
});
