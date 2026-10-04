import { connectDatabase } from './config.js';
import { User } from './models.js';
import { hashValue } from './services.js';
import { syncMasterData } from './sync-master-data.js';

await connectDatabase();
await syncMasterData();
const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@tws.com').toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword || adminPassword.length < 8) throw new Error('SEED_ADMIN_PASSWORD must contain at least 8 characters.');
const adminCredentials = hashValue(adminPassword);
await User.findOneAndUpdate({email:adminEmail},{email:adminEmail,name:'Workspace Admin',role:'super_admin',active:true,emailVerified:true,passwordHash:adminCredentials.hash,passwordSalt:adminCredentials.salt,passwordChangedAt:new Date()},{upsert:true,runValidators:true});
await User.updateMany({role:{$nin:['customer','super_admin']}},{$set:{role:'customer'}});
console.log('Seeded confirmed TWS inventory, customer accounts and one admin role.'); process.exit(0);
