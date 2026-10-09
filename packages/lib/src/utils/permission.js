/**
 * Checks if an admin user has a specific permission.
 * Super Admins always have all permissions.
 * Supports hierarchical permissions: edit/delete implies view.
 * Supports "all" permission for a module.
 * 
 * @param {Object} user - The admin user object (from req.user)
 * @param {string} permission - The permission string to check (e.g., 'vendors:view')
 * @returns {boolean} True if the user has permission, false otherwise
 */
export function hasPermission(user, permission) {
  if (!user) return false;

  // Super Admin bypass
  if (user.roleName === "SUPER_ADMIN") return true;

  if (!user.permissions || !Array.isArray(user.permissions)) return false;

  const [module, action] = permission.split(':');

  // Check for exact permission match
  if (user.permissions.includes(permission)) {
    return true;
  }

  // Check for "all" permission for this module
  if (user.permissions.includes(`${module}:all`)) {
    return true;
  }

  // Hierarchical permissions: edit and delete imply view
  if (action === 'view') {
    if (user.permissions.includes(`${module}:edit`) ||
      user.permissions.includes(`${module}:delete`)) {
      return true;
    }
  }

  // Region alias: admin-roles permission also grants regions permission (grouped in navigation)
  if (module === 'regions') {
    if (user.permissions.includes(`admin-roles:${action}`) ||
      user.permissions.includes('admin-roles:all') ||
      user.permissions.includes('admin-roles')) {
      return true;
    }
    if (action === 'view' && (user.permissions.includes('admin-roles:edit') || user.permissions.includes('admin-roles:delete'))) {
      return true;
    }
  }

  // Legacy: check for module permission without action
  if (user.permissions.includes(module)) {
    return true;
  }

  return false;
}

/**
 * Returns a 403 Forbidden response with a user-friendly message.
 */
export function forbiddenResponse(message = "You do not have permission to perform this action") {
  return Response.json({
    success: false,
    message,
    code: 'FORBIDDEN'
  }, { status: 403 });
}
