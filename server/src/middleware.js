import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { config } from './config.js';
import { User } from './models.js';

export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub).select('+passwordChangedAt').lean();
    if (!user?.active) return res.status(401).json({ message: 'Session is no longer valid.' });
    if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime()) return res.status(401).json({ message: 'Password changed. Please sign in again.' });
    delete user.passwordChangedAt;
    req.user = user; next();
  } catch { res.status(401).json({ message: 'Your session has expired. Please sign in again.' }); }
}

export const authorize = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have permission for this action.' });
export const validate = schema => (req, res, next) => { try { req.validated = schema.parse(req.body); next(); } catch (error) { next(error); } };
export function notFound(req, res) { res.status(404).json({ message: 'API route not found.' }); }
export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) return res.status(422).json({ message: 'Please check the highlighted details.', issues: error.flatten() });
  if (error?.code === 11000) return res.status(409).json({ message: 'That seat is already on hold or booked. Please choose another.' });
  console.error(error);
  res.status(error.status || 500).json({ message: error.status ? error.message : 'Something went wrong on our side.' });
}
