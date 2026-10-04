import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { config } from './config.js';
import { AuditLog, Booking, Coupon, Hold, Invoice, Maintenance, Notification, ResourceLock } from './models.js';

export const hashValue = (value, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(value, salt, 64).toString('hex') });
export const verifyHash = (value, salt, hash) => crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(value, salt, 64));
export const signToken = user => jwt.sign({ sub: user._id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
export const randomToken = () => crypto.randomBytes(32).toString('base64url');
export const bookingCheckInToken = booking => crypto.createHmac('sha256', config.jwtSecret).update(`checkin:${booking._id}`).digest('base64url');

export async function sendEmail({ to, subject, text, html }) {
  if (process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
    return transporter.sendMail({ from: process.env.EMAIL_FROM || 'TWS The Work Suites <bookings@example.com>', to, subject, text, html });
  }
  if (config.env !== 'production' && process.env.DEV_EMAIL_CAPTURE === 'true') { console.info(`[DEV EMAIL] ${subject} -> ${to}\n${text}`); return; }
  throw Object.assign(new Error('Email delivery is not configured.'), { status: 503 });
}

export function notifyBooking(booking, event) {
  const labels = { confirmed: 'Booking confirmed', cancelled: 'Booking cancelled', rescheduled: 'Booking rescheduled', refunded: 'Booking refund update', reminder: 'Upcoming workspace booking' };
  const subject = `${labels[event] || 'Booking update'} · ${booking.bookingId}`;
  const schedule=new Date(booking.startAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}),text = `${labels[event] || 'Your booking was updated'}. Booking ${booking.bookingId}, ${schedule} IST. Status: ${booking.status}.`;
  return sendEmail({ to: booking.customer.email, subject, text, html: `<div style="font-family:Arial,sans-serif;padding:28px;color:#153f3a"><h2>TWS · The Work Suites</h2><h3>${labels[event] || 'Booking update'}</h3><p><strong>${booking.bookingId}</strong></p><p>${schedule} IST</p><p>Status: ${booking.status}</p></div>` });
}

export function createCustomerNotification(userId, { title, message, kind = 'system', booking }) {
  if (!userId) return Promise.resolve(null);
  return Notification.create({
    title,
    message,
    audience: 'selected_customers',
    recipients: [userId],
    kind,
    booking,
    status: 'sent',
    sentAt: new Date()
  });
}

export async function audit(req, action, entityType, entityId, metadata = {}) {
  try { await AuditLog.create({ actor: req.user?._id, action, entityType, entityId, metadata, ip: req.ip, userAgent: req.get('user-agent') }); } catch (error) { console.error('Audit log failed', error.message); }
}

export function slotsBetween(startAt, endAt) {
  const start = new Date(startAt), end = new Date(endAt);
  const slot = 15 * 60 * 1000;
  const cursor = new Date(Math.floor(start.getTime() / slot) * slot);
  const result = [];
  while (cursor < end) { result.push(new Date(cursor)); cursor.setTime(cursor.getTime() + slot); }
  if (!result.length || end <= start || result.length > 2976) throw Object.assign(new Error('Invalid booking period.'), { status: 422 });
  return result;
}

export function resourceKey(workspaceId, seatId) { return seatId ? `seat:${seatId}` : `workspace:${workspaceId}`; }
export function calculateQuote(workspace, durationType, startAt, endAt) {
  if (!workspace.allowedDurations.includes(durationType)) throw Object.assign(new Error('That duration is not offered for this workspace.'), { status: 422 });
  const hours = (new Date(endAt) - new Date(startAt)) / 3600000;
  const units = { hourly: hours, daily: Math.ceil(hours / 24), weekly: Math.ceil(hours / 168), monthly: Math.ceil(hours / 720) }[durationType];
  const rate = workspace.pricing?.[durationType];
  if (!rate || units <= 0) throw Object.assign(new Error('Pricing is not configured for this duration.'), { status: 422 });
  const meetingPackage = workspace.type === 'meeting_room' && durationType === 'hourly' ? ({ 4: 2156, 8: 4312 })[hours] : undefined;
  const base = meetingPackage ?? Math.round(rate * units * 100) / 100;
  const tax = Math.round(base * config.taxRate * 100) / 100;
  return { base, tax, discount: 0, total: base + tax };
}

export function bookingReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `${config.bookingPrefix}-${date}-${crypto.randomInt(10000, 99999)}`;
}

export async function createPaymentOrder(booking) {
  if (!['cashfree', 'mock'].includes(config.paymentProvider)) throw Object.assign(new Error('Online payments are not enabled.'), { status: 503 });
  if (config.paymentProvider === 'mock' && config.env === 'production') throw Object.assign(new Error('A production payment provider must be configured.'), { status: 503 });
  if (config.paymentProvider === 'cashfree') {
    if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) throw Object.assign(new Error('Cashfree credentials are not configured.'), { status: 503 });
    const baseUrl = process.env.CASHFREE_ENV === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    const orderId = booking.bookingId.replaceAll('-', '_');
    const headers = { 'Content-Type': 'application/json', 'x-api-version': process.env.CASHFREE_API_VERSION || '2025-01-01', 'x-client-id': process.env.CASHFREE_APP_ID, 'x-client-secret': process.env.CASHFREE_SECRET_KEY };
    // Reuse an existing order after a closed checkout or a lost create response.
    const previous = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, { headers, signal: AbortSignal.timeout(15_000) });
    if (previous.ok) {
      const data = await previous.json();
      if (data.order_id !== orderId || data.order_currency !== 'INR' || Math.round(Number(data.order_amount) * 100) !== Math.round(booking.total * 100)) throw Object.assign(new Error('Payment order does not match this booking. Please contact support.'), { status: 409 });
      return cashfreeSession(data, booking.total);
    }
    if (previous.status !== 404) throw Object.assign(new Error('Cashfree could not check the payment order. Please try again.'), { status: 502 });
    const key = crypto.createHash('sha256').update(`cashfree:${orderId}`).digest('hex');
    const idempotencyKey = `${key.slice(0,8)}-${key.slice(8,12)}-4${key.slice(13,16)}-a${key.slice(17,20)}-${key.slice(20,32)}`;
    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { ...headers, 'x-idempotency-key': idempotencyKey },
      body: JSON.stringify({ order_id: orderId, order_amount: booking.total, order_currency: 'INR', customer_details: { customer_id: String(booking.user), customer_name: booking.customer.name, customer_email: booking.customer.email, customer_phone: booking.customer.mobile.replace(/[\s()-]/g, '') }, order_meta: { return_url: `${config.clientUrl.split(',')[0].trim().replace(/\/$/, '')}/checkout?booking_id=${booking._id}` }, order_note: `Workspace booking ${booking.bookingId}` }),
      signal: AbortSignal.timeout(15_000)
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message || 'Cashfree could not create the payment order.'), { status: 502 });
    return cashfreeSession(data, booking.total);
  }
  return { provider: config.paymentProvider, orderId: `order_${crypto.randomBytes(10).toString('hex')}`, amount: Math.round(booking.total * 100), currency: 'INR', development: config.paymentProvider === 'mock' };
}

function cashfreeSession(data, total) {
  if (!['ACTIVE', 'PAID'].includes(data.order_status)) throw Object.assign(new Error('This payment order has expired or is unavailable. Please select the workspace again.'), { status: 409 });
  if (data.order_status === 'ACTIVE' && !data.payment_session_id) throw Object.assign(new Error('Cashfree did not return a checkout session.'), { status: 502 });
  return { provider: 'cashfree', orderId: data.order_id, paymentSessionId: data.payment_session_id, paid: data.order_status === 'PAID', amount: Math.round(total * 100), currency: 'INR', mode: process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox' };
}

export async function verifyPayment({ orderId, signature, amount }) {
  if (config.paymentProvider === 'mock') return config.env !== 'production' && signature === 'development-approved';
  if (config.paymentProvider === 'cashfree') {
    const baseUrl = process.env.CASHFREE_ENV === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    const response = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, { headers: { 'x-api-version': process.env.CASHFREE_API_VERSION || '2025-01-01', 'x-client-id': process.env.CASHFREE_APP_ID, 'x-client-secret': process.env.CASHFREE_SECRET_KEY }, signal: AbortSignal.timeout(15_000) });
    const data = await response.json();
    return response.ok && data.order_status === 'PAID' && data.order_id === orderId && data.order_currency === 'INR' && Number.isFinite(amount) && Math.round(Number(data.order_amount) * 100) === Math.round(amount * 100);
  }
  return false;
}

export function verifyCashfreeWebhook(rawBody, timestamp, signature) {
  if (!process.env.CASHFREE_SECRET_KEY || !timestamp || !signature) return false;
  const expected = crypto.createHmac('sha256', process.env.CASHFREE_SECRET_KEY).update(`${timestamp}${rawBody}`).digest('base64');
  const supplied = Buffer.from(signature); const calculated = Buffer.from(expected);
  return supplied.length === calculated.length && crypto.timingSafeEqual(supplied, calculated);
}

export async function refundPayment(booking, amount) {
  if (booking.payment.provider === 'mock') return { refundId: `refund_dev_${crypto.randomBytes(8).toString('hex')}`, status: 'SUCCESS' };
  if (booking.payment.provider !== 'cashfree') throw Object.assign(new Error('Refunds are not supported for this payment provider.'), { status: 422 });
  const baseUrl = process.env.CASHFREE_ENV === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  const refundId = `refund_${booking.bookingId}_${Date.now()}`.replaceAll('-', '_');
  const response = await fetch(`${baseUrl}/orders/${encodeURIComponent(booking.payment.orderId)}/refunds`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-version': process.env.CASHFREE_API_VERSION || '2025-01-01', 'x-client-id': process.env.CASHFREE_APP_ID, 'x-client-secret': process.env.CASHFREE_SECRET_KEY, 'x-idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ refund_amount: amount, refund_id: refundId, refund_note: `Refund for ${booking.bookingId}`, refund_speed: 'STANDARD' }), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || 'Cashfree could not create the refund.'), { status: 502 });
  return { refundId: data.cf_refund_id || data.refund_id || refundId, status: data.refund_status || 'PENDING' };
}

export async function finalizePaidBooking(booking, paymentId = 'server-verified') {
  if (booking.payment.provider === 'cashfree') {
    // Atlas transactions make simultaneous browser/webhook confirmations atomic.
    const result = await Booking.db.transaction(async session => {
      const current = await Booking.findById(booking._id).session(session);
      if (!current) throw Object.assign(new Error('Booking not found.'), { status: 404 });
      if (['confirmed', 'checked_in', 'completed'].includes(current.status)) return { booking: current, checkInToken: bookingCheckInToken(current) };
      if (current.status !== 'pending_payment') throw Object.assign(new Error('This booking cannot be confirmed. Contact support if you were charged.'), { status: 409 });
      const hold = await Hold.findOne({ _id: current.hold, status: 'active', expiresAt: { $gt: new Date() } }).session(session);
      if (!hold) throw Object.assign(new Error('The hold expired before payment could be finalized. Do not pay again; contact support for reconciliation or a refund.'), { status: 409 });
      const expectedLocks = slotsBetween(current.startAt, current.endAt).length * Math.max(1, current.seats?.length || 0);
      const lockCount = await ResourceLock.countDocuments({ hold: hold._id }).session(session);
      if (lockCount !== expectedLocks) throw Object.assign(new Error('The reservation is no longer available. Do not pay again; contact support for a refund.'), { status: 409 });
      const checkInToken = bookingCheckInToken(current), { hash, salt } = hashValue(checkInToken);
      current.status = 'confirmed'; current.payment.status = 'paid'; current.payment.paymentId = paymentId; current.checkInTokenHash = `${salt}:${hash}`;
      await current.save({ session });
      if (current.couponCode) await Coupon.updateOne({ code: current.couponCode }, { $inc: { usedCount: 1 } }, { session });
      await ResourceLock.updateMany({ hold: hold._id }, { $set: { booking: current._id }, $unset: { expiresAt: 1 } }, { session });
      hold.status = 'converted'; hold.expiresAt = undefined; await hold.save({ session });
      await Invoice.findOneAndUpdate({ booking: current._id }, { $setOnInsert: { invoiceNumber: `INV-${current.bookingId}`, booking: current._id, user: current.user, subtotal: current.amount, tax: current.tax, total: current.total, issuedAt: new Date() } }, { upsert: true, session });
      await Notification.create([{ title: 'Booking confirmed', message: `Your booking ${current.bookingId} is confirmed. Open My Bookings for the schedule, seats and check-in details.`, audience: 'selected_customers', recipients: [current.user], kind: 'booking', booking: current._id, status: 'sent', sentAt: new Date() }], { session });
      return { booking: current, checkInToken };
    });
    booking.set(result.booking.toObject());
    return { booking, checkInToken: result.checkInToken };
  }
  if (booking.status === 'confirmed' || booking.status === 'checked_in' || booking.status === 'completed') return { booking, checkInToken: bookingCheckInToken(booking) };
  const hold = await Hold.findOne({ _id: booking.hold, status: 'active', expiresAt: { $gt: new Date() } });
  if (!hold) throw Object.assign(new Error('The booking hold expired before payment could be finalized. Contact support for reconciliation.'), { status: 409 });
  const checkInToken = bookingCheckInToken(booking), { hash, salt } = hashValue(checkInToken);
  booking.status = 'confirmed'; booking.payment.status = 'paid'; booking.payment.paymentId = paymentId; booking.checkInTokenHash = `${salt}:${hash}`; await booking.save();
  if(booking.couponCode)await Coupon.updateOne({code:booking.couponCode},{$inc:{usedCount:1}});
  await ResourceLock.updateMany({ hold: hold._id }, { $set: { booking: booking._id }, $unset: { expiresAt: 1 } });
  hold.status = 'converted'; hold.expiresAt = undefined; await hold.save();
  await Invoice.findOneAndUpdate({ booking: booking._id }, { $setOnInsert: { invoiceNumber: `INV-${booking.bookingId}`, booking: booking._id, user: booking.user, subtotal: booking.amount, tax: booking.tax, total: booking.total, issuedAt: new Date() } }, { upsert: true, new: true });
  await createCustomerNotification(booking.user, { title: 'Booking confirmed', message: `Your booking ${booking.bookingId} is confirmed. Open My Bookings for the schedule, seats and check-in details.`, kind: 'booking', booking: booking._id });
  return { booking, checkInToken };
}

export async function finalizeBookingWithoutPayment(booking) {
  const hold = await Hold.findOne({ _id: booking.hold, status: 'active', expiresAt: { $gt: new Date() } });
  if (!hold) throw Object.assign(new Error('The booking hold expired. Please select the workspace again.'), { status: 409 });
  const expectedLocks = slotsBetween(booking.startAt, booking.endAt).length * Math.max(1, booking.seats?.length || 0);
  const lockCount = await ResourceLock.countDocuments({ hold: hold._id });
  if (lockCount !== expectedLocks) throw Object.assign(new Error('The selected workspace is no longer available.'), { status: 409 });
  const checkInToken = bookingCheckInToken(booking), { hash, salt } = hashValue(checkInToken);
  booking.status = 'confirmed';
  booking.payment.provider = 'disabled';
  booking.payment.method = 'pay_at_office';
  booking.payment.status = 'pending';
  booking.checkInTokenHash = `${salt}:${hash}`;
  await booking.save();
  await ResourceLock.updateMany({ hold: hold._id }, { $set: { booking: booking._id }, $unset: { expiresAt: 1 } });
  hold.status = 'converted'; hold.expiresAt = undefined; await hold.save();
  await createCustomerNotification(booking.user, { title: 'Booking recorded', message: `Your booking ${booking.bookingId} is recorded. TWS will contact you to complete payment and confirm any final details.`, kind: 'booking', booking: booking._id });
  return { booking, checkInToken };
}

export async function runBookingJobs(io) {
  const now = new Date();
  const completed = await Booking.updateMany({ status: { $in: ['confirmed','checked_in'] }, endAt: { $lte: now } }, { status: 'completed' });
  const expiredMaintenance = await Maintenance.find({ status: { $in: ['scheduled','active'] }, endAt: { $lte: now } }).select('_id').lean();
  const maintenanceCompleted = expiredMaintenance.length
    ? await Maintenance.updateMany({ _id: { $in: expiredMaintenance.map(item => item._id) } }, { status: 'completed' })
    : { modifiedCount: 0 };
  if (expiredMaintenance.length) await ResourceLock.deleteMany({ maintenance: { $in: expiredMaintenance.map(item => item._id) } });
  const maintenanceActivated = await Maintenance.updateMany({ status: 'scheduled', startAt: { $lte: now }, endAt: { $gt: now } }, { status: 'active' });
  const reminders = await Booking.find({ status: 'confirmed', reminderSentAt: null, startAt: { $gt: new Date(now.getTime()+23*3600000), $lte: new Date(now.getTime()+24*3600000) } });
  for (const booking of reminders) { try { await notifyBooking(booking,'reminder'); booking.reminderSentAt=new Date(); await booking.save(); } catch(error) { console.error('Reminder failed',error.message); } }
  if (completed.modifiedCount || reminders.length || maintenanceCompleted.modifiedCount || maintenanceActivated.modifiedCount) io?.emit('operations:update',{resource:'booking',action:'scheduled_job'});
}

export async function qrDataUrl(token) { return QRCode.toDataURL(token, { margin: 1, width: 280, color: { dark: '#153f3a', light: '#ffffff' } }); }
