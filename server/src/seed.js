import { connectDatabase } from './config.js';
import { Seat, User, Workspace } from './models.js';
import { hashValue } from './services.js';

await connectDatabase();
const inventory=[
  {name:'Hot / Flexi Desk',slug:'garden-hot-desk',type:'hot_desk',floor:'Main workspace',zone:'Shared Work Area',capacity:36,description:'Flexible shared seating for professionals who need an easy place to work.',image:'/images/tws-passage-03.webp',pricing:{daily:500,monthly:7999},allowedDurations:['daily','monthly'],amenities:[],status:'active',bookable:true,map:{x:8,y:12,width:46,height:42}},
  {name:'Dedicated Desks',slug:'focus-dedicated',type:'dedicated_desk',floor:'Main workspace',zone:'Shared Work Area',capacity:24,description:'A dedicated workstation with access to the shared TWS facilities.',image:'/images/tws-print-area.webp',pricing:{monthly:8999},allowedDurations:['monthly'],amenities:[],status:'active',bookable:true,map:{x:8,y:12,width:42,height:38}},
  {name:'6-Seater Private Cabin',slug:'cedar-cabin',type:'private_cabin',floor:'Main workspace',zone:'Private Cabins',capacity:6,description:'A dedicated private workspace for larger teams that need collaborative space.',image:'/images/tws-private-cabin.webp',pricing:{monthly:9999},allowedDurations:['monthly'],amenities:[],map:{x:58,y:12,width:32,height:20}},
  {name:'4-Seater Private Cabin',slug:'amber-cabin',type:'private_cabin',floor:'Main workspace',zone:'Private Cabins',capacity:4,description:'A dedicated private workspace for startups, agencies and compact teams.',image:'/images/tws-passage-04.webp',pricing:{monthly:9999},allowedDurations:['monthly'],amenities:[],map:{x:58,y:36,width:24,height:18}},
  {name:'3-Seater Private Cabin',slug:'olive-cabin',type:'private_cabin',floor:'Main workspace',zone:'Private Cabins',capacity:3,description:'A dedicated private workspace for founders, consultants and small teams.',image:'/images/tws-passage-02.webp',pricing:{monthly:9999},allowedDurations:['monthly'],amenities:[],map:{x:56,y:12,width:22,height:18}},
  {name:'Meeting Room',slug:'huddle-meeting',type:'meeting_room',floor:'Main workspace',zone:'Meeting Area',capacity:null,description:'Professional space for client meetings, interviews, team discussions and one-to-one consultations. Request a call to confirm the required capacity.',image:'/images/tws-cafe-04.webp',pricing:{hourly:900,daily:5499,monthly:69999},allowedDurations:['hourly','daily','monthly'],amenities:[],map:{x:58,y:59,width:32,height:26}},
  {name:'Conference Room',slug:'forum-conference',type:'conference_room',floor:'Main workspace',zone:'Conference Area',capacity:23,description:'A spacious 22+1-seater conference room for meetings, presentations, workshops and training sessions.',image:'/images/tws-conference-01.webp',pricing:{hourly:2400,daily:13999,monthly:149999},allowedDurations:['hourly','daily','monthly'],amenities:['22 guest seats','1 presenter position','Presentation wall'],map:{x:55,y:40,width:37,height:42}},
  {name:'Phone Booths (2)',slug:'quiet-phone-booths',type:'phone_booth',floor:'Main workspace',zone:'Amenities',capacity:2,description:'Two private sound-controlled booths included for members and customers.',image:'/images/tws-passage-01.webp',pricing:{},allowedDurations:[],amenities:['Included amenity','Acoustic isolation','Power outlet'],status:'inactive',bookable:false,map:{x:12,y:20,width:32,height:28}}
];
const verifiedAmenities=['Reception & seating area','Pantry','Pantry seating area','Coffee machine','Vending machine','Printing station','Phone booths (2)','Male washroom','Female washroom','8-person lift','Puja space','Ground-floor parking'];
for(const item of inventory)if(item.status!=='inactive')item.amenities=verifiedAmenities;
await Promise.all(inventory.map(item=>Workspace.findOneAndUpdate({slug:item.slug},item,{upsert:true,new:true,setDefaultsOnInsert:true})));
const hot=await Workspace.findOne({slug:'garden-hot-desk'}), dedicated=await Workspace.findOne({slug:'focus-dedicated'}), booths=await Workspace.findOne({slug:'quiet-phone-booths'});
for(const [workspace,count,prefix,floor,bookable] of [[hot,36,'H','Main workspace',true],[dedicated,24,'D','Main workspace',true],[booths,2,'P','Main workspace',false]]){
  for(let i=1;i<=count;i++) await Seat.findOneAndUpdate({workspace:workspace._id,number:`${prefix}${String(i).padStart(2,'0')}`},{floor,zone:workspace.zone,status:bookable?'active':'inactive',bookable,map:{x:12+((i-1)%6)*12,y:20+Math.floor((i-1)/6)*12,rotation:0}},{upsert:true});
}
const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@tws.com').toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword || adminPassword.length < 8) throw new Error('SEED_ADMIN_PASSWORD must contain at least 8 characters.');
const adminCredentials = hashValue(adminPassword);
await User.findOneAndUpdate({email:adminEmail},{email:adminEmail,name:'Workspace Admin',role:'super_admin',active:true,emailVerified:true,passwordHash:adminCredentials.hash,passwordSalt:adminCredentials.salt,passwordChangedAt:new Date()},{upsert:true,runValidators:true});
await User.updateMany({role:{$nin:['customer','super_admin']}},{$set:{role:'customer'}});
console.log('Seeded configurable inventory, 64 individual seats, rooms, cabins, customer accounts and one admin role.'); process.exit(0);
