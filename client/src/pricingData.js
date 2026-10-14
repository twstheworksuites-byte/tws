export const pricingPlans = [
  {
    type: 'hot_desk',
    name: 'Flexi Desk',
    price: 7999,
    unit: 'month',
    copy: 'Staff assign an available desk when you arrive. Individual desk selection is not included.',
    features: ['Flexible shared seating', 'Desk assigned by TWS staff', 'Two phone booths included']
  },
  {
    type: 'dedicated_desk',
    name: 'Dedicated Desk',
    price: 8999,
    unit: 'month',
    copy: 'A specific desk of your choice, with access during the assigned day or night shift.',
    features: ['Your chosen assigned desk', 'Day or night shift access', 'Two phone booths included']
  },
  {
    type: 'private_cabin',
    name: 'Private Cabin',
    price: 9999,
    unit: 'desk / month',
    copy: 'Private team space with dedicated privacy and 24/7 access. Price is calculated per desk.',
    features: ['3 seats — ₹9,999 × 3 = ₹29,997 + 18% GST', '4 seats — ₹9,999 × 4 = ₹39,996 + 18% GST', '6 seats — ₹9,999 × 6 = ₹59,994 + 18% GST', '8 seats — ₹9,999 × 8 = ₹79,992 + 18% GST', '12 seats — ₹9,999 × 12 = ₹1,19,988 + 18% GST']
  },
  {
    type: 'meeting_room',
    name: 'Meeting Room',
    price: 599,
    unit: 'hour',
    copy: 'One meeting room is available for up to 10 people. A 10% discount is applied to the selected-hour amount.',
    features: ['Original hourly rate — ₹599', '4-hour original amount — ₹2,396; 10% off = ₹2,156.40 before GST', '8-hour original amount — ₹4,792; 10% off = ₹4,312.80 before GST']
  },
  {
    type: 'conference_room',
    name: 'Conference Room',
    price: 1299,
    unit: 'hour',
    copy: 'A larger room for approximately 20–25 people.',
    features: ['Standalone hourly booking — ₹1,299', 'Approximately 20–25 seats', 'Two phone booths included']
  }
];

export const cabinInventory = [
  { seats: 3, count: 1, price: 29997 },
  { seats: 4, count: 13, price: 39996 },
  { seats: 6, count: 7, price: 59994 },
  { seats: 8, count: null, price: 79992 },
  { seats: 12, count: null, price: 119988 }
];

export function withLivePricing(plan, workspaces = []) {
  const matches = workspaces.filter(item => item.type === plan.type && item.status === 'active');
  const workspace = matches[0];
  if (!workspace) return { ...plan, _id: undefined };
  const rates = matches.flatMap(item => Object.values(item.pricing || {}).filter(Number));
  const price = plan.type === 'private_cabin'
    ? Math.min(...matches.map(item => Number(item.pricing?.monthly || 0) / Number(item.capacity || 1)).filter(Boolean))
    : Math.min(...rates);
  const livePrice = Number.isFinite(price) ? price : plan.price;
  const format = value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:Number(value||0)%1?2:0,maximumFractionDigits:2}).format(value||0);
  let features = plan.features;
  let copy = plan.copy;
  if (plan.type === 'private_cabin') {
    features = [3, 4, 6, 8, 12].map(seats => `${seats} seats — ${format(livePrice)} × ${seats} = ${format(livePrice * seats)} + 18% GST`);
  } else if (plan.type === 'meeting_room') {
    copy = 'One meeting room is available for up to 10 people. A 10% discount is applied to the selected-hour amount.';
    const fourHourOriginal=livePrice*4,eightHourOriginal=livePrice*8;
    features = [`Original hourly rate — ${format(livePrice)}`, `4-hour original amount — ${format(fourHourOriginal)}; 10% off = ${format(fourHourOriginal*.9)} before GST`, `8-hour original amount — ${format(eightHourOriginal)}; 10% off = ${format(eightHourOriginal*.9)} before GST`];
  } else if (plan.type === 'conference_room') {
    features = [`Standalone hourly booking — ${format(livePrice)}`, 'Approximately 20–25 seats', 'Two phone booths included'];
  }
  return { ...plan, price: livePrice, features, copy, _id: workspace._id };
}
