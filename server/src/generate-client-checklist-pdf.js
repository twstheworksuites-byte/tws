import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, '../../TWS-Client-Information-Checklist.pdf');
const orange = '#F07A2D';
const charcoal = '#202321';
const muted = '#666963';
const ivory = '#FBF7F0';
const line = '#DDD5C9';

const doc = new PDFDocument({ size: 'A4', margin: 48, info: {
  Title: 'TWS Client Information Checklist',
  Author: 'The Work Suites',
  Subject: 'Information required to complete the TWS website'
}});

doc.registerFont('TWSRegular', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
doc.registerFont('TWSBold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
const selectFont = doc.font.bind(doc);
doc.font = (name, ...args) => selectFont(name === 'Helvetica' ? 'TWSRegular' : name === 'Helvetica-Bold' ? 'TWSBold' : name, ...args);

doc.pipe(fs.createWriteStream(output));

let pageNumber = 1;
const usableBottom = 750;

function footer() {
  doc.save();
  doc.moveTo(48, 766).lineTo(547, 766).strokeColor(line).lineWidth(0.6).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(muted)
    .text('THE WORK SUITES  |  YOUR SPACE · YOUR PACE', 48, 777, { width: 390 })
    .text(String(pageNumber), 500, 777, { width: 46, align: 'right' });
  doc.restore();
}

function newPage() {
  footer();
  doc.addPage();
  pageNumber += 1;
  doc.rect(0, 0, 595.28, 18).fill(orange);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(charcoal).text('TWS CLIENT INFORMATION CHECKLIST', 48, 36);
  doc.y = 65;
}

function ensure(height = 40) {
  if (doc.y + height > usableBottom) newPage();
}

function section(number, title, note) {
  ensure(note ? 85 : 58);
  doc.moveDown(0.35);
  const y = doc.y;
  doc.roundedRect(48, y, 499, note ? 58 : 40, 6).fill(ivory);
  const top = y + 11;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(orange).text(String(number).padStart(2, '0'), 62, top + 1, { width: 28 });
  doc.font('Helvetica-Bold').fontSize(15).fillColor(charcoal).text(title, 97, top, { width: 430 });
  if (note) doc.font('Helvetica').fontSize(9.5).fillColor(muted).text(note, 97, top + 23, { width: 420 });
  doc.y = y + (note ? 68 : 50);
}

function item(text) {
  const height = doc.heightOfString(text, { width: 452, lineGap: 2 });
  ensure(height + 14);
  const y = doc.y + 2;
  doc.rect(52, y + 1, 9, 9).lineWidth(1).strokeColor(orange).stroke();
  doc.font('Helvetica').fontSize(10.5).fillColor(charcoal).text(text, 71, y - 2, { width: 462, lineGap: 2 });
  doc.y = y + height + 9;
}

function callout(title, text) {
  ensure(75);
  const y = doc.y + 6;
  doc.roundedRect(48, y, 499, 62, 7).fill(charcoal);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(orange).text(title, 64, y + 12, { width: 465 });
  doc.font('Helvetica').fontSize(9.5).fillColor('#FFFFFF').text(text, 64, y + 31, { width: 465, lineGap: 2 });
  doc.y = y + 74;
}

// Cover
doc.rect(0, 0, 595.28, 841.89).fill(ivory);
doc.rect(0, 0, 595.28, 22).fill(orange);
doc.font('Helvetica').fontSize(62).fillColor(orange).text('TWS', 48, 92, { characterSpacing: -2 });
doc.moveTo(178, 97).lineTo(178, 157).strokeColor(orange).lineWidth(1.5).stroke();
doc.font('Helvetica-Bold').fontSize(18).fillColor(charcoal).text('THE WORK SUITES', 198, 104, { characterSpacing: 1.4 });
doc.font('Helvetica').fontSize(8).fillColor(muted).text('YOUR SPACE · YOUR PACE', 199, 133, { characterSpacing: 1.2 });
doc.font('Helvetica-Bold').fontSize(31).fillColor(charcoal).text('Information required\nto complete the website', 48, 230, { width: 490, lineGap: 7 });
doc.font('Helvetica').fontSize(14).fillColor(muted).text('Please provide the details in this checklist in one PDF or shared folder.', 48, 336, { width: 460, lineGap: 5 });
doc.roundedRect(48, 430, 499, 134, 10).fill(charcoal);
doc.font('Helvetica-Bold').fontSize(15).fillColor('#FFFFFF').text('How to send the information', 72, 456);
doc.font('Helvetica').fontSize(11).fillColor('#FFFFFF')
  .text('1. Fill in or attach the requested details.', 72, 490)
  .text('2. Mark anything that is not available as “Not confirmed”.', 72, 516)
  .text('3. Send original photos and videos separately in full quality.', 72, 542);
doc.font('Helvetica').fontSize(10).fillColor(muted).text('Prepared for website content and booking setup', 48, 720);
footer();

doc.addPage();
pageNumber += 1;
doc.rect(0, 0, 595.28, 18).fill(orange);
doc.font('Helvetica-Bold').fontSize(10).fillColor(charcoal).text('TWS CLIENT INFORMATION CHECKLIST', 48, 36);
doc.y = 65;

section(1, 'Business and contact details', 'Please provide the official details that customers may see on the website.');
item('Official business name and registered business name');
item('Complete address with PIN code and a Google Maps link');
item('Official phone number and WhatsApp number');
item('Official email address');
item('GST number, if applicable');
item('Opening days, opening time and closing time');
item('Google Business Profile and social-media links');

section(2, 'Prices and taxes', 'Please clearly mention whether each price is per seat or for the complete space.');
item('Confirm: Hot / Flexi Desk — ₹7,999 per month');
item('Confirm: Dedicated Desk — ₹8,999 per month');
item('Confirm: Private Cabin — ₹9,999 per month');
item('Confirmed: Meeting Room — ₹599/hour, ₹2,156/4 hours, ₹4,312/8 hours');
item('Is the private-cabin price per seat or for the complete cabin?');
item('Meeting-room price: hourly, daily and monthly');
item('Conference-room price: hourly, daily and monthly');
item('Does each price include GST? If not, provide the GST percentage.');
item('Any deposit, maintenance charge, discount or other charge');

section(3, 'Workspace details', 'Give the exact number and capacity of every space.');
item('Total number of Hot / Flexi Desks');
item('Total number of Dedicated Desks');
item('Number of 3-seater, 4-seater and 6-seater private cabins');
item('Meeting-room seating capacity');
item('Conference-room seating capacity');
item('Official name or number for every desk, cabin and room');
item('Confirm that the complete TWS workspace is on one floor');

section(4, 'Booking rules', 'These details are required to make online availability and cancellations accurate.');
item('Which spaces can be booked online?');
item('Minimum and maximum booking duration for each space');
item('How early can customers book?');
item('Available booking hours, weekends and holidays');
item('Cancellation deadline and refund percentage');
item('Refund processing time and any cancellation charge');
item('Any check-in, visitor or identification rules');

section(5, 'Lease information', 'Customers will submit a lease request. The team can confirm the final price by phone.');
item('Minimum and maximum lease duration');
item('Security deposit and maintenance charges');
item('Payment frequency: monthly, quarterly or yearly');
item('Lock-in period and notice period');
item('Documents required from the customer');
item('Lease approval process and expected response time');

section(6, 'Amenities and facilities', 'Please tick every facility that is actually available.');
item('Reception and visitor seating');
item('Wi-Fi and power backup');
item('Two phone booths — included amenity, not separately booked or paid');
item('Pantry, pantry seating, coffee machine and vending machine');
item('Printing station');
item('Male and female washrooms');
item('Lift access and accessibility facilities');
item('Ground-floor parking: car and two-wheeler capacity');
item('Puja space, housekeeping and on-site support');
item('Any other facility customers should know about');

section(7, 'Photos, videos and brand files', 'Please send original files without WhatsApp compression where possible.');
item('Logo with a transparent background in PNG and SVG formats');
item('Exterior, building entrance and signboard photos');
item('Reception and waiting-area photos');
item('Hot desk and dedicated desk photos');
item('3, 4 and 6-seater private-cabin photos');
item('Meeting-room and conference-room photos');
item('Phone booth, pantry, café, printing area and parking photos');
item('One short landscape video for the website banner, if available');
item('Floor plan or blueprint with room names and seat numbers');
item('Written confirmation that all supplied media can be used on the website');

section(8, 'Policies and customer support', 'These details will be used in FAQs, booking screens and customer messages.');
item('Booking terms and conditions');
item('Cancellation and refund policy');
item('Privacy policy and contact person for privacy requests');
item('Customer-support phone, email and available support hours');
item('Emergency contact or building-support number, if customers may use it');

callout('Important security note', 'Do not send customer passwords, card numbers, CVV, UPI PIN, OTP, bank-login details or any other secret payment information.');

ensure(125);
doc.moveDown(0.5);
doc.font('Helvetica-Bold').fontSize(15).fillColor(charcoal).text('Final confirmation');
doc.font('Helvetica').fontSize(10.5).fillColor(muted).text('Please confirm that all information supplied is correct and approved for publication.', { lineGap: 3 });
doc.moveDown(1.5);
doc.moveTo(48, doc.y).lineTo(270, doc.y).strokeColor(line).stroke();
doc.moveTo(325, doc.y).lineTo(547, doc.y).strokeColor(line).stroke();
doc.font('Helvetica').fontSize(8.5).fillColor(muted).text('Name and signature', 48, doc.y + 8).text('Date', 325, doc.y - 2);

footer();
doc.end();

console.log(output);
