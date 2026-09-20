import { Router } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { Booking, Coupon, Hold, Invoice, Maintenance, Notification, ResourceLock, Seat, User, Workspace } from '../models.js';
import { authenticate, authorize, validate } from '../middleware.js';
import { audit, bookingCheckInToken, bookingReference, calculateQuote, createCustomerNotification, createPaymentOrder, finalizePaidBooking, notifyBooking, qrDataUrl, resourceKey, slotsBetween, verifyHash, verifyPayment } from '../services.js';
import { config } from '../config.js';

const router = Router();
const periodSchema = z.object({ workspaceId: z.string(), seatId: z.string().optional().nullable(), seatIds: z.array(z.string()).max(64).optional(), startAt: z.coerce.date(), endAt: z.coerce.date(), durationType: z.enum(['hourly','daily','weekly','monthly']) }).refine(d => d.endAt > d.startAt, 'End time must be after start time.');
const couponQuote=(quote,coupon)=>{const discount=Math.min(quote.base,Math.round((coupon.discountType==='percent'?quote.base*coupon.value/100:coupon.value)*100)/100),base=quote.base,tax=Math.round(Math.max(0,base-discount)*config.taxRate*100)/100,total=Math.round((Math.max(0,base-discount)+tax)*100)/100;return{base,discount,tax,total}};
async function activeCoupon(code){const now=new Date(),coupon=await Coupon.findOne({code:String(code||'').trim().toUpperCase(),active:true,$and:[{$or:[{startsAt:null},{startsAt:{$exists:false}},{startsAt:{$lte:now}}]},{$or:[{endsAt:null},{endsAt:{$exists:false}},{endsAt:{$gte:now}}]}]});if(!coupon||(coupon.usageLimit>0&&coupon.usedCount>=coupon.usageLimit))throw Object.assign(new Error('This offer code is invalid, expired, or fully used.'),{status:422});return coupon;}

router.post('/quote', validate(periodSchema), async (req, res, next) => {
  try { const workspace = await Workspace.findById(req.validated.workspaceId); if (!workspace) return res.status(404).json({ message: 'Workspace not found.' }); res.json({ quote: calculateQuote(workspace, req.validated.durationType, req.validated.startAt, req.validated.endAt) }); } catch(e) { next(e); }
});

router.post('/holds', authenticate, validate(periodSchema), async (req, res, next) => {
  let hold;
  try {
    const { workspaceId, seatId, seatIds, startAt, endAt, durationType } = req.validated;
    const selectedSeatIds=[...new Set((seatIds?.length?seatIds:seatId?[seatId]:[]).map(String))];
    if (startAt < new Date()) return res.status(422).json({ message: 'Bookings must start in the future.' });
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace?.bookable || workspace.status !== 'active') return res.status(409).json({ message: 'This workspace is not currently bookable.' });
    if (selectedSeatIds.length) { const seats = await Seat.find({ _id:{$in:selectedSeatIds}, workspace: workspaceId,bookable:true,status:'active' }); if(seats.length!==selectedSeatIds.length)return res.status(409).json({ message: 'One or more selected seats are no longer bookable.' }); }
    const conflict = await Maintenance.exists({ workspace: workspaceId, ...(selectedSeatIds.length ? { $or: [{ seat:{$in:selectedSeatIds} }, { seat: null }] } : {}), status: { $in: ['scheduled','active'] }, startAt: { $lt: endAt }, endAt: { $gt: startAt } });
    if (conflict) return res.status(409).json({ message: 'Maintenance is scheduled during that period.' });
    const unitQuote=calculateQuote(workspace,durationType,startAt,endAt),quantity=Math.max(1,selectedSeatIds.length),quote={base:unitQuote.base*quantity,tax:unitQuote.tax*quantity,discount:0,total:unitQuote.total*quantity},expiresAt = new Date(Date.now() + 10 * 60_000);
    hold = await Hold.create({ owner: req.user._id, workspace: workspaceId, seat: selectedSeatIds[0] || undefined,seats:selectedSeatIds, startAt, endAt, durationType, quote, expiresAt });
    const slots = slotsBetween(startAt, endAt),resourceKeys=selectedSeatIds.length?selectedSeatIds.map(id=>resourceKey(workspaceId,id)):[resourceKey(workspaceId)];
    await ResourceLock.insertMany(resourceKeys.flatMap(key=>slots.map(slotStart => ({ resourceKey: key, slotStart, hold: hold._id, expiresAt }))), { ordered: true });
    req.app.get('io').emit('availability:update', { workspaceId, seatIds:selectedSeatIds, reason: 'hold_created' });
    res.status(201).json({ hold, expiresAt });
  } catch (error) {
    if (hold) { await ResourceLock.deleteMany({ hold: hold._id }); await Hold.findByIdAndDelete(hold._id); }
    next(error);
  }
});

// Update an active selection without dropping its existing locks. New locks are
// inserted first, so the unique resource/slot index remains the race barrier.
router.patch('/holds/:id', authenticate, validate(z.object({ seatIds: z.array(z.string()).min(1).max(64) })), async (req, res, next) => {
  const addedKeys=[];
  try {
    const hold=await Hold.findOne({_id:req.params.id,owner:req.user._id,status:'active',expiresAt:{$gt:new Date()}});
    if(!hold)return res.status(410).json({message:'Your seat hold has expired. Please select again.'});
    const selectedSeatIds=[...new Set(req.validated.seatIds.map(String))];
    const seats=await Seat.find({_id:{$in:selectedSeatIds},workspace:hold.workspace,bookable:true,status:'active'});
    if(seats.length!==selectedSeatIds.length)return res.status(409).json({message:'One or more selected seats are no longer bookable.'});
    const previousIds=(hold.seats?.length?hold.seats:hold.seat?[hold.seat]:[]).map(String),previousSet=new Set(previousIds),nextSet=new Set(selectedSeatIds);
    const added=selectedSeatIds.filter(id=>!previousSet.has(id)),removed=previousIds.filter(id=>!nextSet.has(id));
    const slots=slotsBetween(hold.startAt,hold.endAt),expiresAt=new Date(Date.now()+10*60_000);
    for(const id of added){const key=resourceKey(hold.workspace,id);addedKeys.push(key);await ResourceLock.insertMany(slots.map(slotStart=>({resourceKey:key,slotStart,hold:hold._id,expiresAt})),{ordered:true});}
    const workspace=await Workspace.findById(hold.workspace),unitQuote=calculateQuote(workspace,hold.durationType,hold.startAt,hold.endAt),quantity=selectedSeatIds.length;
    hold.seats=selectedSeatIds;hold.seat=selectedSeatIds[0];hold.quote={base:unitQuote.base*quantity,tax:unitQuote.tax*quantity,discount:0,total:unitQuote.total*quantity};hold.expiresAt=expiresAt;await hold.save();
    if(removed.length)await ResourceLock.deleteMany({hold:hold._id,resourceKey:{$in:removed.map(id=>resourceKey(hold.workspace,id))}});
    await ResourceLock.updateMany({hold:hold._id},{$set:{expiresAt}});
    req.app.get('io').emit('availability:update',{workspaceId:hold.workspace,seatIds:selectedSeatIds,reason:'hold_updated'});
    res.json({hold,expiresAt});
  }catch(error){if(addedKeys.length)await ResourceLock.deleteMany({hold:req.params.id,resourceKey:{$in:addedKeys}});next(error);}
});

router.delete('/holds/:id', authenticate, async (req, res, next) => { try { const hold = await Hold.findOneAndUpdate({ _id: req.params.id, owner: req.user._id, status: 'active' }, { status: 'released', $unset: { expiresAt: 1 } }, { new: true }); if (!hold) return res.status(404).json({ message: 'Active hold not found.' }); await ResourceLock.deleteMany({ hold: hold._id }); req.app.get('io').emit('availability:update', { workspaceId: hold.workspace, seatId: hold.seat, reason: 'hold_released' }); res.status(204).end(); } catch(e) { next(e); } });

router.post('/coupon',authenticate,validate(z.object({holdId:z.string(),code:z.string().trim().min(2)})),async(req,res,next)=>{try{const hold=await Hold.findOne({_id:req.validated.holdId,owner:req.user._id,status:'active',expiresAt:{$gt:new Date()}});if(!hold)return res.status(410).json({message:'Your hold has expired.'});const coupon=await activeCoupon(req.validated.code);res.json({coupon:{code:coupon.code,name:coupon.name},quote:couponQuote(hold.quote,coupon)});}catch(e){next(e);}});

const checkoutSchema = z.object({ holdId: z.string(), couponCode:z.string().trim().min(2).optional(), customer: z.object({ name: z.string().min(2), email: z.string().email(), mobile: z.string().min(7), company: z.string().optional(), gstin: z.string().optional() }) });
router.post('/checkout', authenticate, validate(checkoutSchema), async (req, res, next) => {
  try {
    const hold = await Hold.findOne({ _id: req.validated.holdId, owner: req.user._id, status: 'active', expiresAt: { $gt: new Date() } });
    if (!hold) return res.status(410).json({ message: 'Your hold has expired. Please select the workspace again.' });
    const existing = await Booking.findOne({ hold: hold._id });
    if (existing) { const paymentOrder = await createPaymentOrder(existing); existing.payment.orderId = paymentOrder.orderId; existing.payment.status = 'pending'; await existing.save(); return res.json({ booking: existing, paymentOrder }); }
    const coupon=req.validated.couponCode?await activeCoupon(req.validated.couponCode):null,quote=coupon?couponQuote(hold.quote,coupon):hold.quote;
    const booking = await Booking.create({ bookingId: bookingReference(), user: req.user._id, workspace: hold.workspace, seat: hold.seat,seats:hold.seats, hold: hold._id, startAt: hold.startAt, endAt: hold.endAt, durationType: hold.durationType, amount: quote.base, tax: quote.tax, discount: quote.discount, total: quote.total, couponCode:coupon?.code, customer: req.validated.customer, payment: { provider: process.env.PAYMENT_PROVIDER || 'mock', status: 'pending' } });
    const paymentOrder = await createPaymentOrder(booking); booking.payment.orderId = paymentOrder.orderId; await booking.save();
    await User.findByIdAndUpdate(req.user._id, { $set: req.validated.customer });
    req.app.get('io').emit('operations:update', { resource: 'booking', action: 'created', id: booking._id });
    res.status(201).json({ booking, paymentOrder });
  } catch(e) { next(e); }
});

router.post('/:id/confirm-payment', authenticate, validate(z.object({ orderId: z.string(), paymentId: z.string(), signature: z.string() })), async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id, status: 'pending_payment' });
    if (!booking) return res.status(404).json({ message: 'Pending booking not found.' });
    const hold = await Hold.findOne({ _id: booking.hold, status: 'active', expiresAt: { $gt: new Date() } });
    if (!hold) return res.status(410).json({ message: 'The hold expired before payment could be confirmed.' });
    if (booking.payment.orderId !== req.validated.orderId || !await verifyPayment(req.validated)) { booking.payment.status = 'failed'; await booking.save(); return res.status(400).json({ message: 'Payment verification failed. Your booking was not confirmed.' }); }
    const { checkInToken } = await finalizePaidBooking(booking, req.validated.paymentId);
    req.app.get('io').emit('availability:update', { workspaceId: booking.workspace, seatId: booking.seat, reason: 'booking_confirmed' });
    req.app.get('io').emit('operations:update', { resource: 'booking', action: 'confirmed', id: booking._id });
    await audit(req, 'booking.confirmed', 'Booking', booking._id, { bookingId: booking.bookingId });
    notifyBooking(booking, 'confirmed').catch(error=>console.error('Booking email failed',error.message));
    res.json({ booking, checkInToken, qr: await qrDataUrl(checkInToken) });
  } catch(e) { next(e); }
});

// Temporary purchase mode: all booking records, locks, invoices and notifications are real;
// only the external money transfer is skipped. Production configuration rejects this mode.
router.post('/:id/confirm-purchase', authenticate, async (req, res, next) => {
  try {
    if (config.paymentProvider !== 'mock' || config.env === 'production') return res.status(409).json({ message: 'Direct purchase mode is not enabled.' });
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id, status: 'pending_payment', 'payment.provider': 'mock' });
    if (!booking) return res.status(404).json({ message: 'Pending purchase not found.' });
    booking.payment.method = 'direct_purchase';
    const { checkInToken } = await finalizePaidBooking(booking, `direct_${Date.now()}`);
    req.app.get('io').emit('availability:update', { workspaceId: booking.workspace, seatId: booking.seat, reason: 'purchase_confirmed' });
    req.app.get('io').emit('operations:update', { resource: 'booking', action: 'purchase_confirmed', id: booking._id });
    await audit(req, 'booking.direct_purchase_confirmed', 'Booking', booking._id, { bookingId: booking.bookingId });
    notifyBooking(booking, 'confirmed').catch(error => console.error('Booking email failed', error.message));
    res.json({ booking, checkInToken, qr: await qrDataUrl(checkInToken) });
  } catch (error) { next(error); }
});

router.get('/mine', authenticate, async (req, res, next) => { try { const items = await Booking.find({ user: req.user._id }).populate('workspace seat seats').sort({ startAt: -1 }).lean(); res.json({ items }); } catch(e) { next(e); } });
router.get('/notifications/mine',authenticate,async(req,res,next)=>{try{const audience=req.user.role==='super_admin'?['admins','all']:['customers','all'];res.json({items:await Notification.find({status:'sent',$or:[{recipients:req.user._id},{audience:{$in:audience},$or:[{recipients:{$exists:false}},{recipients:{$size:0}}]}]}).sort({sentAt:-1}).limit(100).lean()});}catch(e){next(e);}});
router.get('/mine/:id', authenticate, async (req,res,next)=>{try{const item=await Booking.findOne({_id:req.params.id,user:req.user._id}).populate('workspace seat seats').lean();if(!item)return res.status(404).json({message:'Booking not found.'});res.json({item,checkInToken:['confirmed','checked_in'].includes(item.status)?bookingCheckInToken(item):undefined});}catch(e){next(e);}});
router.get('/invoices/mine', authenticate, async (req, res, next) => { try { const items = await Invoice.find({ user: req.user._id }).populate({ path: 'booking', populate: [{ path: 'workspace' },{path:'seats'}] }).sort({ issuedAt: -1 }).lean(); res.json({ items }); } catch(e) { next(e); } });
router.get('/invoices/:id/pdf', authenticate, async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id }).populate({ path: 'booking', populate: [{path:'workspace'},{path:'seats'}] }).lean();
    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `${invoice.invoiceNumber} · TWS Tax Invoice`, Author: 'The Work Suites' } });
    doc.pipe(res);
    const green = '#123b35', orange = '#e78545', ink = '#17211f', muted = '#66736f', cream = '#f6f1e8', line = '#d9ddd9';
    const pageWidth = doc.page.width, margin = 48, contentWidth = pageWidth - margin * 2;
    const moneyText = value => `INR ${Number(value || 0).toFixed(2)}`;
    const dateText = value => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—';
    const label = (text, x, y) => doc.font('Helvetica-Bold').fontSize(7).fillColor(muted).text(String(text).toUpperCase(), x, y, { characterSpacing: 1.1 });
    const value = (text, x, y, width = 200) => doc.font('Helvetica').fontSize(10).fillColor(ink).text(text || '—', x, y, { width, lineGap: 2 });
    const booking = invoice.booking || {}, customer = booking.customer || {}, workspace = booking.workspace || {};

    doc.rect(0, 0, pageWidth, 128).fill(green);
    doc.rect(0, 124, pageWidth, 4).fill(orange);
    doc.font('Helvetica-Bold').fontSize(28).fillColor(orange).text('TWS', margin, 34);
    doc.font('Helvetica').fontSize(9).fillColor('#ffffff').text('THE WORK SUITES', margin + 67, 40, { characterSpacing: 2.1 });
    doc.fontSize(7).fillColor('#aac3bd').text('YOUR SPACE · YOUR PACE', margin + 67, 57, { characterSpacing: 1.3 });
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff').text('TAX INVOICE', pageWidth - 218, 35, { width: 170, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor('#aac3bd').text(invoice.invoiceNumber, pageWidth - 218, 64, { width: 170, align: 'right' });
    doc.text(`Issued ${new Date(invoice.issuedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`, pageWidth - 218, 79, { width: 170, align: 'right' });

    doc.roundedRect(margin, 154, contentWidth, 92, 12).fill(cream);
    label('Billed to', margin + 20, 173); value(customer.name, margin + 20, 189, 205); value(customer.email, margin + 20, 207, 205); value(customer.mobile, margin + 20, 224, 205);
    label('Booking reference', margin + 285, 173); value(booking.bookingId, margin + 285, 189, 190);
    label('Payment status', margin + 285, 214); doc.font('Helvetica-Bold').fontSize(9).fillColor('#24705f').text(String(booking.payment?.status || 'paid').replaceAll('_', ' ').toUpperCase(), margin + 285, 230, { width: 190 });

    doc.font('Helvetica-Bold').fontSize(15).fillColor(green).text('Booking details', margin, 278);
    doc.moveTo(margin, 302).lineTo(pageWidth - margin, 302).strokeColor(line).lineWidth(1).stroke();
    label('Workspace', margin, 320); value(`${workspace.name || 'Workspace booking'}${booking.seats?.length?` · Seats ${booking.seats.map(item=>item.number).join(', ')}`:''}`, margin, 336, 220);
    label('Schedule', margin + 265, 320); value(`${dateText(booking.startAt)}\nto ${dateText(booking.endAt)}`, margin + 265, 336, 235);
    label('Booking type', margin, 382); value(String(booking.durationType || 'workspace').replaceAll('_', ' '), margin, 398, 220);
    label('Location', margin + 265, 382); value('Bannerghatta Main Road, Kothnur, Kalena Agrahara, Bengaluru 560083', margin + 265, 398, 235);

    const tableY = 455;
    doc.roundedRect(margin, tableY, contentWidth, 42, 8).fill(green);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text('DESCRIPTION', margin + 16, tableY + 17).text('AMOUNT', pageWidth - 148, tableY + 17, { width: 100, align: 'right' });
    const rows = [
      ['Workspace reservation', moneyText(invoice.subtotal)],
      ['GST', moneyText(invoice.tax)],
      ...(Number(invoice.discount || booking.discount || 0) > 0 ? [['Discount', `- ${moneyText(invoice.discount || booking.discount)}`]] : [])
    ];
    let rowY = tableY + 43;
    rows.forEach(([name, amount], index) => {
      if (index % 2 === 0) doc.rect(margin, rowY, contentWidth, 38).fill('#fafaf8');
      doc.font('Helvetica').fontSize(9).fillColor(ink).text(name, margin + 16, rowY + 14);
      doc.font('Helvetica-Bold').text(amount, pageWidth - 148, rowY + 14, { width: 100, align: 'right' });
      rowY += 38;
    });
    doc.moveTo(margin, rowY + 5).lineTo(pageWidth - margin, rowY + 5).strokeColor(line).stroke();
    doc.font('Helvetica-Bold').fontSize(12).fillColor(green).text('TOTAL', margin + 275, rowY + 24, { width: 90, align: 'right' });
    doc.fontSize(16).fillColor(orange).text(moneyText(invoice.total), pageWidth - 190, rowY + 20, { width: 142, align: 'right' });

    doc.roundedRect(margin, 690, contentWidth, 62, 10).fill('#eef5f2');
    doc.font('Helvetica-Bold').fontSize(8).fillColor(green).text('THANK YOU FOR CHOOSING TWS', margin + 18, 708, { characterSpacing: .7 });
    doc.font('Helvetica').fontSize(8).fillColor(muted).text('This is a computer-generated invoice. Keep it with your booking confirmation and QR check-in pass.', margin + 18, 725, { width: contentWidth - 36 });
    const invoiceContact=[process.env.BUSINESS_PHONE,process.env.BUSINESS_EMAIL].filter(Boolean).join(' · ');
    doc.fontSize(7).fillColor('#7f8b87').text(`THE WORK SUITES · Bannerghatta Main Road, Bengaluru 560083${invoiceContact?` · ${invoiceContact}`:''}`, margin, 793, { width: contentWidth, align: 'center', characterSpacing: .35 });
    doc.end();
  } catch (e) { next(e); }
});
router.post('/:id/reconcile',authenticate,async(req,res,next)=>{try{const booking=await Booking.findOne({_id:req.params.id,user:req.user._id});if(!booking)return res.status(404).json({message:'Booking not found.'});if(booking.status!=='pending_payment')return res.json({booking,checkInToken:['confirmed','checked_in'].includes(booking.status)?bookingCheckInToken(booking):undefined});if(!await verifyPayment({orderId:booking.payment.orderId,paymentId:'reconciled',signature:process.env.PAYMENT_PROVIDER==='mock'?'development-approved':'cashfree-server-check'}))return res.status(409).json({message:'Payment is not marked paid yet.'});const result=await finalizePaidBooking(booking,'reconciled');req.app.get('io').emit('operations:update',{resource:'booking',action:'reconciled',id:booking._id});notifyBooking(booking,'confirmed').catch(()=>{});res.json(result);}catch(e){next(e);}});
router.patch('/:id/cancel', authenticate, async (req, res, next) => { try { const cancellationCutoff = new Date(Date.now() + 48 * 3600000); const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id, status: 'confirmed', startAt: { $gte: cancellationCutoff }, 'cancellation.status':{$nin:['requested','approved']} }); if (!booking) return res.status(409).json({ message: 'Cancellation requests close 48 hours before the booking starts.' }); const reason=String(req.body.reason||'').trim();if(reason.length<5)return res.status(422).json({message:'Please provide a clear cancellation reason.'});booking.cancellation={reason,requestedAt:new Date(),requestedBy:req.user._id,status:'requested',refundStatus:booking.payment.status==='paid'?'pending':'not_required'};await booking.save();await Notification.create({title:'Cancellation request',message:`${booking.customer?.name||'A customer'} requested cancellation for ${booking.bookingId}.`,audience:'admins',kind:'cancellation',booking:booking._id,status:'sent',sentAt:new Date()});await createCustomerNotification(booking.user,{title:'Cancellation request received',message:`Your request to cancel ${booking.bookingId} was sent to the administrator for review.`,kind:'cancellation',booking:booking._id});req.app.get('io').emit('operations:update',{resource:'cancellation',action:'requested',id:booking._id});await audit(req,'booking.cancellation_requested','Booking',booking._id,{reason});res.json({booking});}catch(e){next(e);} });

router.get('/', authenticate, authorize('super_admin'), async (req, res, next) => { try { const query = {}; if(req.query.status) query.status=req.query.status; const items = await Booking.find(query).populate('workspace seat seats user').sort({ startAt: -1 }).limit(200).lean(); res.json({ items }); } catch(e){ next(e); } });
router.post('/check-in', authenticate, authorize('super_admin'), validate(z.object({ token: z.string().min(20) })), async (req, res, next) => { try { const candidates = await Booking.find({ status: 'confirmed', startAt: { $lt: new Date(Date.now()+2*3600000) }, endAt: { $gt: new Date(Date.now()-2*3600000) } }); const booking = candidates.find(b => { const [salt,hash]=b.checkInTokenHash?.split(':')||[]; return salt && verifyHash(req.validated.token,salt,hash); }); if(!booking)return res.status(404).json({message:'QR is invalid or outside its valid check-in window.'}); booking.status='checked_in'; booking.checkedInAt=new Date(); await booking.save(); req.app.get('io').emit('operations:update',{resource:'booking',action:'checked_in',id:booking._id}); res.json({booking}); } catch(e){next(e);} });
export default router;
