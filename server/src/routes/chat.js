import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../middleware.js';

const router = Router();
const input = z.object({
  message: z.string().trim().min(1).max(500),
  history: z.array(z.object({ from: z.enum(['user', 'bot']), text: z.string().max(1000) })).max(8).default([])
});

const contactLine=()=>process.env.BUSINESS_PHONE?`call ${process.env.BUSINESS_PHONE}`:process.env.BUSINESS_EMAIL?`email ${process.env.BUSINESS_EMAIL}`:'use the website enquiry form or WhatsApp';
const workspaceContext = `You are the concise, friendly booking assistant for TWS · The Work Suites.
Verified TWS facts: TWS is a professional single-floor workspace on Bannerghatta Main Road, Kothnur, Kalena Agrahara, South Bengaluru, Karnataka 560083, beside Carmel Academy ICSE School. It is designed for professionals, teams and growing businesses.
Workspace options: hot or flexi desks at ₹7,999 per month, dedicated desks at ₹8,999 per month, private cabins from ₹9,999 per month, a ₹500 day package, 3-seater, 4-seater and 6-seater private cabins, one professional meeting room whose capacity is confirmed by the TWS team, and one 22+1-seater conference room. Two private sound-controlled phone booths are included as an amenity and cannot be booked or paid for separately.
Facilities: reception and seating area, pantry, pantry seating, coffee machine, vending machine, printing station, two phone booths, separate male and female washrooms, an eight-person lift, puja space and ground-floor parking for members and visitors.
Booking: hourly, daily and monthly plans can be booked online with live availability. A signed-in customer gets a server-controlled 10-minute hold before checkout. Yearly use is handled as a lease enquiry and customers can request a purchase call without creating an account. Final current pricing and GST are shown before confirmation; yearly lease pricing must be confirmed by TWS.
Rules: never claim multiple floors, four phone booths, confirmed meeting-room capacity, confirmed opening hours, discounts, availability or payment results. Direct users to the booking page for live availability. Keep replies under 80 words and use plain text. If information is not in these verified facts, do not say you do not know: politely ask the customer to ${contactLine()} for confirmation.`;

function localAnswer(message){
  const value=message.toLowerCase(),contact=`Please ${contactLine()} and the TWS team will confirm it for you.`;
  if(/where|location|address|landmark|pin\s*code/.test(value))return'TWS is on Bannerghatta Main Road, Kothnur, Kalena Agrahara, Bengaluru, Karnataka 560083, beside Carmel Academy ICSE School.';
  if(/amenit|facilit|parking|lift|washroom|pantry|coffee|print|puja/.test(value))return'TWS includes reception seating, a pantry and seating area, coffee and vending machines, a print station, separate washrooms, an eight-person lift, puja space and ground-floor parking.';
  if(/cabin/.test(value))return'TWS has private cabins for 3, 4 and 6 people, suitable for individuals and growing teams. Check the booking page for live availability.';
  if(/conference/.test(value))return'The conference room seats 22 guests plus 1 presenter and is designed for meetings, presentations, workshops and training sessions.';
  if(/meeting room|interview|client meeting/.test(value))return'TWS has a professional meeting room for client meetings, interviews and team discussions. Please request a call to confirm its current capacity and availability.';
  if(/phone booth|call booth/.test(value))return'TWS has two private sound-controlled phone booths for important calls. They are included as an amenity and are not booked or paid for separately.';
  if(/year|lease|long.?term/.test(value))return'Yearly workspace use is handled as a lease. You can request a purchase call from the enquiry form without creating an account, and the TWS team will confirm current pricing and availability.';
  if(/book|availab|hourly|daily|monthly|purchase/.test(value))return'You can book hourly, daily or monthly from the booking page. Choose a workspace and time, then sign in to hold it and complete checkout. For a yearly lease, request a call without creating an account.';
  if(/price|cost|rate|gst/.test(value))return'Current configured rates and GST are shown before online confirmation. Yearly lease pricing is confirmed directly by the TWS team through a callback request.';
  if(/time|open|close|hour/.test(value))return`Operating times were not confirmed in the supplied TWS information. ${contact}`;
  return`I can help with TWS spaces, booking, leases, facilities and location. For this question, ${contact.charAt(0).toLowerCase()+contact.slice(1)}`;
}

router.post('/', rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: true }), validate(input), async (req, res, next) => {
  try {
    if (!process.env.GEMINI_API_KEY) return res.json({ message: localAnswer(req.validated.message) });
    const contents = req.validated.history.map(item => ({ role: item.from === 'user' ? 'user' : 'model', parts: [{ text: item.text }] }));
    contents.push({ role: 'user', parts: [{ text: req.validated.message }] });
    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: workspaceContext }] }, contents, generationConfig: { temperature: 0.35, maxOutputTokens: 500, thinkingConfig: { thinkingLevel: 'minimal' } } }),
      signal: AbortSignal.timeout(15_000)
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error', response.status, data?.error?.message);
      return res.json({ message: localAnswer(req.validated.message) });
    }
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text).join('').trim();
    const refusesHelp=/\b(i (?:do not|don't) know|i (?:do not|don't) have|i'm not sure|i am not sure|cannot answer|can't answer|unable to (?:answer|help)|no information)\b/i.test(text||'');
    if (!text||refusesHelp) return res.json({ message: localAnswer(req.validated.message) });
    res.json({ message: text });
  } catch (error) {
    if (error.name === 'TimeoutError') return res.json({ message: localAnswer(req.validated.message) });
    console.error('Workspace assistant fallback',error.message);
    res.json({message:localAnswer(req.validated.message)});
  }
});

export default router;
