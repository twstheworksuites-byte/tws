import { Seat, SiteContent, Workspace } from './models.js';

const commonAmenities = [
  'Two complimentary phone booths', 'Reception & seating area', 'Pantry and coffee machine',
  'Printing station', '24/7 power backup', 'Male and female washrooms', '8-person lift', 'Ground-floor parking'
];

export const confirmedInventory = [
  { slug:'garden-hot-desk', name:'Flexi Desk', type:'hot_desk', zone:'Shared Work Area', capacity:null, description:'Flexible shared seating. TWS staff assign an available desk when you arrive; individual desk selection is not offered.', image:'/images/workspace-flexi.webp', pricing:{monthly:7999}, allowedDurations:['monthly'] },
  { slug:'focus-dedicated', name:'Dedicated Desk', type:'dedicated_desk', zone:'Shared Work Area', capacity:null, description:'A specific desk of your choice with access during the assigned day or night shift.', image:'/images/workspace-dedicated.webp', pricing:{monthly:8999}, allowedDurations:['monthly'] },
  { slug:'olive-cabin', name:'3-Seater Private Cabin', type:'private_cabin', zone:'Private Cabins', capacity:3, description:'One private 3-seater cabin with dedicated privacy and 24/7 access.', image:'/images/cabin-3d-3.webp', pricing:{monthly:29997}, allowedDurations:['monthly'], units:1, unitPrefix:'3-seat cabin' },
  { slug:'amber-cabin', name:'4-Seater Private Cabin', type:'private_cabin', zone:'Private Cabins', capacity:4, description:'Thirteen private 4-seater cabins with dedicated privacy and 24/7 access.', image:'/images/cabin-3d-4.webp', pricing:{monthly:39996}, allowedDurations:['monthly'], units:13, unitPrefix:'4-seat cabin' },
  { slug:'cedar-cabin', name:'6-Seater Private Cabin', type:'private_cabin', zone:'Private Cabins', capacity:6, description:'Seven private 6-seater cabins with dedicated privacy and 24/7 access.', image:'/images/cabin-3d-6.webp', pricing:{monthly:59994}, allowedDurations:['monthly'], units:7, unitPrefix:'6-seat cabin' },
  { slug:'huddle-meeting', name:'Meeting Room', type:'meeting_room', zone:'Meeting Area', capacity:10, description:'One meeting room with capacity for up to 10 people. Half-day and full-day discounted prices are shown during booking.', image:'/images/workspace-meeting.webp', pricing:{hourly:599}, allowedDurations:['hourly'], units:1, unitPrefix:'Meeting room' },
  { slug:'forum-conference', name:'Conference Room', type:'conference_room', zone:'Conference Area', capacity:25, description:'A larger conference room with approximately 20–25 seats.', image:'/images/tws-conference-01.webp', pricing:{hourly:1299}, allowedDurations:['hourly'] },
  { slug:'quiet-phone-booths', name:'Phone Booths (2)', type:'phone_booth', zone:'Included Amenities', capacity:2, description:'Two private phone booths are complimentary for every office space type and are not charged separately.', image:'/images/tws-passage-01.webp', pricing:{}, allowedDurations:[], status:'active', bookable:false, units:2, unitPrefix:'Phone booth', unitBookable:false }
];

export async function syncMasterData() {
  const retainedIds=[];
  for (const item of confirmedInventory) {
    const { units, unitPrefix, unitBookable=true, ...fields }=item;
    const workspace=await Workspace.findOneAndUpdate({slug:item.slug},{$set:{...fields,floor:'Main workspace',amenities:commonAmenities,status:fields.status||'active',bookable:fields.bookable??true}},{upsert:true,new:true,setDefaultsOnInsert:true});
    workspace.pricing=fields.pricing;
    workspace.allowedDurations=fields.allowedDurations;
    await workspace.save();
    retainedIds.push(workspace._id);
    await Seat.updateMany({workspace:workspace._id},{$set:{status:'inactive',bookable:false}});
    if(units)for(let index=0;index<units;index+=1)await Seat.findOneAndUpdate(
      {workspace:workspace._id,number:`${unitPrefix} ${String(index+1).padStart(2,'0')}`},
      {$set:{floor:'Main workspace',zone:workspace.zone,status:'active',bookable:unitBookable}},
      {upsert:true,new:true,setDefaultsOnInsert:true}
    );
    console.log(`Synchronized ${workspace.name}${units?` (${units} units)`:''}`);
  }
  await Workspace.updateMany({_id:{$nin:retainedIds}},{$set:{status:'inactive',bookable:false}});
  await SiteContent.findOneAndUpdate({key:'home'},{$set:{title:'A better workspace for your best work.',body:'Flexible desks, private cabins and professional meeting spaces on Bannerghatta Main Road—with confirmed pricing and live availability.',published:true}},{upsert:true});
  await SiteContent.findOneAndUpdate({key:'about'},{$set:{title:'Built for work that needs room to grow.',body:'A professional workspace on Bannerghatta Main Road in South Bengaluru.',published:true}},{upsert:true});
  await SiteContent.findOneAndUpdate({key:'contact'},{$set:{title:'Easy to find. Easy to work from.',body:'Bannerghatta Main Road, Gottigere, Beside Carmel Academy ICSE School, Kothnur, Kalena Agrahara, Bengaluru, Karnataka 560083. Call or WhatsApp +91 77788 86839.',published:true}},{upsert:true});
}
