import { connectDatabase } from './config.js';
import { syncMasterData } from './sync-master-data.js';

await connectDatabase();
await syncMasterData();
console.log('Confirmed TWS inventory and pricing synchronized.');
process.exit(0);
