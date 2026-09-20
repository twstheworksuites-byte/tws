import http from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { config, connectDatabase, validateProductionConfig } from './config.js';
import { runBookingJobs } from './services.js';

validateProductionConfig();await connectDatabase();
const app=createApp(null);
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:config.env==='production'?config.clientUrl.split(',').map(value=>value.trim()):true,methods:['GET','POST']}});
app.set('io',io);
io.on('connection',socket=>{socket.emit('connected',{at:new Date().toISOString()});});
server.listen(config.port,()=>console.log(`TWS API listening on http://localhost:${config.port}`));
runBookingJobs(io).catch(error=>console.error('Booking job failed',error));
const bookingJob=setInterval(()=>runBookingJobs(io).catch(error=>console.error('Booking job failed',error)),15*60_000);bookingJob.unref();

let stopping=false;
const shutdown=()=>{if(stopping)return;stopping=true;clearInterval(bookingJob);io.close();server.closeAllConnections?.();const force=setTimeout(()=>process.exit(0),3000);force.unref();server.close(async()=>{clearTimeout(force);await mongoose.disconnect().catch(()=>{});process.exit(0)});};
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
