import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import crypto from 'crypto';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import auth from './routes/auth.js';
import workspaces from './routes/workspaces.js';
import bookings from './routes/bookings.js';
import admin from './routes/admin.js';
import chat from './routes/chat.js';
import payments from './routes/payments.js';
import content from './routes/content.js';
import enquiries from './routes/enquiries.js';
import { errorHandler, notFound } from './middleware.js';

export function createApp(io) {
  const app=express(); app.set('io',io);if(config.env==='production')app.set('trust proxy',1);
  app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
  app.use((req,res,next)=>{req.id=req.get('x-request-id')||crypto.randomUUID();res.setHeader('x-request-id',req.id);next()});
  const allowedOrigins=config.clientUrl.split(',').map(x=>x.trim());
  app.use(cors({origin(origin,callback){if(!origin||allowedOrigins.includes(origin)||(config.env!=='production'&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)))return callback(null,true);callback(new Error('Origin is not allowed by CORS.'));},credentials:true}));
  app.use('/uploads',express.static(path.resolve('uploads'),{maxAge:'7d',immutable:true}));
  app.use('/api/payments',express.raw({type:'application/json',limit:'100kb'}),payments);
  app.use(express.json({limit:'6mb'})); app.use(morgan(config.env==='production'?':remote-addr :method :url :status :response-time ms request=:req[x-request-id]':'dev'));app.use('/api',rateLimit({windowMs:15*60_000,limit:500,standardHeaders:true,legacyHeaders:false}));
  app.get('/api/health',(req,res)=>res.json({status:'ok',time:new Date().toISOString(),environment:config.env}));
  app.use('/api/auth',auth); app.use('/api/workspaces',workspaces); app.use('/api/bookings',bookings); app.use('/api/admin',admin); app.use('/api/chat',chat); app.use('/api/content',content); app.use('/api/enquiries',enquiries);
  app.use(notFound); app.use(errorHandler); return app;
}
