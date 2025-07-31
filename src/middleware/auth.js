const UserManagement = require('../models/user-management');

class AuthMiddleware {
  constructor() {
    this.userManagement = new UserManagement();
  }

  /**
   * Verify JWT token middleware
   */
  verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.token ||
                  req.query.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    try {
      const { user, decoded } = this.userManagement.verifyToken(token);
      req.user = user;
      req.decoded = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Check if user has required permission
   */
  requirePermission = (permission) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!this.userManagement.hasPermission(req.user.role, permission)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required permission: ${permission}`
        });
      }

      next();
    };
  };

  /**
   * Check if user has any of the required permissions
   */
  requireAnyPermission = (permissions) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const hasPermission = permissions.some(permission => 
        this.userManagement.hasPermission(req.user.role, permission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required permissions: ${permissions.join(' or ')}`
        });
      }

      next();
    };
  };

  /**
   * Check if user has specific role
   */
  requireRole = (roles) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required roles: ${allowedRoles.join(' or ')}`
        });
      }

      next();
    };
  };

  /**
   * Optional authentication - sets user if token is present but doesn't require it
   */
  optionalAuth = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.token ||
                  req.query.token;

    if (token) {
      try {
        const { user, decoded } = this.userManagement.verifyToken(token);
        req.user = user;
        req.decoded = decoded;
      } catch (error) {
        // Token is invalid but we don't reject the request
        req.user = null;
      }
    }

    next();
  };

  /**
   * Filter response data based on user permissions
   */
  filterResponse = (dataType) => {
    return (req, res, next) => {
      const originalJson = res.json;
      
      res.json = function(data) {
        if (req.user && data && data.success !== false) {
          // Filter data based on user permissions
          const filteredData = req.app.locals.userManagement.filterDataByPermissions(
            req.user.role, 
            data, 
            dataType
          );
          
          if (filteredData !== null) {
            data = filteredData;
          }
        }
        
        originalJson.call(this, data);
      };
      
      next();
    };
  };
}

module.exports = AuthMiddleware; 