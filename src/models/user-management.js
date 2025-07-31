const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class UserManagement {
  constructor() {
    // User roles and their permissions
    this.roles = {
      'user': {
        name: 'User',
        permissions: [
          'view_own_transactions',
          'create_transaction'
        ],
        uiComponents: [
          'transaction_form',
          'own_transaction_history'
        ],
        description: 'Basic user with transaction capabilities'
      },
      'tester': {
        name: 'Tester',
        permissions: [
          'view_own_transactions',
          'create_transaction',
          'create_test_transaction',
          'view_test_scenarios',
          'view_validation_results'
        ],
        uiComponents: [
          'transaction_form',
          'test_transaction_form',
          'test_scenarios',
          'own_transaction_history',
          'validation_results'
        ],
        description: 'Tester with access to test scenarios and validation'
      },
      'admin': {
        name: 'Admin',
        permissions: [
          'view_all_transactions',
          'view_system_stats',
          'view_ai_validations',
          'manage_rules',
          'view_anomalies',
          'manage_users'
        ],
        uiComponents: [
          'system_stats',
          'transaction_statistics',
          'ai_validation_panel',
          'rules_management',
          'anomaly_dashboard',
          'user_management'
        ],
        description: 'Administrator with system monitoring capabilities'
      },
      'super_admin': {
        name: 'Super Admin',
        permissions: [
          'view_own_transactions',
          'create_transaction',
          'create_test_transaction',
          'view_test_scenarios',
          'view_validation_results',
          'view_all_transactions',
          'view_system_stats',
          'view_ai_validations',
          'manage_rules',
          'view_anomalies',
          'manage_users',
          'system_configuration',
          'view_logs',
          'backup_restore'
        ],
        uiComponents: [
          'transaction_form',
          'test_transaction_form',
          'test_scenarios',
          'own_transaction_history',
          'validation_results',
          'system_stats',
          'transaction_statistics',
          'ai_validation_panel',
          'rules_management',
          'anomaly_dashboard',
          'user_management',
          'system_configuration',
          'activity_logs',
          'backup_panel'
        ],
        description: 'Full system access with all capabilities'
      }
    };

    // Default users for demo/testing
    this.users = new Map([
      ['user123', {
        id: 'user123',
        username: 'user123',
        email: 'user@company.com',
        passwordHash: '$2b$10$rOz8vH7mXZk5Y4H5Y4H5YOzC7r7r7r7r7r7r7r7r7r7r7r7r7r7r7r', // password123
        role: 'user',
        firstName: 'John',
        lastName: 'User',
        department: 'Finance',
        createdAt: new Date('2024-01-01'),
        lastLogin: null,
        isActive: true,
        preferences: {
          theme: 'light',
          notifications: true
        }
      }],
      ['tester456', {
        id: 'tester456',
        username: 'tester456',
        email: 'tester@company.com',
        passwordHash: '$2b$10$rOz8vH7mXZk5Y4H5Y4H5YOzC7r7r7r7r7r7r7r7r7r7r7r7r7r7r7r', // password123
        role: 'tester',
        firstName: 'Jane',
        lastName: 'Tester',
        department: 'QA',
        createdAt: new Date('2024-01-01'),
        lastLogin: null,
        isActive: true,
        preferences: {
          theme: 'dark',
          notifications: true
        }
      }],
      ['admin789', {
        id: 'admin789',
        username: 'admin789',
        email: 'admin@company.com',
        passwordHash: '$2b$10$rOz8vH7mXZk5Y4H5Y4H5YOzC7r7r7r7r7r7r7r7r7r7r7r7r7r7r7r', // password123
        role: 'admin',
        firstName: 'Bob',
        lastName: 'Admin',
        department: 'IT',
        createdAt: new Date('2024-01-01'),
        lastLogin: null,
        isActive: true,
        preferences: {
          theme: 'light',
          notifications: true
        }
      }],
      ['superadmin', {
        id: 'superadmin',
        username: 'superadmin',
        email: 'superadmin@company.com',
        passwordHash: '$2b$10$rOz8vH7mXZk5Y4H5Y4H5YOzC7r7r7r7r7r7r7r7r7r7r7r7r7r7r7r', // password123
        role: 'super_admin',
        firstName: 'Alice',
        lastName: 'SuperAdmin',
        department: 'Executive',
        createdAt: new Date('2024-01-01'),
        lastLogin: null,
        isActive: true,
        preferences: {
          theme: 'dark',
          notifications: true
        }
      }]
    ]);

    this.jwtSecret = process.env.JWT_SECRET || 'ai-rules-validator-secret-key';
    this.jwtExpiry = '24h';
  }

  /**
   * Authenticate user with username and password
   */
  async authenticateUser(username, password) {
    const user = this.users.get(username);
    
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('User account is disabled');
    }

    // For demo purposes, we'll use simple password check
    // In production, use bcrypt.compare(password, user.passwordHash)
    const isValidPassword = password === 'password123';
    
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Update last login
    user.lastLogin = new Date();

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: this.roles[user.role].permissions
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiry }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        roleName: this.roles[user.role].name,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        permissions: this.roles[user.role].permissions,
        uiComponents: this.roles[user.role].uiComponents,
        preferences: user.preferences
      },
      token,
      expiresIn: this.jwtExpiry
    };
  }

  /**
   * Verify JWT token and return user info
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      const user = this.users.get(decoded.username);
      
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          roleName: this.roles[user.role].name,
          firstName: user.firstName,
          lastName: user.lastName,
          department: user.department,
          permissions: this.roles[user.role].permissions,
          uiComponents: this.roles[user.role].uiComponents,
          preferences: user.preferences
        },
        decoded
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(userRole, permission) {
    const role = this.roles[userRole];
    return role && role.permissions.includes(permission);
  }

  /**
   * Check if user can access UI component
   */
  canAccessComponent(userRole, component) {
    const role = this.roles[userRole];
    return role && role.uiComponents.includes(component);
  }

  /**
   * Get all users (admin only)
   */
  getAllUsers() {
    return Array.from(this.users.values()).map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      roleName: this.roles[user.role].name,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      isActive: user.isActive
    }));
  }

  /**
   * Create new user (admin only)
   */
  async createUser(userData) {
    const { username, email, password, role, firstName, lastName, department } = userData;

    if (this.users.has(username)) {
      throw new Error('Username already exists');
    }

    if (!this.roles[role]) {
      throw new Error('Invalid role specified');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      id: `user_${Date.now()}`,
      username,
      email,
      passwordHash,
      role,
      firstName,
      lastName,
      department,
      createdAt: new Date(),
      lastLogin: null,
      isActive: true,
      preferences: {
        theme: 'light',
        notifications: true
      }
    };

    this.users.set(username, newUser);

    return {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      roleName: this.roles[newUser.role].name,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      department: newUser.department,
      createdAt: newUser.createdAt,
      isActive: newUser.isActive
    };
  }

  /**
   * Update user (admin only)
   */
  updateUser(username, updates) {
    const user = this.users.get(username);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Only allow specific fields to be updated
    const allowedUpdates = ['email', 'role', 'firstName', 'lastName', 'department', 'isActive'];
    
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        if (key === 'role' && !this.roles[updates[key]]) {
          throw new Error('Invalid role specified');
        }
        user[key] = updates[key];
      }
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      roleName: this.roles[user.role].name,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      isActive: user.isActive
    };
  }

  /**
   * Get role information
   */
  getRoleInfo(roleName) {
    return this.roles[roleName];
  }

  /**
   * Get all available roles
   */
  getAllRoles() {
    return Object.keys(this.roles).map(key => ({
      key,
      name: this.roles[key].name,
      description: this.roles[key].description,
      permissions: this.roles[key].permissions,
      uiComponents: this.roles[key].uiComponents
    }));
  }

  /**
   * Filter data based on user permissions
   */
  filterDataByPermissions(userRole, data, dataType) {
    const role = this.roles[userRole];
    
    if (!role) {
      return null;
    }

    switch (dataType) {
      case 'transactions':
        if (role.permissions.includes('view_all_transactions')) {
          return data;
        } else if (role.permissions.includes('view_own_transactions')) {
          // In a real system, filter by user ID
          return data.slice(0, 5); // Limit for demo
        }
        return [];

      case 'system_stats':
        if (role.permissions.includes('view_system_stats')) {
          return data;
        }
        return null;

      case 'ai_validations':
        if (role.permissions.includes('view_ai_validations')) {
          return data;
        }
        return null;

      case 'rules':
        if (role.permissions.includes('manage_rules')) {
          return data;
        }
        return null;

      default:
        return data;
    }
  }
}

module.exports = UserManagement; 