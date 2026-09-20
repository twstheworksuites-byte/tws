import { Router } from 'express';
import { Booking, PaymentEvent } from '../models.js';
import { finalizePaidBooking, notifyBooking, verifyCashfreeWebhook, verifyPayment } from '../services.js';

const router = Router();

router.post('/cashfree/webhook', async (req, res, next) => {
  try {
    const rawBody = req.body.toString('utf8');
    const timestamp = req.get('x-webhook-timestamp'), signature = req.get('x-webhook-signature');
    if (!verifyCashfreeWebhook(rawBody, timestamp, signature)) return res.status(401).json({ message: 'Invalid webhook signature.' });
    const payload = JSON.parse(rawBody), eventType = payload.type || payload.event_type;
    const orderId = payload.data?.order?.order_id, paymentId = payload.data?.payment?.cf_payment_id;
    const eventId = `${eventType}:${paymentId || orderId}:${timestamp}`;
    try { await PaymentEvent.create({ eventId, eventType, orderId, verified: true }); } catch (error) { if (error.code === 11000) return res.json({ received: true, duplicate: true }); throw error; }
    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' && orderId) {
      const booking = await Booking.findOne({ 'payment.orderId': orderId });
      if (booking && booking.status === 'pending_payment' && await verifyPayment({ orderId, paymentId: String(paymentId || 'webhook'), signature: 'cashfree-server-check' })) {
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
