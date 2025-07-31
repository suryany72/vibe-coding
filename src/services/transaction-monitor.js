const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class TransactionMonitor extends EventEmitter {
  constructor(ruleProcessor, aiValidator, options = {}) {
    super();
    
    this.ruleProcessor = ruleProcessor;
    this.aiValidator = aiValidator;
    
    this.config = {
      autoProcessTransactions: options.autoProcessTransactions !== false,
      batchSize: options.batchSize || 10,
      processingInterval: options.processingInterval || 1000,
      enableRealTimeProcessing: options.enableRealTimeProcessing !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };
    
    this.transactionQueue = [];
    this.processingQueue = [];
    this.isProcessing = false;
    this.rules = [];
    this.transactionHistory = [];
    
    // Performance metrics
    this.metrics = {
      totalTransactions: 0,
      processedTransactions: 0,
      failedTransactions: 0,
      averageProcessingTime: 0,
      lastProcessingTime: null
    };
    
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for AI validation results
    if (this.aiValidator) {
      this.aiValidator.on('validation_completed', (validation) => {
        this.handleValidationResult(validation);
      });
      
      this.aiValidator.on('anomaly_detected', (anomaly) => {
        this.handleAnomalyDetection(anomaly);
      });
    }
  }

  /**
   * Start monitoring transactions
   */
  async start() {
    if (this.isProcessing) {
      this.log('info', 'Transaction Monitor is already running');
      return;
    }

    this.log('info', 'Starting Transaction Monitor...');
    this.isProcessing = true;
    
    // Load rules
    await this.loadRules();
    
    // Start processing loop if auto-processing is enabled
    if (this.config.autoProcessTransactions) {
      this.startProcessingLoop();
    }
    
    this.emit('started');
    this.log('info', 'Transaction Monitor started successfully');
  }

  /**
   * Stop monitoring transactions
   */
  async stop() {
    if (!this.isProcessing) {
      this.log('info', 'Transaction Monitor is not running');
      return;
    }

    this.log('info', 'Stopping Transaction Monitor...');
    this.isProcessing = false;
    
    // Process remaining transactions
    await this.processRemainingTransactions();
    
    this.emit('stopped');
    this.log('info', 'Transaction Monitor stopped successfully');
  }

  /**
   * Load rules from configuration
   */
  async loadRules() {
    // In a real implementation, this would load from database or file system
    // For now, we'll use a default set of rules
    this.rules = await this.getDefaultRules();
    this.log('info', `Loaded ${this.rules.length} rules for processing`);
  }

  /**
   * Get default rules for demonstration
   */
  async getDefaultRules() {
    return [
      {
        id: 'high_amount_transaction',
        name: 'High Amount Transaction',
        enabled: true,
        conditions: {
          field: 'amount',
          operator: 'greater_than',
          value: 10000
        },
        actions: [
          {
            type: 'flag_transaction',
            config: {
              reason: 'High amount transaction requires review'
            }
          },
          {
            type: 'calculate_score',
            config: {
              threshold: 80,
              factors: [
                {
                  field: 'amount',
                  weight: 1,
                  ranges: [
                    { min: 10000, max: 50000, points: 30 },
                    { min: 50000, max: 100000, points: 60 },
                    { min: 100000, max: Infinity, points: 90 }
                  ]
                }
              ]
            }
          }
        ]
      },
      {
        id: 'suspicious_location',
        name: 'Suspicious Location',
        enabled: true,
        conditions: {
          and: [
            {
              field: 'location.country',
              operator: 'in',
              value: ['Unknown', 'Restricted']
            },
            {
              field: 'amount',
              operator: 'greater_than',
              value: 1000
            }
          ]
        },
        actions: [
          {
            type: 'flag_transaction',
            config: {
              reason: 'Transaction from suspicious location'
            }
          },
          {
            type: 'send_notification',
            config: {
              recipient: 'security@company.com',
              message: 'Suspicious transaction detected from {location.country} for amount {amount}'
            }
          }
        ]
      },
      {
        id: 'frequent_transactions',
        name: 'Frequent Transactions',
        enabled: true,
        conditions: {
          field: 'user.transactionCount24h',
          operator: 'greater_than',
          value: 20
        },
        actions: [
          {
            type: 'log_event',
            config: {
              event: 'frequent_transactions_detected'
            }
          }
        ]
      }
    ];
  }

  /**
   * Monitor a transaction (main entry point for UI transactions)
   */
  monitorTransaction(transactionData) {
    // Validate transaction data
    if (!this.isValidTransaction(transactionData)) {
      const error = new Error('Invalid transaction data provided');
      this.log('error', `Transaction validation failed: ${error.message}`);
      throw error;
    }

    // Enhance transaction with metadata
    const enhancedTransaction = this.enhanceTransaction(transactionData);
    
    // Add to queue
    this.transactionQueue.push(enhancedTransaction);
    this.metrics.totalTransactions++;
    
    this.log('info', `Transaction ${enhancedTransaction.id} queued for processing`);
    this.emit('transaction_queued', enhancedTransaction);
    
    // Process immediately if real-time processing is enabled
    if (this.config.enableRealTimeProcessing) {
      setImmediate(() => this.processNextBatch());
    }
    
    return enhancedTransaction.id;
  }

  /**
   * Validate transaction data structure
   */
  isValidTransaction(transaction) {
    if (!transaction || typeof transaction !== 'object') {
      return false;
    }
    
    // Check required fields
    const requiredFields = ['amount', 'userId', 'type'];
    for (const field of requiredFields) {
      if (!(field in transaction)) {
        this.log('warning', `Missing required field: ${field}`);
        return false;
      }
    }
    
    // Validate amount
    if (typeof transaction.amount !== 'number' || transaction.amount < 0) {
      this.log('warning', 'Invalid amount value');
      return false;
    }
    
    return true;
  }

  /**
   * Enhance transaction with additional metadata
   */
  enhanceTransaction(transaction) {
    const now = new Date();
    
    return {
      ...transaction,
      id: transaction.id || uuidv4(),
      timestamp: transaction.timestamp || now.toISOString(),
      processedAt: null,
      retryCount: 0,
      status: 'pending',
      metadata: {
        receivedAt: now.toISOString(),
        source: 'ui',
        version: '1.0',
        ...transaction.metadata
      }
    };
  }

  /**
   * Start the processing loop
   */
  startProcessingLoop() {
    const processLoop = async () => {
      if (!this.isProcessing) return;
      
      try {
        await this.processNextBatch();
      } catch (error) {
        this.log('error', `Processing loop error: ${error.message}`);
      }
      
      // Schedule next processing cycle
      setTimeout(processLoop, this.config.processingInterval);
    };
    
    processLoop();
  }

  /**
   * Process next batch of transactions
   */
  async processNextBatch() {
    if (this.transactionQueue.length === 0) {
      return;
    }
    
    // Get next batch
    const batch = this.transactionQueue.splice(0, this.config.batchSize);
    this.processingQueue.push(...batch);
    
    this.log('info', `Processing batch of ${batch.length} transactions`);
    
    // Process each transaction in the batch
    const processingPromises = batch.map(transaction => 
      this.processTransaction(transaction)
    );
    
    try {
      await Promise.allSettled(processingPromises);
    } catch (error) {
      this.log('error', `Batch processing error: ${error.message}`);
    }
  }

  /**
   * Process individual transaction
   */
  async processTransaction(transaction) {
    const startTime = Date.now();
    
    try {
      this.log('debug', `Processing transaction ${transaction.id}`);
      
      transaction.status = 'processing';
      transaction.processedAt = new Date().toISOString();
      
      // Process transaction against rules
      const ruleResults = this.ruleProcessor.processTransaction(this.rules, transaction);
      
      // Create comprehensive result
      const result = {
        transactionId: transaction.id,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        ruleResults,
        transaction,
        summary: this.createResultSummary(ruleResults)
      };
      
      // Update transaction status
      transaction.status = 'completed';
      transaction.result = result;
      
      // Queue for AI validation
      if (this.aiValidator) {
        this.queueForAIValidation(result);
      }
      
      // Update metrics
      this.updateMetrics(result);
      
      // Add to history
      this.transactionHistory.push(result);
      
      // Trim history to last 1000 transactions
      if (this.transactionHistory.length > 1000) {
        this.transactionHistory = this.transactionHistory.slice(-1000);
      }
      
      // Emit completion event
      this.emit('transaction_processed', result);
      
      this.log('info', `Transaction ${transaction.id} processed successfully`);
      
      return result;
      
    } catch (error) {
      return await this.handleTransactionError(transaction, error);
    } finally {
      // Remove from processing queue
      const index = this.processingQueue.findIndex(t => t.id === transaction.id);
      if (index !== -1) {
        this.processingQueue.splice(index, 1);
      }
    }
  }

  /**
   * Create summary of rule results
   */
  createResultSummary(ruleResults) {
    const triggeredRules = ruleResults.results.filter(r => r.result);
    const flaggedRules = triggeredRules.filter(r => 
      r.actions.some(a => a.type === 'flag_transaction' && a.success)
    );
    
    return {
      totalRulesEvaluated: ruleResults.totalRules,
      rulesTriggered: triggeredRules.length,
      rulesFlagged: flaggedRules.length,
      hasErrors: ruleResults.errors > 0,
      riskScore: this.calculateOverallRiskScore(triggeredRules),
      recommendation: this.generateRecommendation(triggeredRules, flaggedRules)
    };
  }

  /**
   * Calculate overall risk score from triggered rules
   */
  calculateOverallRiskScore(triggeredRules) {
    if (triggeredRules.length === 0) return 0;
    
    let totalScore = 0;
    let scoreCount = 0;
    
    for (const rule of triggeredRules) {
      const scoreActions = rule.actions.filter(a => a.type === 'calculate_score' && a.success);
      for (const action of scoreActions) {
        totalScore += action.result.score || 0;
        scoreCount++;
      }
    }
    
    return scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
  }

  /**
   * Generate recommendation based on rule results
   */
  generateRecommendation(triggeredRules, flaggedRules) {
    if (flaggedRules.length > 0) {
      return 'REVIEW_REQUIRED';
    } else if (triggeredRules.length > 2) {
      return 'MONITOR_CLOSELY';
    } else if (triggeredRules.length > 0) {
      return 'NORMAL_MONITORING';
    } else {
      return 'APPROVED';
    }
  }

  /**
   * Queue transaction result for AI validation
   */
  queueForAIValidation(result) {
    // Queue rule execution validation
    for (const ruleResult of result.ruleResults.results) {
      this.aiValidator.queueValidation({
        type: 'rule_execution',
        priority: ruleResult.error ? 'high' : 'normal',
        data: {
          ruleResult,
          transactionData: result.transaction
        }
      });
    }
    
    // Queue overall performance validation
    this.aiValidator.queueValidation({
      type: 'performance',
      priority: 'normal',
      data: {
        processingTime: result.processingTime,
        ruleCount: result.ruleResults.totalRules,
        transactionId: result.transactionId
      }
    });
  }

  /**
   * Handle transaction processing error
   */
  async handleTransactionError(transaction, error) {
    this.log('error', `Transaction ${transaction.id} processing failed: ${error.message}`);
    
    transaction.retryCount = (transaction.retryCount || 0) + 1;
    transaction.status = 'failed';
    transaction.error = error.message;
    
    // Retry if under retry limit
    if (transaction.retryCount < this.config.maxRetries) {
      transaction.status = 'pending';
      
      // Add back to queue with delay
      setTimeout(() => {
        this.transactionQueue.unshift(transaction);
        this.log('info', `Transaction ${transaction.id} queued for retry (${transaction.retryCount}/${this.config.maxRetries})`);
      }, this.config.retryDelay * transaction.retryCount);
      
    } else {
      // Max retries exceeded
      this.metrics.failedTransactions++;
      
      const failureResult = {
        transactionId: transaction.id,
        timestamp: new Date().toISOString(),
        processingTime: 0,
        error: error.message,
        retryCount: transaction.retryCount,
        transaction
      };
      
      this.emit('transaction_failed', failureResult);
    }
    
    return transaction;
  }

  /**
   * Update processing metrics
   */
  updateMetrics(result) {
    this.metrics.processedTransactions++;
    
    // Update average processing time
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.processedTransactions - 1) + result.processingTime;
    this.metrics.averageProcessingTime = totalTime / this.metrics.processedTransactions;
    
    this.metrics.lastProcessingTime = result.timestamp;
  }

  /**
   * Handle AI validation result
   */
  handleValidationResult(validation) {
    this.log('debug', `Received validation result for ${validation.id}`);
    
    // If validation found critical issues, take action
    if (validation.result && !validation.result.passed) {
      const criticalIssues = validation.result.issues.filter(i => i.severity === 'critical');
      if (criticalIssues.length > 0) {
        this.emit('critical_validation_failure', {
          validationId: validation.id,
          issues: criticalIssues
        });
      }
    }
  }

  /**
   * Handle anomaly detection from AI validator
   */
  handleAnomalyDetection(anomaly) {
    this.log('warning', `Anomaly detected: ${anomaly.type}`);
    this.emit('anomaly_detected', anomaly);
    
    // Take appropriate action based on anomaly type
    switch (anomaly.type) {
      case 'high_error_rate':
        this.log('warning', 'High error rate detected, consider reviewing rules');
        break;
      default:
        this.log('info', `Unknown anomaly type: ${anomaly.type}`);
    }
  }

  /**
   * Process remaining transactions before shutdown
   */
  async processRemainingTransactions() {
    if (this.transactionQueue.length === 0 && this.processingQueue.length === 0) {
      return;
    }
    
    this.log('info', `Processing ${this.transactionQueue.length} remaining transactions`);
    
    // Process all remaining transactions
    while (this.transactionQueue.length > 0) {
      await this.processNextBatch();
    }
    
    // Wait for processing queue to empty
    while (this.processingQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Get current status and metrics
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.transactionQueue.length,
      processingQueueLength: this.processingQueue.length,
      rulesLoaded: this.rules.length,
      metrics: this.metrics,
      recentTransactions: this.transactionHistory.slice(-10)
    };
  }

  /**
   * Update rules configuration
   */
  async updateRules(newRules) {
    this.log('info', `Updating rules configuration (${newRules.length} rules)`);
    this.rules = newRules;
    this.emit('rules_updated', newRules);
  }

  /**
   * Log message with timestamp
   */
  log(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [TX-MONITOR] [${level.toUpperCase()}] ${message}`);
  }
}

module.exports = TransactionMonitor; 