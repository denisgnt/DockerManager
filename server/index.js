import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import { exec, spawn } from 'child_process';
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
});
