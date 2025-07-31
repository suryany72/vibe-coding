const moment = require('moment');

class TransactionDetailsModel {
  constructor() {
    // Restricted countries for compliance and sanctions
    this.restrictedCountries = [
      'AF', // Afghanistan
      'BY', // Belarus  
      'MM', // Myanmar
      'KP', // North Korea
      'IR', // Iran
      'IQ', // Iraq
      'LY', // Libya
      'ML', // Mali
      'NI', // Nicaragua
      'RU', // Russia
      'SO', // Somalia
      'SS', // South Sudan
      'SD', // Sudan
      'SY', // Syria
      'VE', // Venezuela
      'YE', // Yemen
      'ZW'  // Zimbabwe
    ];
    
    // High-risk countries requiring additional scrutiny
    this.highRiskCountries = [
      'PK', // Pakistan
      'BD', // Bangladesh
      'NG', // Nigeria
      'GH', // Ghana
      'KE', // Kenya
      'UG', // Uganda
      'TZ', // Tanzania
      'ZA', // South Africa
      'EG', // Egypt
      'MA', // Morocco
      'DZ', // Algeria
      'TN', // Tunisia
      'LB', // Lebanon
      'JO', // Jordan
      'TR', // Turkey
      'ID', // Indonesia
      'MY', // Malaysia
      'TH', // Thailand
      'PH', // Philippines
      'VN', // Vietnam
      'LA', // Laos
      'KH', // Cambodia
      'MN', // Mongolia
      'KZ', // Kazakhstan
      'UZ', // Uzbekistan
      'TJ', // Tajikistan
      'KG', // Kyrgyzstan
      'TM', // Turkmenistan
      'AZ', // Azerbaijan
      'AM', // Armenia
      'GE', // Georgia
      'MD', // Moldova
      'UA', // Ukraine
      'AL', // Albania
      'BA', // Bosnia and Herzegovina
      'XK', // Kosovo
      'MK', // North Macedonia
      'ME', // Montenegro
      'RS', // Serbia
      'BG', // Bulgaria
      'RO', // Romania
      'HU', // Hungary
      'SK', // Slovakia
      'PL', // Poland
      'LT', // Lithuania
      'LV', // Latvia
      'EE'  // Estonia
    ];
    
    // Supported currencies with risk levels
    this.currencies = {
      'USD': { risk: 'low', name: 'US Dollar' },
      'EUR': { risk: 'low', name: 'Euro' },
      'GBP': { risk: 'low', name: 'British Pound' },
      'JPY': { risk: 'low', name: 'Japanese Yen' },
      'CHF': { risk: 'low', name: 'Swiss Franc' },
      'CAD': { risk: 'low', name: 'Canadian Dollar' },
      'AUD': { risk: 'low', name: 'Australian Dollar' },
      'SEK': { risk: 'low', name: 'Swedish Krona' },
      'NOK': { risk: 'low', name: 'Norwegian Krone' },
      'DKK': { risk: 'low', name: 'Danish Krone' },
      'SGD': { risk: 'medium', name: 'Singapore Dollar' },
      'HKD': { risk: 'medium', name: 'Hong Kong Dollar' },
      'INR': { risk: 'medium', name: 'Indian Rupee' },
      'CNY': { risk: 'medium', name: 'Chinese Yuan' },
      'KRW': { risk: 'medium', name: 'South Korean Won' },
      'BRL': { risk: 'medium', name: 'Brazilian Real' },
      'MXN': { risk: 'medium', name: 'Mexican Peso' },
      'ZAR': { risk: 'high', name: 'South African Rand' },
      'TRY': { risk: 'high', name: 'Turkish Lira' },
      'RUB': { risk: 'restricted', name: 'Russian Ruble' },
      'IRR': { risk: 'restricted', name: 'Iranian Rial' }
    };
    
    // Banking network mappings
    this.bankingNetworks = {
      'SWIFT': { regions: ['global'], risk: 'low' },
      'SEPA': { regions: ['EU'], risk: 'low' },
      'ACH': { regions: ['US'], risk: 'low' },
      'RTGS': { regions: ['IN'], risk: 'medium' },
      'NEFT': { regions: ['IN'], risk: 'medium' },
      'IMPS': { regions: ['IN'], risk: 'medium' },
      'UPI': { regions: ['IN'], risk: 'medium' },
      'CIPS': { regions: ['CN'], risk: 'high' },
      'SPFS': { regions: ['RU'], risk: 'restricted' }
    };
  }

  /**
   * Create enhanced transaction with comprehensive banking details
   */
  createEnhancedTransaction(basicTransaction) {
    const enhanced = {
      ...basicTransaction,
      id: basicTransaction.id || this.generateTransactionId(),
      timestamp: basicTransaction.timestamp || new Date().toISOString(),
      
      // Source (From) Details
      from: {
        country: basicTransaction.from?.country || 'US',
        bank: {
          name: basicTransaction.from?.bank?.name || 'Unknown Bank',
          code: basicTransaction.from?.bank?.code || this.generateBankCode(),
          swiftCode: basicTransaction.from?.bank?.swiftCode || this.generateSwiftCode(),
          ifscCode: basicTransaction.from?.bank?.ifscCode || null,
          routingNumber: basicTransaction.from?.bank?.routingNumber || null,
          sortCode: basicTransaction.from?.bank?.sortCode || null
        },
        account: {
          number: basicTransaction.from?.account?.number || this.generateAccountNumber(),
          holderName: basicTransaction.from?.account?.holderName || 'Test Account Holder',
          type: basicTransaction.from?.account?.type || 'savings',
          currency: basicTransaction.from?.account?.currency || 'USD'
        },
        address: {
          street: basicTransaction.from?.address?.street || '123 Main Street',
          city: basicTransaction.from?.address?.city || 'New York',
          state: basicTransaction.from?.address?.state || 'NY',
          postalCode: basicTransaction.from?.address?.postalCode || '10001',
          country: basicTransaction.from?.country || 'US'
        }
      },
      
      // Destination (To) Details
      to: {
        country: basicTransaction.to?.country || 'IN',
        bank: {
          name: basicTransaction.to?.bank?.name || 'Unknown Bank',
          code: basicTransaction.to?.bank?.code || this.generateBankCode(),
          swiftCode: basicTransaction.to?.bank?.swiftCode || this.generateSwiftCode(),
          ifscCode: basicTransaction.to?.bank?.ifscCode || this.generateIfscCode(),
          routingNumber: basicTransaction.to?.bank?.routingNumber || null,
          sortCode: basicTransaction.to?.bank?.sortCode || null
        },
        account: {
          number: basicTransaction.to?.account?.number || this.generateAccountNumber(),
          holderName: basicTransaction.to?.account?.holderName || 'Recipient Name',
          type: basicTransaction.to?.account?.type || 'savings',
          currency: basicTransaction.to?.account?.currency || 'INR'
        },
        address: {
          street: basicTransaction.to?.address?.street || '456 Market Road',
          city: basicTransaction.to?.address?.city || 'Mumbai',
          state: basicTransaction.to?.address?.state || 'Maharashtra',
          postalCode: basicTransaction.to?.address?.postalCode || '400001',
          country: basicTransaction.to?.country || 'IN'
        }
      },
      
      // Transaction Details
      transaction: {
        amount: basicTransaction.amount,
        currency: basicTransaction.currency || 'USD',
        exchangeRate: this.getExchangeRate(basicTransaction.currency || 'USD', basicTransaction.to?.account?.currency || 'INR'),
        convertedAmount: this.convertAmount(basicTransaction.amount, basicTransaction.currency || 'USD', basicTransaction.to?.account?.currency || 'INR'),
        fees: this.calculateFees(basicTransaction.amount, basicTransaction.from?.country || 'US', basicTransaction.to?.country || 'IN'),
        network: this.determineNetwork(basicTransaction.from?.country || 'US', basicTransaction.to?.country || 'IN'),
        purpose: basicTransaction.purpose || 'family_support',
        reference: basicTransaction.reference || this.generateReference(),
        urgency: basicTransaction.urgency || 'standard'
      },
      
      // Compliance and Risk Assessment
      compliance: {
        fromCountryRisk: this.assessCountryRisk(basicTransaction.from?.country || 'US'),
        toCountryRisk: this.assessCountryRisk(basicTransaction.to?.country || 'IN'),
        currencyRisk: this.assessCurrencyRisk(basicTransaction.currency || 'USD'),
        amountRisk: this.assessAmountRisk(basicTransaction.amount),
        isRestricted: this.isTransactionRestricted(basicTransaction.from?.country || 'US', basicTransaction.to?.country || 'IN'),
        requiresManualReview: false,
        sanctionsCheck: this.performSanctionsCheck(basicTransaction),
        amlFlags: this.checkAMLFlags(basicTransaction)
      },
      
      // Metadata
      metadata: {
        createdAt: new Date().toISOString(),
        source: 'enhanced_api',
        version: '2.0',
        processedBy: 'ai_rules_validator',
        riskScore: 0,
        ...basicTransaction.metadata
      }
    };
    
    // Calculate overall risk assessment
    enhanced.compliance.requiresManualReview = this.requiresManualReview(enhanced);
    enhanced.metadata.riskScore = this.calculateOverallRiskScore(enhanced);
    
    return enhanced;
  }

  /**
   * Generate transaction ID
   */
  generateTransactionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `TXN_${timestamp}_${random}`;
  }

  /**
   * Generate bank code
   */
  generateBankCode() {
    return 'BNK' + Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  /**
   * Generate SWIFT code
   */
  generateSwiftCode() {
    const bankCode = Math.random().toString(36).substr(2, 4).toUpperCase();
    const countryCode = 'US';
    const locationCode = Math.random().toString(36).substr(2, 2).toUpperCase();
    return `${bankCode}${countryCode}${locationCode}`;
  }

  /**
   * Generate IFSC code for Indian banks
   */
  generateIfscCode() {
    const bankCode = Math.random().toString(36).substr(2, 4).toUpperCase();
    const branchCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${bankCode}0${branchCode}`;
  }

  /**
   * Generate account number
   */
  generateAccountNumber() {
    return Math.floor(Math.random() * 9000000000000000) + 1000000000000000;
  }

  /**
   * Generate reference number
   */
  generateReference() {
    return 'REF' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  /**
   * Assess country risk level
   */
  assessCountryRisk(countryCode) {
    if (this.restrictedCountries.includes(countryCode)) {
      return 'restricted';
    } else if (this.highRiskCountries.includes(countryCode)) {
      return 'high';
    } else {
      return 'low';
    }
  }

  /**
   * Assess currency risk
   */
  assessCurrencyRisk(currencyCode) {
    const currency = this.currencies[currencyCode];
    return currency ? currency.risk : 'unknown';
  }

  /**
   * Assess amount risk
   */
  assessAmountRisk(amount) {
    if (amount >= 100000) return 'very_high';
    if (amount >= 50000) return 'high';
    if (amount >= 10000) return 'medium';
    if (amount >= 1000) return 'low';
    return 'minimal';
  }

  /**
   * Check if transaction is restricted
   */
  isTransactionRestricted(fromCountry, toCountry) {
    return this.restrictedCountries.includes(fromCountry) || 
           this.restrictedCountries.includes(toCountry);
  }

  /**
   * Determine appropriate banking network
   */
  determineNetwork(fromCountry, toCountry) {
    if (fromCountry === 'US' && toCountry === 'US') return 'ACH';
    if (fromCountry === 'IN' && toCountry === 'IN') return 'RTGS';
    if (['US', 'EU', 'GB'].includes(fromCountry) && ['US', 'EU', 'GB'].includes(toCountry)) return 'SWIFT';
    return 'SWIFT'; // Default international network
  }

  /**
   * Get exchange rate (simplified)
   */
  getExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return 1.0;
    
    // Simplified exchange rates - in production, this would call a real FX API
    const rates = {
      'USD_INR': 83.25,
      'USD_EUR': 0.85,
      'USD_GBP': 0.73,
      'EUR_INR': 97.94,
      'GBP_INR': 114.04
    };
    
    const pair = `${fromCurrency}_${toCurrency}`;
    const reversePair = `${toCurrency}_${fromCurrency}`;
    
    if (rates[pair]) return rates[pair];
    if (rates[reversePair]) return 1 / rates[reversePair];
    
    return 1.0; // Default if rate not found
  }

  /**
   * Convert amount between currencies
   */
  convertAmount(amount, fromCurrency, toCurrency) {
    const rate = this.getExchangeRate(fromCurrency, toCurrency);
    return Math.round(amount * rate * 100) / 100;
  }

  /**
   * Calculate transaction fees
   */
  calculateFees(amount, fromCountry, toCountry) {
    let baseFee = 5.00; // Base fee in USD
    let percentageFee = 0.01; // 1% default
    
    // Domestic transactions have lower fees
    if (fromCountry === toCountry) {
      baseFee = 1.00;
      percentageFee = 0.005; // 0.5%
    }
    
    // High-risk countries have higher fees
    if (this.highRiskCountries.includes(toCountry)) {
      baseFee += 10.00;
      percentageFee += 0.01; // Additional 1%
    }
    
    const calculatedFee = baseFee + (amount * percentageFee);
    
    return {
      baseFee,
      percentageFee: percentageFee * 100, // Convert to percentage
      calculatedFee: Math.round(calculatedFee * 100) / 100,
      currency: 'USD'
    };
  }

  /**
   * Perform sanctions check
   */
  performSanctionsCheck(transaction) {
    const flags = [];
    
    // Check sender name against basic sanctions list
    const senderName = transaction.from?.account?.holderName?.toLowerCase() || '';
    const recipientName = transaction.to?.account?.holderName?.toLowerCase() || '';
    
    const sanctionedNames = [
      'john doe sanction',
      'test blocked',
      'sanctioned person',
      'blocked entity'
    ];
    
    sanctionedNames.forEach(name => {
      if (senderName.includes(name) || recipientName.includes(name)) {
        flags.push(`Potential sanctions match: ${name}`);
      }
    });
    
    return {
      checked: true,
      checkedAt: new Date().toISOString(),
      flags,
      status: flags.length > 0 ? 'flagged' : 'clear'
    };
  }

  /**
   * Check AML flags
   */
  checkAMLFlags(transaction) {
    const flags = [];
    
    // Round amount patterns (potential structuring)
    if (transaction.amount % 1000 === 0 && transaction.amount >= 9000) {
      flags.push('Round amount near reporting threshold');
    }
    
    // High-risk country combinations
    const fromRisk = this.assessCountryRisk(transaction.from?.country || 'US');
    const toRisk = this.assessCountryRisk(transaction.to?.country || 'IN');
    
    if (fromRisk === 'high' && toRisk === 'high') {
      flags.push('High-risk country to high-risk country transfer');
    }
    
    // Velocity patterns would be checked here in production
    
    return {
      checked: true,
      checkedAt: new Date().toISOString(),
      flags,
      riskLevel: flags.length > 2 ? 'high' : flags.length > 0 ? 'medium' : 'low'
    };
  }

  /**
   * Determine if transaction requires manual review
   */
  requiresManualReview(transaction) {
    const conditions = [
      transaction.compliance.isRestricted,
      transaction.compliance.fromCountryRisk === 'restricted',
      transaction.compliance.toCountryRisk === 'restricted',
      transaction.compliance.currencyRisk === 'restricted',
      transaction.compliance.amountRisk === 'very_high',
      transaction.compliance.sanctionsCheck.status === 'flagged',
      transaction.compliance.amlFlags.riskLevel === 'high',
      transaction.transaction.amount >= 100000
    ];
    
    return conditions.some(condition => condition);
  }

  /**
   * Calculate overall risk score (0-100)
   */
  calculateOverallRiskScore(transaction) {
    let score = 0;
    
    // Country risk scoring
    const countryRiskScores = { 'low': 5, 'medium': 15, 'high': 30, 'restricted': 50 };
    score += countryRiskScores[transaction.compliance.fromCountryRisk] || 0;
    score += countryRiskScores[transaction.compliance.toCountryRisk] || 0;
    
    // Currency risk scoring
    const currencyRiskScores = { 'low': 2, 'medium': 8, 'high': 15, 'restricted': 25 };
    score += currencyRiskScores[transaction.compliance.currencyRisk] || 0;
    
    // Amount risk scoring
    const amountRiskScores = { 'minimal': 1, 'low': 3, 'medium': 8, 'high': 15, 'very_high': 25 };
    score += amountRiskScores[transaction.compliance.amountRisk] || 0;
    
    // AML flags
    if (transaction.compliance.amlFlags.riskLevel === 'high') score += 20;
    else if (transaction.compliance.amlFlags.riskLevel === 'medium') score += 10;
    
    // Sanctions flags
    if (transaction.compliance.sanctionsCheck.status === 'flagged') score += 30;
    
    // Restriction penalty
    if (transaction.compliance.isRestricted) score += 40;
    
    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Validate banking details
   */
  validateBankingDetails(transaction) {
    const errors = [];
    
    // Validate IFSC code format for Indian banks
    if (transaction.to.country === 'IN' && transaction.to.bank.ifscCode) {
      const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscPattern.test(transaction.to.bank.ifscCode)) {
        errors.push('Invalid IFSC code format');
      }
    }
    
    // Validate SWIFT code format
    const swiftPattern = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
    if (transaction.from.bank.swiftCode && !swiftPattern.test(transaction.from.bank.swiftCode)) {
      errors.push('Invalid SWIFT code format for sender bank');
    }
    
    if (transaction.to.bank.swiftCode && !swiftPattern.test(transaction.to.bank.swiftCode)) {
      errors.push('Invalid SWIFT code format for recipient bank');
    }
    
    // Validate account numbers (basic length check)
    if (transaction.from.account.number.toString().length < 8) {
      errors.push('Sender account number too short');
    }
    
    if (transaction.to.account.number.toString().length < 8) {
      errors.push('Recipient account number too short');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = TransactionDetailsModel; 