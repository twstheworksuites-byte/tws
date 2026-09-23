import 'dotenv/config';
import mongoose from 'mongoose';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tws_workspace',
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-before-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  holdMinutes: Number(process.env.HOLD_MINUTES || 10),
  taxRate: Number(process.env.TAX_RATE || .18),
  bookingPrefix: process.env.BOOKING_PREFIX || 'TWS',
  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock'
};

export function validateProductionConfig(){if(config.env!=='production')return;const missing=[];if(!process.env.MONGODB_URI)missing.push('MONGODB_URI');if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)missing.push('JWT_SECRET (32+ characters)');if(!config.clientUrl.split(',').every(url=>url.startsWith('https://')))missing.push('HTTPS CLIENT_URL');if(!['cashfree','disabled'].includes(config.paymentProvider))missing.push('PAYMENT_PROVIDER=cashfree or disabled');if(config.paymentProvider==='cashfree'&&!process.env.CASHFREE_APP_ID)missing.push('CASHFREE_APP_ID');if(config.paymentProvider==='cashfree'&&!process.env.CASHFREE_SECRET_KEY)missing.push('CASHFREE_SECRET_KEY');if(config.paymentProvider==='cashfree'&&!['sandbox','production'].includes(process.env.CASHFREE_ENV))missing.push('CASHFREE_ENV=sandbox or production');if(missing.length)throw new Error(`Production configuration missing: ${missing.join(', ')}`);}

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB connected');
}
