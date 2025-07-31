const _ = require('lodash');
const moment = require('moment');

class RuleProcessor {
  constructor() {
    this.operators = {
      'equals': (a, b) => a === b,
      'not_equals': (a, b) => a !== b,
      'greater_than': (a, b) => parseFloat(a) > parseFloat(b),
      'less_than': (a, b) => parseFloat(a) < parseFloat(b),
      'greater_than_or_equal': (a, b) => parseFloat(a) >= parseFloat(b),
      'less_than_or_equal': (a, b) => parseFloat(a) <= parseFloat(b),
      'contains': (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
      'not_contains': (a, b) => !String(a).toLowerCase().includes(String(b).toLowerCase()),
      'in': (a, b) => Array.isArray(b) ? b.includes(a) : false,
      'not_in': (a, b) => Array.isArray(b) ? !b.includes(a) : true,
      'starts_with': (a, b) => String(a).toLowerCase().startsWith(String(b).toLowerCase()),
      'ends_with': (a, b) => String(a).toLowerCase().endsWith(String(b).toLowerCase()),
      'is_empty': (a) => !a || a === '' || (Array.isArray(a) && a.length === 0),
      'is_not_empty': (a) => !(!a || a === '' || (Array.isArray(a) && a.length === 0)),
      'date_before': (a, b) => moment(a).isBefore(moment(b)),
      'date_after': (a, b) => moment(a).isAfter(moment(b)),
      'date_between': (a, b) => {
        const date = moment(a);
        return date.isBetween(moment(b.start), moment(b.end), null, '[]');
      }
    };
  }

  /**
   * Load rules from JSON configuration
   */
  loadRules(rulesConfig) {
    try {
      if (typeof rulesConfig === 'string') {
        return JSON.parse(rulesConfig);
      }
      return rulesConfig;
    } catch (error) {
      throw new Error(`Invalid rules configuration: ${error.message}`);
    }
  }

  /**
   * Convert JSON conditions to executable expressions
   */
  parseCondition(condition, context = {}) {
    if (!condition) return false;

    // Handle logical operators
    if (condition.and) {
      return condition.and.every(subCondition => this.parseCondition(subCondition, context));
    }

    if (condition.or) {
      return condition.or.some(subCondition => this.parseCondition(subCondition, context));
    }

    if (condition.not) {
      return !this.parseCondition(condition.not, context);
    }

    // Handle field-based conditions
    const { field, operator, value } = condition;
    
    if (!field || !operator) {
      throw new Error('Condition must have field and operator');
    }

    const fieldValue = this.getFieldValue(field, context);
    const operatorFunc = this.operators[operator];

    if (!operatorFunc) {
      throw new Error(`Unsupported operator: ${operator}`);
    }

    return operatorFunc(fieldValue, value);
  }

  /**
   * Get field value from context using dot notation
   */
  getFieldValue(field, context) {
    return _.get(context, field);
  }

  /**
   * Evaluate a complete rule against transaction data
   */
  evaluateRule(rule, transactionData) {
    const startTime = Date.now();
    
    try {
      const result = {
        ruleId: rule.id,
        ruleName: rule.name,
        result: false,
        actions: [],
        executionTime: 0,
        error: null,
        timestamp: new Date().toISOString(),
        transactionId: transactionData.id
      };

      // Evaluate conditions
      if (rule.conditions) {
        result.result = this.parseCondition(rule.conditions, transactionData);
      }

      // Execute actions if conditions pass
      if (result.result && rule.actions) {
        result.actions = this.executeActions(rule.actions, transactionData);
      }

      result.executionTime = Date.now() - startTime;
      return result;

    } catch (error) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        result: false,
        actions: [],
        executionTime: Date.now() - startTime,
        error: error.message,
        timestamp: new Date().toISOString(),
        transactionId: transactionData.id
      };
    }
  }

  /**
   * Execute rule actions
   */
  executeActions(actions, transactionData) {
    const executedActions = [];

    for (const action of actions) {
      try {
        const actionResult = this.executeAction(action, transactionData);
        executedActions.push({
          type: action.type,
          config: action.config,
          result: actionResult,
          success: true
        });
      } catch (error) {
        executedActions.push({
          type: action.type,
          config: action.config,
          result: null,
          success: false,
          error: error.message
        });
      }
    }

    return executedActions;
  }

  /**
   * Execute individual action
   */
  executeAction(action, transactionData) {
    switch (action.type) {
      case 'flag_transaction':
        return { flagged: true, reason: action.config.reason };
      
      case 'send_notification':
        return { 
          notification_sent: true, 
          recipient: action.config.recipient,
          message: this.interpolateMessage(action.config.message, transactionData)
        };
      
      case 'calculate_score':
        return { 
          score: this.calculateRiskScore(action.config, transactionData),
          threshold: action.config.threshold
        };
      
      case 'log_event':
        return { 
          logged: true, 
          event: action.config.event,
          data: transactionData
        };
      
      case 'reject_transaction':
        return { 
          rejected: true, 
          reason: action.config.reason 
        };
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Interpolate message templates with transaction data
   */
  interpolateMessage(template, data) {
    return template.replace(/\{([^}]+)\}/g, (match, field) => {
      return this.getFieldValue(field, data) || match;
    });
  }

  /**
   * Calculate risk score based on configuration
   */
  calculateRiskScore(config, transactionData) {
    let score = 0;
    
    for (const factor of config.factors || []) {
      const fieldValue = this.getFieldValue(factor.field, transactionData);
      const weight = factor.weight || 1;
      
      if (factor.ranges) {
        for (const range of factor.ranges) {
          if (fieldValue >= range.min && fieldValue <= range.max) {
            score += range.points * weight;
            break;
          }
        }
      }
    }
    
    return Math.min(Math.max(score, 0), 100); // Normalize to 0-100
  }

  /**
   * Process multiple rules against transaction data
   */
  processTransaction(rules, transactionData) {
    const results = [];
    
    for (const rule of rules) {
      if (rule.enabled !== false) {
        const result = this.evaluateRule(rule, transactionData);
        results.push(result);
      }
    }
    
    return {
      transactionId: transactionData.id,
      timestamp: new Date().toISOString(),
      totalRules: results.length,
      passedRules: results.filter(r => r.result).length,
      failedRules: results.filter(r => !r.result).length,
      errors: results.filter(r => r.error).length,
      results: results
    };
  }
}

module.exports = RuleProcessor; 