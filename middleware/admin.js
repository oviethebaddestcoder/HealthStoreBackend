import { authenticateToken } from './auth.js';

export const requireAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};
