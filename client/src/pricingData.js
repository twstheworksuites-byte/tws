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
    features: ['3 seats — ₹29,997', '4 seats — ₹39,996', '6 seats — ₹59,994', '8 seats — ₹79,992 on request', '12 seats — ₹1,19,988 on request']
  },
  {
    type: 'meeting_room',
    name: 'Meeting Room',
    price: 599,
    unit: 'hour',
    copy: 'Ten meeting rooms are available, with capacity for up to 10 people in each room.',
    features: ['Hourly — ₹599', 'Half day (4 hours, 10% off) — ₹2,156', 'Full day (8 hours, 10% off) — ₹4,312']
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
  { seats: 8, count: null, price: 79992, note: 'Configured from 4-seater cabins when required' },
  { seats: 12, count: null, price: 119988, note: 'Configured from 6-seater cabins when required' }
];
