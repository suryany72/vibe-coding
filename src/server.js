const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const RuleProcessor = require('./rules-engine/rule-processor');
const AIValidationAgent = require('./agents/ai-validator');
const TransactionMonitor = require('./services/transaction-monitor');

class AIRulesValidatorServer {
  constructor(options = {}) {
    this.config = {
      port: options.port || process.env.PORT || 3000,
      host: options.host || process.env.HOST || 'localhost',
      enableWebSocket: options.enableWebSocket !== false,
      enableCors: options.enableCors !== false,
      staticPath: options.staticPath || path.join(__dirname, '../public'),
      rulesPath: options.rulesPath || path.join(__dirname, '../rules'),
      ...options
    };
    
    // Initialize core components
    this.ruleProcessor = new RuleProcessor();
    this.aiValidator = new AIValidationAgent({
      rulesPath: this.config.rulesPath,
      logLevel: 'info'
    });
    this.transactionMonitor = new TransactionMonitor(
      this.ruleProcessor, 
      this.aiValidator,
      { enableRealTimeProcessing: true }
    );
    
    // Initialize Express app
    this.app = express();
    this.server = http.createServer(this.app);
    
    // Initialize WebSocket if enabled
    if (this.config.enableWebSocket) {
      this.wss = new WebSocket.Server({ server: this.server });
      this.websocketClients = new Set();
    }
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupEventListeners();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Enable CORS if configured
    if (this.config.enableCors) {
      this.app.use(cors());
    }
    
    // Body parsing middleware
    this.app.use(bodyParser.json({ limit: '10mb' }));
    this.app.use(bodyParser.urlencoded({ extended: true }));
    
    // Logging middleware
    this.app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [SERVER] ${req.method} ${req.path}`);
      next();
    });
    
    // Serve static files
    this.app.use(express.static(this.config.staticPath));
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          aiValidator: this.aiValidator.isRunning,
          transactionMonitor: this.transactionMonitor.isProcessing
        }
      });
    });

    // Transaction processing endpoint
    this.app.post('/api/transactions', async (req, res) => {
      try {
        const transaction = req.body;
        const transactionId = this.transactionMonitor.monitorTransaction(transaction);
        
        res.json({
          success: true,
          transactionId,
          message: 'Transaction queued for processing'
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get transaction status
    this.app.get('/api/transactions/:id', (req, res) => {
      const transactionId = req.params.id;
      const transaction = this.transactionMonitor.transactionHistory
        .find(t => t.transactionId === transactionId);
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }
      
      res.json({
        success: true,
        transaction
      });
    });

    // Get system statistics
    this.app.get('/api/stats', (req, res) => {
      const transactionStats = this.transactionMonitor.getStatus();
      const aiStats = this.aiValidator.getStatistics();
      
      res.json({
        success: true,
        statistics: {
          transactions: transactionStats,
          aiValidation: aiStats,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        }
      });
    });

    // Get validation history
    this.app.get('/api/validations', (req, res) => {
      const limit = parseInt(req.query.limit) || 50;
      const validations = this.aiValidator.validationHistory.slice(-limit);
      
      res.json({
        success: true,
        validations,
        total: this.aiValidator.validationHistory.length
      });
    });

    // Get rules configuration
    this.app.get('/api/rules', (req, res) => {
      res.json({
        success: true,
        rules: this.transactionMonitor.rules
      });
    });

    // Update rules configuration
    this.app.put('/api/rules', async (req, res) => {
      try {
        const newRules = req.body.rules;
        await this.transactionMonitor.updateRules(newRules);
        
        res.json({
          success: true,
          message: 'Rules updated successfully',
          rulesCount: newRules.length
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // Manual rule validation endpoint
    this.app.post('/api/validate-rule', async (req, res) => {
      try {
        const { rule, testData } = req.body;
        
        if (!rule || !testData) {
          return res.status(400).json({
            success: false,
            error: 'Rule and test data are required'
          });
        }
        
        // Queue for AI validation
        const validationId = this.aiValidator.queueValidation({
          type: 'rule_logic',
          priority: 'high',
          data: { rule, testData }
        });
        
        res.json({
          success: true,
          validationId,
          message: 'Rule queued for validation'
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // Process sample transaction endpoint
    this.app.post('/api/test-transaction', async (req, res) => {
      try {
        const sampleTransaction = {
          id: `test_${Date.now()}`,
          amount: req.body.amount || 5000,
          userId: req.body.userId || 'test_user',
          type: req.body.type || 'transfer',
          location: req.body.location || { country: 'US', city: 'New York' },
          timestamp: new Date().toISOString(),
          user: {
            transactionCount24h: req.body.transactionCount24h || 1
          },
          ...req.body
        };
        
        const transactionId = this.transactionMonitor.monitorTransaction(sampleTransaction);
        
        res.json({
          success: true,
          transactionId,
          sampleTransaction,
          message: 'Test transaction processed'
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get anomalies
    this.app.get('/api/anomalies', (req, res) => {
      res.json({
        success: true,
        anomalies: this.aiValidator.anomalies.slice(-20)
      });
    });

    // Root endpoint - serve the UI
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(this.config.staticPath, 'index.html'));
    });
  }

  /**
   * Setup WebSocket for real-time updates
   */
  setupWebSocket() {
    if (!this.wss) return;
    
    this.wss.on('connection', (ws, req) => {
      console.log(`[${new Date().toISOString()}] [SERVER] WebSocket client connected`);
      this.websocketClients.add(ws);
      
      // Send initial status
      ws.send(JSON.stringify({
        type: 'status',
        data: {
          connected: true,
          timestamp: new Date().toISOString()
        }
      }));
      
      ws.on('close', () => {
        console.log(`[${new Date().toISOString()}] [SERVER] WebSocket client disconnected`);
        this.websocketClients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] [SERVER] WebSocket error:`, error.message);
        this.websocketClients.delete(ws);
      });
    });
  }

  /**
   * Setup event listeners for real-time updates
   */
  setupEventListeners() {
    // Transaction events
    this.transactionMonitor.on('transaction_processed', (result) => {
      this.broadcastToClients({
        type: 'transaction_processed',
        data: result
      });
    });
    
    this.transactionMonitor.on('transaction_failed', (result) => {
      this.broadcastToClients({
        type: 'transaction_failed',
        data: result
      });
    });
    
    // AI Validation events
    this.aiValidator.on('validation_completed', (validation) => {
      this.broadcastToClients({
        type: 'validation_completed',
        data: validation
      });
    });
    
    this.aiValidator.on('anomaly_detected', (anomaly) => {
      this.broadcastToClients({
        type: 'anomaly_detected',
        data: anomaly
      });
    });
    
    this.aiValidator.on('health_check', (health) => {
      this.broadcastToClients({
        type: 'health_check',
        data: health
      });
    });
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  broadcastToClients(message) {
    if (!this.websocketClients || this.websocketClients.size === 0) return;
    
    const messageString = JSON.stringify(message);
    
    this.websocketClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
        } catch (error) {
          console.error('Failed to send WebSocket message:', error.message);
          this.websocketClients.delete(client);
        }
      }
    });
  }

  /**
   * Start the server and all background services
   */
  async start() {
    try {
      console.log(`[${new Date().toISOString()}] [SERVER] Starting AI Rules Validator Server...`);
      
      // Start background services
      await this.aiValidator.start();
      await this.transactionMonitor.start();
      
      // Start HTTP server
      return new Promise((resolve, reject) => {
        this.server.listen(this.config.port, this.config.host, (error) => {
          if (error) {
            reject(error);
            return;
          }
          
          console.log(`[${new Date().toISOString()}] [SERVER] Server running at http://${this.config.host}:${this.config.port}`);
          console.log(`[${new Date().toISOString()}] [SERVER] WebSocket ${this.config.enableWebSocket ? 'enabled' : 'disabled'}`);
          console.log(`[${new Date().toISOString()}] [SERVER] AI Validation Agent running in background`);
          console.log(`[${new Date().toISOString()}] [SERVER] Transaction Monitor active`);
          
          resolve();
        });
      });
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [SERVER] Failed to start server:`, error.message);
      throw error;
    }
  }

  /**
   * Stop the server and all background services
   */
  async stop() {
    try {
      console.log(`[${new Date().toISOString()}] [SERVER] Stopping AI Rules Validator Server...`);
      
      // Close WebSocket connections
      if (this.websocketClients) {
        this.websocketClients.forEach(client => {
          client.close();
        });
        this.websocketClients.clear();
      }
      
      // Stop background services
      await this.transactionMonitor.stop();
      await this.aiValidator.stop();
      
      // Close HTTP server
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log(`[${new Date().toISOString()}] [SERVER] Server stopped successfully`);
          resolve();
        });
      });
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [SERVER] Error stopping server:`, error.message);
      throw error;
    }
  }
}

// Create and start server if run directly
if (require.main === module) {
  const server = new AIRulesValidatorServer();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error.message);
      process.exit(1);
    }
  });
  
  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error.message);
      process.exit(1);
    }
  });
  
  // Start the server
  server.start().catch(error => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  });
}

module.exports = AIRulesValidatorServer; 