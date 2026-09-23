// Uses an isolated local replica set and mocked Cashfree HTTP. Never connects to Atlas.
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { Booking, Coupon, Hold, Invoice, Notification, PaymentEvent, ResourceLock, User } from '../src/models.js';
import { finalizePaidBooking, signToken } from '../src/services.js';

const realFetch = globalThis.fetch;
let database, server, base;
before(async () => {
  Object.assign(config, { env: 'production', paymentProvider: 'cashfree', jwtSecret: 'test-only-jwt-secret-not-for-production', clientUrl: 'https://frontend.example.com' });
  Object.assign(process.env, { CASHFREE_ENV: 'sandbox', CASHFREE_APP_ID: 'test-only-id', CASHFREE_SECRET_KEY: 'test-only-key', SMTP_HOST: '' });
  database = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(database.getUri('cashfree_tests'));
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  server = createApp({ emit() {} }).listen(0, '127.0.0.1');
  await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 180000 });
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await database?.stop(); });
beforeEach(async () => { await Promise.all(Object.values(mongoose.models).map(model => model.deleteMany({}))); });

async function fixture({ expired = false } = {}) {
  const user = await User.create({ name: 'Test', email: 'test@example.com', passwordHash: 'test', passwordSalt: 'test' });
  const workspace = new mongoose.Types.ObjectId(), startAt = new Date('2030-01-01T10:00:00Z'), endAt = new Date('2030-01-01T10:15:00Z');
  const expiresAt = new Date(Date.now() + (expired ? -1000 : 600000));
  const hold = await Hold.create({ owner: user._id, workspace, startAt, endAt, expiresAt });
  await ResourceLock.create({ resourceKey: `workspace:${workspace}`, slotStart: startAt, hold: hold._id, expiresAt });
  await Coupon.create({ code: 'TEST', name: 'Test', discountType: 'fixed', value: 1 });
  const booking = await Booking.create({ bookingId: 'TWS-TEST', user: user._id, workspace, hold: hold._id, startAt, endAt, amount: 100, tax: 18, total: 118, couponCode: 'TEST', customer: { name: 'Test', email: 'test@example.com', mobile: '9999999999' }, payment: { provider: 'cashfree', orderId: 'TWS_TEST', status: 'pending' } });
  return { booking, hold, user };
}
function webhook(booking, timestamp = '123') {
  const body = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: booking.payment.orderId }, payment: { cf_payment_id: 'payment-1', payment_status: 'SUCCESS' } } });
  return { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-timestamp': timestamp, 'x-webhook-signature': crypto.createHmac('sha256', process.env.CASHFREE_SECRET_KEY).update(timestamp + body).digest('base64') }, body };
}
const cashfreeOrder = () => new Response(JSON.stringify({ order_id: 'TWS_TEST', order_status: 'PAID', order_amount: 118, order_currency: 'INR' }), { status: 200 });

test('concurrent confirmations produce one invoice, notification and coupon usage', async () => {
  const { booking, hold } = await fixture();
  const copies = await Promise.all([Booking.findById(booking._id), Booking.findById(booking._id)]);
  const results = await Promise.all(copies.map(copy => finalizePaidBooking(copy, 'payment-1')));
  assert.ok(results.every(result => result.booking.status === 'confirmed'));
  assert.equal(await Invoice.countDocuments(), 1); assert.equal(await Notification.countDocuments(), 1);
  assert.equal((await Coupon.findOne({ code: 'TEST' })).usedCount, 1);
  assert.equal((await Hold.findById(hold._id)).status, 'converted');
  const lock = await ResourceLock.findOne({ hold: hold._id });
  assert.equal(lock.expiresAt, undefined); assert.equal(String(lock.booking), String(booking._id));
});

test('an invoice failure rolls back booking, hold, locks and coupon changes', async t => {
  const { booking, hold } = await fixture();
  const failing = t.mock.method(Invoice, 'findOneAndUpdate', async () => { throw new Error('test invoice failure'); });
  await assert.rejects(finalizePaidBooking(booking), /test invoice failure/);
  assert.equal((await Booking.findById(booking._id)).status, 'pending_payment');
  assert.equal((await Hold.findById(hold._id)).status, 'active');
  assert.equal((await Coupon.findOne({ code: 'TEST' })).usedCount, 0);
  assert.equal(await Notification.countDocuments(), 0);
  assert.ok((await ResourceLock.findOne({ hold: hold._id })).expiresAt);
  failing.mock.restore();
  await finalizePaidBooking(booking); assert.equal(await Invoice.countDocuments(), 1);
});

test('expired reservations cannot be fulfilled after payment', async () => {
  const { booking } = await fixture({ expired: true });
  await assert.rejects(finalizePaidBooking(booking), /hold expired/);
  assert.equal((await Booking.findById(booking._id)).status, 'pending_payment');
  assert.equal(await Invoice.countDocuments(), 0);
});

test('failed webhook processing is retried, then duplicates and browser confirmation are safe', async t => {
  const { booking, user } = await fixture();
  t.mock.method(globalThis, 'fetch', async () => cashfreeOrder());
  const failing = t.mock.method(Invoice, 'findOneAndUpdate', async () => { throw new Error('temporary invoice failure'); });
  let result = await realFetch(`${base}/api/payments/cashfree/webhook`, webhook(booking));
  assert.equal(result.status, 500); await result.text();
  assert.equal((await PaymentEvent.findOne()).processedAt, undefined);
  failing.mock.restore();
  result = await realFetch(`${base}/api/payments/cashfree/webhook`, webhook(booking, '124'));
  assert.equal(result.status, 200); await result.text();
  result = await realFetch(`${base}/api/payments/cashfree/webhook`, webhook(booking, '125'));
  assert.equal((await result.json()).duplicate, true);
  result = await realFetch(`${base}/api/bookings/${booking._id}/confirm-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken(user)}` }, body: JSON.stringify({ orderId: 'TWS_TEST', paymentId: 'browser', signature: 'ignored' }) });
  assert.equal(result.status, 200); assert.equal((await result.json()).booking.status, 'confirmed');
  assert.equal(await Invoice.countDocuments(), 1); assert.equal(await PaymentEvent.countDocuments(), 1);
});

test('invalid webhook signatures are rejected before any database change', async () => {
  const { booking } = await fixture(), request = webhook(booking);
  request.headers['x-webhook-signature'] = 'invalid';
  const result = await realFetch(`${base}/api/payments/cashfree/webhook`, request);
  assert.equal(result.status, 401); await result.text();
  assert.equal(await PaymentEvent.countDocuments(), 0);
  assert.equal((await Booking.findById(booking._id)).status, 'pending_payment');
});

test('public payment configuration exposes only provider, enabled and mode', async () => {
  const response = await realFetch(`${base}/api/payments/config`);
  assert.deepEqual(await response.json(), { provider: 'cashfree', enabled: true, mode: 'sandbox' });
});
