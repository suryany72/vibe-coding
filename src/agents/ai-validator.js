const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class AIValidationAgent extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      validationInterval: options.validationInterval || 5000, // 5 seconds
      maxConcurrentValidations: options.maxConcurrentValidations || 3,
      logLevel: options.logLevel || 'info',
      enableRealTimeValidation: options.enableRealTimeValidation !== false,
      rulesPath: options.rulesPath || path.join(process.cwd(), 'rules'),
      ...options
    };
    
    this.isRunning = false;
    this.validationQueue = [];
    this.activeValidations = new Set();
    this.validationHistory = [];
    this.rulePerformanceMetrics = new Map();
    this.anomalies = [];
    
    // AI validation patterns
    this.validationPatterns = {
      performance: {
        executionTimeThreshold: 1000, // ms
        memoryUsageThreshold: 50 * 1024 * 1024, // 50MB
        errorRateThreshold: 0.05 // 5%
      },
      accuracy: {
        expectedResultPatterns: new Map(),
        contradictoryRules: [],
        logicalInconsistencies: []
      },
      security: {
        suspiciousPatterns: [
          /eval\(/i,
          /function\s*\(/i,
          /new\s+Function/i,
          /script/i
        ],
        dataLeakagePatterns: [
          /password/i,
          /secret/i,
          /token/i,
          /key/i
        ]
      }
    };
  }

  /**
   * Start the AI validation agent
   */
  async start() {
    if (this.isRunning) {
      this.log('info', 'AI Validation Agent is already running');
      return;
    }

    this.log('info', 'Starting AI Validation Agent...');
    this.isRunning = true;
    
    // Initialize validation patterns
    await this.initializeValidationPatterns();
    
    // Start background validation loop
    this.startValidationLoop();
    
    // Start real-time monitoring if enabled
    if (this.config.enableRealTimeValidation) {
      this.startRealTimeMonitoring();
    }
    
    this.emit('started');
    this.log('info', 'AI Validation Agent started successfully');
  }

  /**
   * Stop the AI validation agent
   */
  async stop() {
    if (!this.isRunning) {
      this.log('info', 'AI Validation Agent is not running');
      return;
    }

    this.log('info', 'Stopping AI Validation Agent...');
    this.isRunning = false;
    
    // Wait for active validations to complete
    await this.waitForActiveValidations();
    
    this.emit('stopped');
    this.log('info', 'AI Validation Agent stopped successfully');
  }

  /**
   * Initialize AI validation patterns based on historical data
   */
  async initializeValidationPatterns() {
    try {
      // Load historical validation data if exists
      const historyPath = path.join(this.config.rulesPath, 'validation-history.json');
      
      try {
        const historyData = await fs.readFile(historyPath, 'utf8');
        this.validationHistory = JSON.parse(historyData);
        this.log('info', `Loaded ${this.validationHistory.length} historical validations`);
      } catch (error) {
        this.log('info', 'No historical validation data found, starting fresh');
      }
      
      // Analyze patterns from history
      this.analyzeHistoricalPatterns();
      
    } catch (error) {
      this.log('error', `Failed to initialize validation patterns: ${error.message}`);
    }
  }

  /**
   * Analyze historical patterns to improve validation
   */
  analyzeHistoricalPatterns() {
    if (this.validationHistory.length === 0) return;

    // Analyze performance patterns
    const executionTimes = this.validationHistory.map(v => v.executionTime).filter(t => t);
    if (executionTimes.length > 0) {
      const avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxExecutionTime = Math.max(...executionTimes);
      
      // Adjust thresholds based on historical data
      this.validationPatterns.performance.executionTimeThreshold = 
        Math.max(avgExecutionTime * 3, maxExecutionTime * 1.5);
    }

    // Analyze error patterns
    const errorEvents = this.validationHistory.filter(v => v.hasErrors);
    if (errorEvents.length > 0) {
      const errorRate = errorEvents.length / this.validationHistory.length;
      this.validationPatterns.performance.errorRateThreshold = Math.max(errorRate * 2, 0.01);
    }

    this.log('info', 'Updated validation patterns based on historical data');
  }

  /**
   * Start the main validation loop
   */
  startValidationLoop() {
    const validateLoop = async () => {
      if (!this.isRunning) return;
      
      try {
        await this.runScheduledValidations();
      } catch (error) {
        this.log('error', `Validation loop error: ${error.message}`);
      }
      
      // Schedule next validation
      setTimeout(validateLoop, this.config.validationInterval);
    };
    
    validateLoop();
  }

  /**
   * Start real-time monitoring for immediate validation
   */
  startRealTimeMonitoring() {
    this.log('info', 'Real-time monitoring enabled');
  }

  /**
   * Queue a rule execution for validation
   */
  queueValidation(validationRequest) {
    const validation = {
      id: this.generateValidationId(),
      timestamp: new Date().toISOString(),
      type: validationRequest.type || 'rule_execution',
      priority: validationRequest.priority || 'normal',
      data: validationRequest.data,
      status: 'queued'
    };
    
    this.validationQueue.push(validation);
    this.emit('validation_queued', validation);
    
    // Trigger immediate validation for high priority items
    if (validation.priority === 'high' && this.activeValidations.size < this.config.maxConcurrentValidations) {
      setImmediate(() => this.processValidationQueue());
    }
    
    return validation.id;
  }

  /**
   * Run scheduled validations
   */
  async runScheduledValidations() {
    await this.processValidationQueue();
    await this.performSystemHealthCheck();
    await this.analyzeRulePerformance();
    await this.detectAnomalies();
  }

  /**
   * Process the validation queue
   */
  async processValidationQueue() {
    while (this.validationQueue.length > 0 && 
           this.activeValidations.size < this.config.maxConcurrentValidations) {
      
      const validation = this.validationQueue.shift();
      this.activeValidations.add(validation.id);
      
      // Process validation asynchronously
      this.processValidation(validation)
        .then(result => this.handleValidationResult(validation, result))
        .catch(error => this.handleValidationError(validation, error))
        .finally(() => this.activeValidations.delete(validation.id));
    }
  }

  /**
   * Process individual validation
   */
  async processValidation(validation) {
    const startTime = Date.now();
    validation.status = 'processing';
    
    this.log('debug', `Processing validation ${validation.id} of type ${validation.type}`);
    
    let result = {};
    
    switch (validation.type) {
      case 'rule_execution':
        result = await this.validateRuleExecution(validation.data);
        break;
      case 'rule_logic':
        result = await this.validateRuleLogic(validation.data);
        break;
      case 'performance':
        result = await this.validatePerformance(validation.data);
        break;
      case 'security':
        result = await this.validateSecurity(validation.data);
        break;
      case 'data_integrity':
        result = await this.validateDataIntegrity(validation.data);
        break;
      default:
        throw new Error(`Unknown validation type: ${validation.type}`);
    }
    
    result.executionTime = Date.now() - startTime;
    result.validationId = validation.id;
    
    return result;
  }

  /**
   * Validate rule execution results
   */
  async validateRuleExecution(data) {
    const { ruleResult, transactionData, expectedResult } = data;
    
    const validation = {
      passed: true,
      issues: [],
      score: 100,
      details: {}
    };

    // Check execution time
    if (ruleResult.executionTime > this.validationPatterns.performance.executionTimeThreshold) {
      validation.issues.push({
        type: 'performance',
        severity: 'warning',
        message: `Rule execution time (${ruleResult.executionTime}ms) exceeds threshold`,
        suggestion: 'Consider optimizing rule conditions or splitting complex rules'
      });
      validation.score -= 10;
    }

    // Check for errors
    if (ruleResult.error) {
      validation.issues.push({
        type: 'error',
        severity: 'critical',
        message: `Rule execution failed: ${ruleResult.error}`,
        suggestion: 'Review rule syntax and field mappings'
      });
      validation.passed = false;
      validation.score -= 50;
    }

    // Validate result consistency
    if (expectedResult !== undefined && ruleResult.result !== expectedResult) {
      validation.issues.push({
        type: 'accuracy',
        severity: 'high',
        message: `Rule result (${ruleResult.result}) doesn't match expected result (${expectedResult})`,
        suggestion: 'Review rule logic and test cases'
      });
      validation.score -= 30;
    }

    // Check action execution
    if (ruleResult.actions && ruleResult.actions.length > 0) {
      const failedActions = ruleResult.actions.filter(a => !a.success);
      if (failedActions.length > 0) {
        validation.issues.push({
          type: 'action_failure',
          severity: 'high',
          message: `${failedActions.length} actions failed to execute`,
          suggestion: 'Review action configurations and dependencies'
        });
        validation.score -= 20;
      }
    }

    validation.details = {
      ruleId: ruleResult.ruleId,
      executionTime: ruleResult.executionTime,
      actionsExecuted: ruleResult.actions ? ruleResult.actions.length : 0,
      transactionId: transactionData.id
    };

    return validation;
  }

  /**
   * Validate rule logic for consistency and potential issues
   */
  async validateRuleLogic(data) {
    const { rule } = data;
    
    const validation = {
      passed: true,
      issues: [],
      score: 100,
      details: {}
    };

    // Check for logical inconsistencies
    const logicIssues = this.analyzeRuleLogic(rule);
    validation.issues.push(...logicIssues);
    
    // Check for security concerns
    const securityIssues = this.analyzeRuleSecurity(rule);
    validation.issues.push(...securityIssues);
    
    // Calculate score based on issues
    validation.score -= validation.issues.length * 10;
    validation.passed = validation.score >= 70;
    
    validation.details = {
      ruleId: rule.id,
      conditionsCount: this.countConditions(rule.conditions),
      actionsCount: rule.actions ? rule.actions.length : 0
    };

    return validation;
  }

  /**
   * Analyze rule logic for potential issues
   */
  analyzeRuleLogic(rule) {
    const issues = [];
    
    if (!rule.conditions) {
      issues.push({
        type: 'logic',
        severity: 'high',
        message: 'Rule has no conditions',
        suggestion: 'Add appropriate conditions to define when the rule should trigger'
      });
    }
    
    // Check for overly complex conditions
    const conditionComplexity = this.calculateConditionComplexity(rule.conditions);
    if (conditionComplexity > 10) {
      issues.push({
        type: 'complexity',
        severity: 'warning',
        message: `Rule conditions are overly complex (complexity: ${conditionComplexity})`,
        suggestion: 'Consider breaking down into multiple simpler rules'
      });
    }
    
    // Check for contradictory conditions
    const contradictions = this.findContradictoryConditions(rule.conditions);
    if (contradictions.length > 0) {
      issues.push({
        type: 'logic',
        severity: 'critical',
        message: 'Rule contains contradictory conditions',
        suggestion: 'Review and fix logical contradictions in rule conditions'
      });
    }
    
    return issues;
  }

  /**
   * Analyze rule for security concerns
   */
  analyzeRuleSecurity(rule) {
    const issues = [];
    const ruleString = JSON.stringify(rule);
    
    // Check for suspicious patterns
    for (const pattern of this.validationPatterns.security.suspiciousPatterns) {
      if (pattern.test(ruleString)) {
        issues.push({
          type: 'security',
          severity: 'critical',
          message: `Rule contains potentially dangerous pattern: ${pattern.source}`,
          suggestion: 'Remove or replace potentially unsafe expressions'
        });
      }
    }
    
    // Check for data leakage patterns
    for (const pattern of this.validationPatterns.security.dataLeakagePatterns) {
      if (pattern.test(ruleString)) {
        issues.push({
          type: 'security',
          severity: 'warning',
          message: `Rule may expose sensitive data: ${pattern.source}`,
          suggestion: 'Ensure sensitive data is properly masked or excluded'
        });
      }
    }
    
    return issues;
  }

  /**
   * Calculate condition complexity score
   */
  calculateConditionComplexity(conditions, depth = 0) {
    if (!conditions) return 0;
    
    let complexity = depth;
    
    if (conditions.and) {
      complexity += conditions.and.reduce((sum, cond) => 
        sum + this.calculateConditionComplexity(cond, depth + 1), 0);
    } else if (conditions.or) {
      complexity += conditions.or.reduce((sum, cond) => 
        sum + this.calculateConditionComplexity(cond, depth + 1), 0);
    } else if (conditions.not) {
      complexity += this.calculateConditionComplexity(conditions.not, depth + 1) + 1;
    } else {
      complexity += 1;
    }
    
    return complexity;
  }

  /**
   * Find contradictory conditions in rule logic
   */
  findContradictoryConditions(conditions) {
    // Simplified contradiction detection
    const contradictions = [];
    
    // This is a basic implementation - can be enhanced with more sophisticated logic
    const flatConditions = this.flattenConditions(conditions);
    
    for (let i = 0; i < flatConditions.length; i++) {
      for (let j = i + 1; j < flatConditions.length; j++) {
        if (this.areConditionsContradictory(flatConditions[i], flatConditions[j])) {
          contradictions.push([flatConditions[i], flatConditions[j]]);
        }
      }
    }
    
    return contradictions;
  }

  /**
   * Flatten nested conditions for analysis
   */
  flattenConditions(conditions, result = []) {
    if (!conditions) return result;
    
    if (conditions.and) {
      conditions.and.forEach(cond => this.flattenConditions(cond, result));
    } else if (conditions.or) {
      conditions.or.forEach(cond => this.flattenConditions(cond, result));
    } else if (conditions.not) {
      this.flattenConditions(conditions.not, result);
    } else if (conditions.field && conditions.operator) {
      result.push(conditions);
    }
    
    return result;
  }

  /**
   * Check if two conditions are contradictory
   */
  areConditionsContradictory(cond1, cond2) {
    if (cond1.field !== cond2.field) return false;
    
    const contradictoryPairs = [
      ['equals', 'not_equals'],
      ['greater_than', 'less_than_or_equal'],
      ['less_than', 'greater_than_or_equal'],
      ['contains', 'not_contains'],
      ['in', 'not_in']
    ];
    
    return contradictoryPairs.some(([op1, op2]) => 
      (cond1.operator === op1 && cond2.operator === op2) ||
      (cond1.operator === op2 && cond2.operator === op1)
    );
  }

  /**
   * Count total conditions in rule
   */
  countConditions(conditions) {
    if (!conditions) return 0;
    
    if (conditions.and) {
      return conditions.and.reduce((sum, cond) => sum + this.countConditions(cond), 0);
    } else if (conditions.or) {
      return conditions.or.reduce((sum, cond) => sum + this.countConditions(cond), 0);
    } else if (conditions.not) {
      return this.countConditions(conditions.not);
    } else {
      return 1;
    }
  }

  /**
   * Validate performance metrics
   */
  async validatePerformance(data) {
    // Implementation for performance validation
    return {
      passed: true,
      issues: [],
      score: 100,
      details: { type: 'performance' }
    };
  }

  /**
   * Validate security aspects
   */
  async validateSecurity(data) {
    // Implementation for security validation
    return {
      passed: true,
      issues: [],
      score: 100,
      details: { type: 'security' }
    };
  }

  /**
   * Validate data integrity
   */
  async validateDataIntegrity(data) {
    // Implementation for data integrity validation
    return {
      passed: true,
      issues: [],
      score: 100,
      details: { type: 'data_integrity' }
    };
  }

  /**
   * Perform system health check
   */
  async performSystemHealthCheck() {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      queueLength: this.validationQueue.length,
      activeValidations: this.activeValidations.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
    
    this.emit('health_check', healthCheck);
    return healthCheck;
  }

  /**
   * Analyze rule performance trends
   */
  async analyzeRulePerformance() {
    // Analyze performance trends and emit warnings if needed
    for (const [ruleId, metrics] of this.rulePerformanceMetrics) {
      if (metrics.averageExecutionTime > this.validationPatterns.performance.executionTimeThreshold) {
        this.emit('performance_warning', {
          ruleId,
          issue: 'high_execution_time',
          metrics
        });
      }
    }
  }

  /**
   * Detect anomalies in rule behavior
   */
  async detectAnomalies() {
    // Simple anomaly detection - can be enhanced with ML algorithms
    const recentValidations = this.validationHistory.slice(-100);
    
    if (recentValidations.length < 10) return;
    
    const errorRate = recentValidations.filter(v => !v.passed).length / recentValidations.length;
    
    if (errorRate > this.validationPatterns.performance.errorRateThreshold) {
      this.anomalies.push({
        type: 'high_error_rate',
        timestamp: new Date().toISOString(),
        errorRate,
        threshold: this.validationPatterns.performance.errorRateThreshold
      });
      
      this.emit('anomaly_detected', {
        type: 'high_error_rate',
        errorRate,
        threshold: this.validationPatterns.performance.errorRateThreshold
      });
    }
  }

  /**
   * Handle validation result
   */
  async handleValidationResult(validation, result) {
    validation.status = 'completed';
    validation.result = result;
    
    // Add to history
    this.validationHistory.push({
      ...validation,
      result
    });
    
    // Trim history to last 1000 entries
    if (this.validationHistory.length > 1000) {
      this.validationHistory = this.validationHistory.slice(-1000);
    }
    
    // Update performance metrics
    if (result.details && result.details.ruleId) {
      this.updateRulePerformanceMetrics(result.details.ruleId, result);
    }
    
    // Emit validation completed event
    this.emit('validation_completed', validation);
    
    // Save validation history periodically
    if (this.validationHistory.length % 10 === 0) {
      await this.saveValidationHistory();
    }
    
    this.log('debug', `Validation ${validation.id} completed with score ${result.score}`);
  }

  /**
   * Handle validation error
   */
  async handleValidationError(validation, error) {
    validation.status = 'failed';
    validation.error = error.message;
    
    this.validationHistory.push(validation);
    
    this.emit('validation_failed', { validation, error });
    this.log('error', `Validation ${validation.id} failed: ${error.message}`);
  }

  /**
   * Update rule performance metrics
   */
  updateRulePerformanceMetrics(ruleId, result) {
    if (!this.rulePerformanceMetrics.has(ruleId)) {
      this.rulePerformanceMetrics.set(ruleId, {
        executionCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        successCount: 0,
        errorCount: 0,
        lastExecuted: null
      });
    }
    
    const metrics = this.rulePerformanceMetrics.get(ruleId);
    metrics.executionCount++;
    metrics.totalExecutionTime += result.executionTime || 0;
    metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.executionCount;
    metrics.lastExecuted = new Date().toISOString();
    
    if (result.passed) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }
  }

  /**
   * Save validation history to disk
   */
  async saveValidationHistory() {
    try {
      const historyPath = path.join(this.config.rulesPath, 'validation-history.json');
      await fs.writeFile(historyPath, JSON.stringify(this.validationHistory, null, 2));
    } catch (error) {
      this.log('error', `Failed to save validation history: ${error.message}`);
    }
  }

  /**
   * Wait for all active validations to complete
   */
  async waitForActiveValidations() {
    while (this.activeValidations.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Generate unique validation ID
   */
  generateValidationId() {
    return `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log message with timestamp and level
   */
  log(level, message) {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [AI-VALIDATOR] [${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Check if message should be logged based on log level
   */
  shouldLog(level) {
    const levels = { debug: 0, info: 1, warning: 2, error: 3 };
    const configLevel = levels[this.config.logLevel] || 1;
    const messageLevel = levels[level] || 1;
    return messageLevel >= configLevel;
  }

  /**
   * Get validation statistics
   */
  getStatistics() {
    const totalValidations = this.validationHistory.length;
    const passedValidations = this.validationHistory.filter(v => v.result && v.result.passed).length;
    
    return {
      totalValidations,
      passedValidations,
      failedValidations: totalValidations - passedValidations,
      successRate: totalValidations > 0 ? (passedValidations / totalValidations) * 100 : 0,
      queueLength: this.validationQueue.length,
      activeValidations: this.activeValidations.size,
      ruleMetrics: Object.fromEntries(this.rulePerformanceMetrics),
      anomalies: this.anomalies.slice(-10) // Last 10 anomalies
    };
  }
}

module.exports = AIValidationAgent; 