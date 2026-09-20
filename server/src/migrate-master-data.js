import { connectDatabase } from './config.js';
import { Seat, SiteContent, Workspace } from './models.js';

const verifiedAmenities=['Reception & seating area','Pantry','Pantry seating area','Coffee machine','Vending machine','Printing station','Phone booths (2)','Male washroom','Female washroom','8-person lift','Puja space','Ground-floor parking'];
const updates={
  'garden-hot-desk':{name:'Hot / Flexi Desk',floor:'Main workspace',zone:'Shared Work Area',status:'active',bookable:true,image:'/images/tws-passage-03.webp',description:'Flexible shared seating for professionals who need an easy place to work.',pricing:{daily:500,monthly:7999},allowedDurations:['daily','monthly']},
  'focus-dedicated':{name:'Dedicated Desks',floor:'Main workspace',zone:'Shared Work Area',status:'active',bookable:true,image:'/images/tws-print-area.webp',description:'A dedicated workstation with access to the shared TWS facilities.',pricing:{monthly:8999},allowedDurations:['monthly']},
  'cedar-cabin':{name:'6-Seater Private Cabin',floor:'Main workspace',zone:'Private Cabins',capacity:6,image:'/images/tws-private-cabin.webp',description:'A dedicated private workspace for larger teams that need collaborative space.',pricing:{monthly:9999},allowedDurations:['monthly']},
  'amber-cabin':{name:'4-Seater Private Cabin',floor:'Main workspace',zone:'Private Cabins',capacity:4,image:'/images/tws-passage-04.webp',description:'A dedicated private workspace for startups, agencies and compact teams.',pricing:{monthly:9999},allowedDurations:['monthly']},
  'olive-cabin':{name:'3-Seater Private Cabin',floor:'Main workspace',zone:'Private Cabins',capacity:3,image:'/images/tws-passage-02.webp',description:'A dedicated private workspace for founders, consultants and small teams.',pricing:{monthly:9999},allowedDurations:['monthly']},
  'huddle-meeting':{name:'Meeting Room',floor:'Main workspace',zone:'Meeting Area',capacity:null,image:'/images/tws-cafe-04.webp',description:'Professional space for client meetings, interviews, team discussions and one-to-one consultations. Request a call to confirm the required capacity.',pricing:{hourly:900,daily:5499,monthly:69999},allowedDurations:['hourly','daily','monthly']},
  'forum-conference':{name:'Conference Room',floor:'Main workspace',zone:'Conference Area',capacity:23,image:'/images/tws-conference-01.webp',description:'A spacious 22+1-seater conference room for meetings, presentations, workshops and training sessions.',pricing:{hourly:2400,daily:13999,monthly:149999},allowedDurations:['hourly','daily','monthly']},
  'quiet-phone-booths':{name:'Phone Booths (2)',floor:'Main workspace',zone:'Amenities',capacity:2,image:'/images/tws-passage-01.webp',description:'Two private sound-controlled booths included for members and customers.',pricing:{},allowedDurations:[],status:'inactive',bookable:false}
};

await connectDatabase();
for(const[slug,fields]of Object.entries(updates)){
  const workspace=await Workspace.findOne({slug});
  if(!workspace)continue;
  Object.assign(workspace,fields);
  workspace.amenities=verifiedAmenities;
  if(workspace.pricing&&Object.hasOwn(fields,'pricing')){for(const unit of ['hourly','daily','weekly','monthly'])if(!fields.pricing?.[unit])workspace.pricing[unit]=undefined;workspace.markModified('pricing');}
  await workspace.save();
  await Seat.updateMany({workspace:workspace._id},{$set:{floor:'Main workspace'}});
  if(slug==='quiet-phone-booths')await Seat.updateMany({workspace:workspace._id},{$set:{status:'inactive',bookable:false}});
  if(['garden-hot-desk','focus-dedicated'].includes(slug))await Seat.updateMany({workspace:workspace._id},{$set:{status:'active',bookable:true}});
  console.log(`Updated ${workspace.name}`);
}
await SiteContent.findOneAndUpdate({key:'home'},{$set:{title:'A better workspace for your best work.',body:'Private cabins and professional meeting spaces on Bannerghatta Main Road—with clear booking choices and live availability.',published:true}},{upsert:true});
await SiteContent.findOneAndUpdate({key:'about'},{$set:{title:'Built for work that needs room to grow.',body:'A professional workspace on Bannerghatta Main Road in South Bengaluru.',published:true}},{upsert:true});
await SiteContent.findOneAndUpdate({key:'contact'},{$set:{title:'Easy to find. Easy to work from.',body:'Bannerghatta Main Road, Kothnur, Kalena Agrahara, Bengaluru 560083.',published:true}},{upsert:true});
console.log('Single-floor TWS master data synchronized.');
process.exit(0);
