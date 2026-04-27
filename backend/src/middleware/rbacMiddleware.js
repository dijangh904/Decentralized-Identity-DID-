const RBACService = require('../services/rbacService');

class RBACMiddleware {
  constructor() {
    this.rbacService = new RBACService();
    
    // Initialize default users for demonstration
    this.initializeDefaultUsers();
  }

  // Initialize default users (in production, use database)
  initializeDefaultUsers() {
    // Default admin user
    this.rbacService.assignRole('admin-user', 'SUPER_ADMIN');
    
    // Default service accounts
    this.rbacService.assignRole('service-account', 'ADMIN');
    this.rbacService.assignRole('governor-account', 'GOVERNOR');
    this.rbacService.assignRole('guardian-account', 'GUARDIAN');
    this.rbacService.assignRole('auditor-account', 'AUDITOR');
  }

  // Authentication middleware
  authenticate() {
    return (req, res, next) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'No token provided'
          });
        }

        const user = this.rbacService.extractUserFromToken(token);
        req.user = user;
        req.userId = user.userId || user.sub;
        req.userRole = this.rbacService.getUserRole(req.userId);
        req.userPermissions = this.rbacService.getUserPermissions(req.userId);
        
        next();
      } catch (error) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token'
        });
      }
    };
  }

  // Permission checking middleware
  requirePermission(permission) {
    return this.rbacService.requirePermission(permission);
  }

  // Multiple permissions (any of them)
  requireAnyPermission(permissions) {
    return this.rbacService.requireAnyPermission(permissions);
  }

  // All permissions required
  requireAllPermissions(permissions) {
    return this.rbacService.requireAllPermissions(permissions);
  }

  // Resource-based access control
  requireResourceAccess(resource, action) {
    return this.rbacService.requireResourceAccess(resource, action);
  }

  // Role-based access control
  requireRole(role) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      if (req.userRole !== role) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Role '${role}' required`
        });
      }

      next();
    };
  }

  // Any of multiple roles
  requireAnyRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      if (!roles.includes(req.userRole)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `One of roles '${roles.join(', ')}' required`
        });
      }

      next();
    };
  }

  // Owner or admin access (user can access their own resources or admin can access any)
  requireOwnerOrAdmin(resourceIdParam = 'id') {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const resourceUserId = req.params[resourceIdParam];
      const isOwner = req.userId === resourceUserId;
      const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.userRole);

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Owner or admin access required'
        });
      }

      next();
    };
  }

  // Rate limiting based on user role
  roleBasedRateLimit() {
    const roleLimits = {
      'SUPER_ADMIN': 1000,
      'ADMIN': 500,
      'GOVERNOR': 300,
      'GUARDIAN': 200,
      'AUDITOR': 150,
      'USER': 100,
      'VIEWER': 50
    };

    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const limit = roleLimits[req.userRole] || 50;
      req.rateLimit = limit;
      
      next();
    };
  }

  // Audit logging middleware
  auditLog(action) {
    return (req, res, next) => {
      const originalSend = res.send;
      
      res.send = function(data) {
        // Log the action
        console.log({
          timestamp: new Date().toISOString(),
          userId: req.userId,
          userRole: req.userRole,
          action: action,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          ip: req.ip
        });
        
        originalSend.call(this, data);
      };
      
      next();
    };
  }

  // Get RBAC service instance
  getRBACService() {
    return this.rbacService;
  }

  // User management endpoints
  getUserManagementRoutes() {
    const router = require('express').Router();
    
    // Assign role to user (admin only)
    router.post('/users/:userId/role', 
      this.requireRole('SUPER_ADMIN'),
      this.auditLog('assign_role'),
      (req, res) => {
        const { userId } = req.params;
        const { role } = req.body;
        
        try {
          this.rbacService.assignRole(userId, role);
          res.json({
            success: true,
            message: `Role '${role}' assigned to user '${userId}'`
          });
        } catch (error) {
          res.status(400).json({
            success: false,
            error: error.message
          });
        }
      }
    );

    // Get user permissions
    router.get('/users/:userId/permissions',
      this.requireAnyRole(['SUPER_ADMIN', 'ADMIN', 'AUDITOR']),
      (req, res) => {
        const { userId } = req.params;
        const permissions = this.rbacService.getUserPermissions(userId);
        
        res.json({
          success: true,
          data: {
            userId,
            role: this.rbacService.getUserRole(userId),
            permissions
          }
        });
      }
    );

    // Get all available roles
    router.get('/roles',
      this.requireAnyRole(['SUPER_ADMIN', 'ADMIN']),
      (req, res) => {
        const roles = this.rbacService.getAvailableRoles();
        const roleDetails = {};
        
        roles.forEach(role => {
          roleDetails[role] = this.rbacService.getRoleDetails(role);
        });
        
        res.json({
          success: true,
          data: roleDetails
        });
      }
    );

    return router;
  }
}

module.exports = RBACMiddleware;
