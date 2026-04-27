const jwt = require('jsonwebtoken');

class RBACService {
  constructor() {
    // Define roles and their permissions
    this.roles = {
      SUPER_ADMIN: {
        permissions: [
          'user.create', 'user.read', 'user.update', 'user.delete',
          'contract.deploy', 'contract.read', 'contract.update', 'contract.delete',
          'did.create', 'did.read', 'did.update', 'did.delete',
          'credential.issue', 'credential.verify', 'credential.revoke',
          'governance.execute', 'governance.pause', 'governance.unpause',
          'system.monitor', 'system.configure', 'system.backup',
          'audit.read', 'audit.export'
        ]
      },
      ADMIN: {
        permissions: [
          'user.create', 'user.read', 'user.update',
          'contract.deploy', 'contract.read', 'contract.update',
          'did.create', 'did.read', 'did.update',
          'credential.issue', 'credential.verify',
          'governance.execute',
          'audit.read'
        ]
      },
      GOVERNOR: {
        permissions: [
          'user.read',
          'contract.read',
          'did.read', 'did.update',
          'credential.issue', 'credential.verify',
          'governance.execute',
          'audit.read'
        ]
      },
      GUARDIAN: {
        permissions: [
          'user.read',
          'contract.read',
          'did.read',
          'credential.verify',
          'governance.pause', 'governance.unpause',
          'audit.read'
        ]
      },
      AUDITOR: {
        permissions: [
          'user.read',
          'contract.read',
          'did.read',
          'credential.verify',
          'audit.read', 'audit.export'
        ]
      },
      USER: {
        permissions: [
          'did.create', 'did.read', 'did.update',
          'credential.issue', 'credential.verify'
        ]
      },
      VIEWER: {
        permissions: [
          'did.read',
          'credential.verify'
        ]
      }
    };

    // Define resource types and their access patterns
    this.resources = {
      USER: ['create', 'read', 'update', 'delete'],
      CONTRACT: ['deploy', 'read', 'update', 'delete'],
      DID: ['create', 'read', 'update', 'delete'],
      CREDENTIAL: ['issue', 'verify', 'revoke'],
      GOVERNANCE: ['execute', 'pause', 'unpause'],
      SYSTEM: ['monitor', 'configure', 'backup'],
      AUDIT: ['read', 'export']
    };

    // Initialize user roles storage (in production, use database)
    this.userRoles = new Map();
    this.userPermissions = new Map();
  }

  // Assign role to user
  assignRole(userId, role) {
    if (!this.roles[role]) {
      throw new Error(`Invalid role: ${role}`);
    }
    
    this.userRoles.set(userId, role);
    this.userPermissions.set(userId, this.roles[role].permissions);
  }

  // Get user role
  getUserRole(userId) {
    return this.userRoles.get(userId);
  }

  // Get user permissions
  getUserPermissions(userId) {
    return this.userPermissions.get(userId) || [];
  }

  // Check if user has specific permission
  hasPermission(userId, permission) {
    const permissions = this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  // Check if user has any of the specified permissions
  hasAnyPermission(userId, permissions) {
    const userPermissions = this.getUserPermissions(userId);
    return permissions.some(permission => userPermissions.includes(permission));
  }

  // Check if user has all specified permissions
  hasAllPermissions(userId, permissions) {
    const userPermissions = this.getUserPermissions(userId);
    return permissions.every(permission => userPermissions.includes(permission));
  }

  // Check if user can access resource with specific action
  canAccess(userId, resource, action) {
    const permission = `${resource.toLowerCase()}.${action}`;
    return this.hasPermission(userId, permission);
  }

  // Get all available roles
  getAvailableRoles() {
    return Object.keys(this.roles);
  }

  // Get role details
  getRoleDetails(role) {
    return this.roles[role];
  }

  // Create permission from resource and action
  createPermission(resource, action) {
    return `${resource.toLowerCase()}.${action}`;
  }

  // Parse permission string
  parsePermission(permission) {
    const [resource, action] = permission.split('.');
    return { resource, action };
  }

  // Extract user from JWT token
  extractUserFromToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Check permissions from request
  checkPermissions(req, requiredPermissions) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new Error('No token provided');
    }

    const user = this.extractUserFromToken(token);
    const userId = user.userId || user.sub;

    if (Array.isArray(requiredPermissions)) {
      return this.hasAnyPermission(userId, requiredPermissions);
    } else {
      return this.hasPermission(userId, requiredPermissions);
    }
  }

  // Middleware for permission checking
  requirePermission(permission) {
    return (req, res, next) => {
      try {
        const hasPermission = this.checkPermissions(req, permission);
        
        if (!hasPermission) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient permissions'
          });
        }
        
        next();
      } catch (error) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message
        });
      }
    };
  }

  // Middleware for multiple permissions (any of them)
  requireAnyPermission(permissions) {
    return (req, res, next) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'No token provided'
          });
        }

        const user = this.extractUserFromToken(token);
        const userId = user.userId || user.sub;

        const hasAnyPermission = this.hasAnyPermission(userId, permissions);
        
        if (!hasAnyPermission) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient permissions'
          });
        }
        
        next();
      } catch (error) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message
        });
      }
    };
  }

  // Middleware for all permissions (all of them)
  requireAllPermissions(permissions) {
    return (req, res, next) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'No token provided'
          });
        }

        const user = this.extractUserFromToken(token);
        const userId = user.userId || user.sub;

        const hasAllPermissions = this.hasAllPermissions(userId, permissions);
        
        if (!hasAllPermissions) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient permissions'
          });
        }
        
        next();
      } catch (error) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message
        });
      }
    };
  }

  // Resource-based access control
  requireResourceAccess(resource, action) {
    const permission = this.createPermission(resource, action);
    return this.requirePermission(permission);
  }
}

module.exports = RBACService;
