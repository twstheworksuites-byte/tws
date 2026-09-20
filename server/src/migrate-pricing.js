import { connectDatabase } from './config.js';
import { Workspace } from './models.js';

const additions={
  'focus-dedicated':{hourly:150},
  'huddle-meeting':{monthly:69999},
  'forum-conference':{monthly:149999},
  'quiet-phone-booths':{}
};

await connectDatabase();
for(const[slug,pricing]of Object.entries(additions)){
  const workspace=await Workspace.findOne({slug});
  if(!workspace)continue;
  workspace.pricing={...workspace.pricing?.toObject?.(),...pricing};
  workspace.allowedDurations=[...new Set([...workspace.allowedDurations,...Object.keys(pricing)])];
  await workspace.save();
  console.log(`Updated ${workspace.name}: ${Object.keys(pricing).join(', ')}`);
}
console.log('Monthly booking prices are synchronized.');
process.exit(0);
