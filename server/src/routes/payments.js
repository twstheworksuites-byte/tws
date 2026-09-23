import { Router } from 'express';
import { Booking, PaymentEvent } from '../models.js';
import { config } from '../config.js';
import { finalizePaidBooking, notifyBooking, verifyCashfreeWebhook, verifyPayment } from '../services.js';

const router = Router();

router.get('/config', (req, res) => {
  const enabled = config.paymentProvider === 'cashfree' || (config.paymentProvider === 'mock' && config.env !== 'production');
  res.set('Cache-Control', 'no-store').json({ provider: enabled ? config.paymentProvider : 'disabled', enabled, mode: process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox' });
});

router.post('/cashfree/webhook', async (req, res, next) => {
  try {
    const rawBody = req.body.toString('utf8');
    const timestamp = req.get('x-webhook-timestamp'), signature = req.get('x-webhook-signature');
    if (!verifyCashfreeWebhook(rawBody, timestamp, signature)) return res.status(401).json({ message: 'Invalid webhook signature.' });
    const payload = JSON.parse(rawBody), eventType = payload.type || payload.event_type;
    const orderId = payload.data?.order?.order_id, paymentId = payload.data?.payment?.cf_payment_id;
    const refund = payload.data?.refund;
    const eventId = `${eventType}:${orderId}:${refund ? `${refund.cf_refund_id || refund.refund_id}:${refund.refund_status}` : paymentId || 'order'}`;
    try { await PaymentEvent.create({ eventId, eventType, orderId, verified: true }); } catch (error) {
      if (error.code !== 11000) throw error;
      const previous = await PaymentEvent.findOne({ eventId });
      if (previous?.processedAt) return res.json({ received: true, duplicate: true });
      // An earlier delivery failed. Retry processing rather than discarding it.
    }
    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' && orderId) {
      if (payload.data?.payment?.payment_status !== 'SUCCESS') return res.status(400).json({ message: 'Invalid payment success event.' });
      const booking = await Booking.findOne({ 'payment.orderId': orderId });
      if (!booking) return res.status(503).json({ message: 'Payment order is not recorded yet. Retry delivery.' });
      if (booking.status === 'pending_payment') {
        if (!await verifyPayment({ orderId, amount: booking.total })) return res.status(503).json({ message: 'Payment verification is pending. Retry delivery.' });
        await finalizePaidBooking(booking, String(paymentId || 'webhook'));
        req.app.get('io').emit('availability:update', { workspaceId: booking.workspace, seatId: booking.seat, reason: 'payment_webhook_confirmed' });
        req.app.get('io').emit('operations:update', { resource: 'booking', action: 'webhook_confirmed', id: booking._id });
        notifyBooking(booking, 'confirmed').catch(error => console.error('Webhook email failed', error.message));
      }
    }
    if (eventType?.includes('REFUND') && orderId) {
      const booking=await Booking.findOne({'payment.orderId':orderId});
      if(booking){const refund=payload.data?.refund||{};booking.payment.refundId=String(refund.cf_refund_id||refund.refund_id||booking.payment.refundId||'');booking.payment.refundStatus=refund.refund_status||booking.payment.refundStatus;booking.payment.refundAmount=Number(refund.refund_amount||booking.payment.refundAmount||0);if(booking.payment.refundStatus==='SUCCESS')booking.payment.status=booking.payment.refundAmount>=booking.total?'refunded':'partially_refunded';await booking.save();req.app.get('io').emit('operations:update',{resource:'booking',action:'refund_updated',id:booking._id});notifyBooking(booking,'refunded').catch(()=>{});}
    }
    if (eventType === 'PAYMENT_FAILED_WEBHOOK' && orderId) await Booking.updateOne({'payment.orderId':orderId,status:'pending_payment'},{'payment.status':'failed'});
    await PaymentEvent.updateOne({ eventId }, { processedAt: new Date() });
    res.json({ received: true });
  } catch (error) { next(error); }
});

export default router;
