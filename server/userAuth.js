import jwt from 'jsonwebtoken';

export function getUserJwtSecret() {
  return process.env.JWT_SECRET || 'lumo_split_jwt_secret_key_prod_2026';
}

/**
 * Middleware: Strictly requires authenticated user session.
 * Populates req.user = { id, phone, name }
 */
export function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return res.status(401).json({
        error: 'Unauthorized: Authentication token required',
        code: 'AUTH_REQUIRED'
      });
    }

    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return res.status(401).json({
        error: 'Unauthorized: Malformed Authorization header. Expected Bearer token',
        code: 'INVALID_AUTH_HEADER'
      });
    }

    const token = parts[1];
    const secret = getUserJwtSecret();
    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid token claims',
        code: 'INVALID_TOKEN'
      });
    }

    req.user = {
      id: decoded.id,
      phone: decoded.phone,
      name: decoded.name
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Session expired. Please sign in again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({
      error: 'Unauthorized: Invalid authentication session',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Middleware: Optional user authentication.
 * Attaches req.user if valid token present, otherwise null.
 */
export function optionalUserAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      req.user = null;
      return next();
    }

    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      req.user = null;
      return next();
    }

    const token = parts[1];
    const secret = getUserJwtSecret();
    const decoded = jwt.verify(token, secret);

    req.user = decoded && decoded.id ? {
      id: decoded.id,
      phone: decoded.phone,
      name: decoded.name
    } : null;

    next();
  } catch {
    req.user = null;
    next();
  }
}
