import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models.js';
import { audit, createCustomerNotification, hashValue, randomToken, sendEmail, signToken, verifyHash } from '../services.js';
import { authenticate, validate } from '../middleware.js';
import { config } from '../config.js';

const router = Router();
const password = z.string().min(6, 'Password must contain at least 6 characters.').max(128);
const email = z.string().email().transform(value => value.toLowerCase());
const publicUser = user => {
  const value = user.toObject();
  delete value.passwordHash;
  delete value.passwordSalt;
  delete value.passwordChangedAt; delete value.resetTokenHash; delete value.resetTokenSalt; delete value.resetTokenExpiresAt;
  delete value.verificationTokenHash; delete value.verificationTokenSalt; delete value.verificationTokenExpiresAt;
  delete value.loginAttempts; delete value.lockedUntil;
  return value;
};

router.post('/register', rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: true, skip:()=>config.env!=='production' }), validate(z.object({
  name: z.string().trim().min(2).max(80), email, password
})), async (req, res, next) => {
  try {
    const exists = await User.exists({ email: req.validated.email });
    if (exists) return res.status(409).json({ message: 'An account already exists with this email. Please sign in.' });
    const credentials = hashValue(req.validated.password);
    const user = await User.create({ name: req.validated.name, email: req.validated.email, passwordHash: credentials.hash, passwordSalt: credentials.salt, emailVerified:true });
    req.app.get('io').emit('operations:update', { resource: 'user', action: 'registered', id: user._id });
    await audit(req, 'auth.register', 'User', user._id);
    await createCustomerNotification(user._id, { title: 'Welcome to The Work Suites', message: 'Your customer account is ready. You can now select workspaces, hold seats and manage bookings from your dashboard.', kind: 'account' });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, skip:()=>config.env!=='production' }), validate(z.object({ email, password })), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.validated.email }).select('+passwordHash +passwordSalt +loginAttempts +lockedUntil');
    if (config.env==='production'&&user?.lockedUntil > new Date()) return res.status(423).json({ message: 'Account temporarily locked after repeated attempts. Try again later.' });
    if (!user || !user.active || !verifyHash(req.validated.password, user.passwordSalt, user.passwordHash)) {
      if (user&&config.env==='production') { user.loginAttempts = (user.loginAttempts || 0) + 1; if (user.loginAttempts >= 5) { user.lockedUntil = new Date(Date.now() + 15 * 60_000); user.loginAttempts = 0; } await user.save(); await audit(req, 'auth.login_failed', 'User', user._id); }
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    user.loginAttempts = 0; user.lockedUntil = undefined; user.lastLoginAt = new Date(); await user.save(); await audit(req, 'auth.login', 'User', user._id);
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});
router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));
router.patch('/me', authenticate, validate(z.object({ name: z.string().min(2).optional(), mobile: z.string().min(7).optional(), company: z.string().optional(), gstin: z.string().optional(), billingAddress: z.string().optional() })), async (req, res, next) => { try { const user = await User.findByIdAndUpdate(req.user._id, { $set: req.validated }, { new: true, runValidators: true }); req.app.get('io').emit('operations:update', { resource: 'user', action: 'profile_updated', id: user._id }); res.json({ user }); } catch (e) { next(e); } });

router.post('/forgot-password', rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: true, skip:()=>config.env!=='production' }), validate(z.object({ email })), async (req, res, next) => { try { const user=await User.findOne({email:req.validated.email}); if(user){const token=randomToken(),credentials=hashValue(token);await User.findByIdAndUpdate(user._id,{resetTokenHash:credentials.hash,resetTokenSalt:credentials.salt,resetTokenExpiresAt:new Date(Date.now()+30*60_000)});const url=`${process.env.CLIENT_URL?.split(',')[0]||'http://localhost:5173'}/reset-password?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(token)}`;sendEmail({to:user.email,subject:'Reset your Workspace password',text:`Reset your password: ${url}`,html:`<p><a href="${url}">Reset your password</a>. This link expires in 30 minutes.</p>`}).catch(error=>console.error('Reset email failed',error.message));await audit(req,'auth.password_reset_requested','User',user._id);}res.json({message:'If that account exists, a reset link has been sent.'});}catch(e){next(e);} });

router.post('/reset-password', rateLimit({windowMs:15*60_000,limit:8,standardHeaders:true}),validate(z.object({email,token:z.string().min(20),password})),async(req,res,next)=>{try{const user=await User.findOne({email:req.validated.email,resetTokenExpiresAt:{$gt:new Date()}}).select('+resetTokenHash +resetTokenSalt');if(!user||!verifyHash(req.validated.token,user.resetTokenSalt,user.resetTokenHash))return res.status(400).json({message:'Reset link is invalid or expired.'});const credentials=hashValue(req.validated.password);await User.findByIdAndUpdate(user._id,{passwordHash:credentials.hash,passwordSalt:credentials.salt,passwordChangedAt:new Date(),loginAttempts:0,$unset:{resetTokenHash:1,resetTokenSalt:1,resetTokenExpiresAt:1,lockedUntil:1}});await audit(req,'auth.password_reset','User',user._id);res.json({message:'Password updated. You can now sign in.'});}catch(e){next(e);} });

router.patch('/password',authenticate,validate(z.object({currentPassword:z.string().min(6),newPassword:password})),async(req,res,next)=>{try{const user=await User.findById(req.user._id).select('+passwordHash +passwordSalt');if(!verifyHash(req.validated.currentPassword,user.passwordSalt,user.passwordHash))return res.status(401).json({message:'Current password is incorrect.'});const credentials=hashValue(req.validated.newPassword);user.passwordHash=credentials.hash;user.passwordSalt=credentials.salt;user.passwordChangedAt=new Date();await user.save();await audit(req,'auth.password_changed','User',user._id);res.json({message:'Password changed. Please sign in again.'});}catch(e){next(e);} });

export default router;
