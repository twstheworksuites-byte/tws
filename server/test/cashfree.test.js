import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createPaymentOrder, verifyPayment, verifyCashfreeWebhook } from '../src/services.js';

const booking = { _id: 'booking-1', bookingId: 'TWS-123', total: 118, user: 'user-1', customer: { name: 'Test Customer', email: 'test@example.com', mobile: '+91 98765 43210' } };
const order = { order_id: 'TWS_123', order_amount: 118, order_currency: 'INR', order_status: 'ACTIVE', payment_session_id: 'test-session' };
function setup(t) {
  const previous = { ...config };
  Object.assign(config, { env: 'production', paymentProvider: 'cashfree', clientUrl: 'https://tws.example.com' });
  const keys = ['CASHFREE_APP_ID', 'CASHFREE_SECRET_KEY', 'CASHFREE_ENV'];
  const values = keys.map(key => process.env[key]);
  Object.assign(process.env, { CASHFREE_APP_ID: 'test-id', CASHFREE_SECRET_KEY: 'test-secret', CASHFREE_ENV: 'production' });
  t.after(() => { Object.assign(config, previous); keys.forEach((key, index) => values[index] === undefined ? delete process.env[key] : process.env[key] = values[index]); });
}
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('Cashfree creation uses server amount, stable retry key, and a recoverable return URL', async t => {
  setup(t); const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, ...options });
    return options.method === 'POST' ? response(order) : response({}, 404);
  });
  const first = await createPaymentOrder(booking), second = await createPaymentOrder(booking);
  assert.equal(first.paymentSessionId, 'test-session'); assert.equal(second.mode, 'production');
  const creates = requests.filter(request => request.method === 'POST');
  assert.equal(creates.length, 2);
  assert.equal(creates[0].headers['x-idempotency-key'], creates[1].headers['x-idempotency-key']);
  assert.match(creates[0].headers['x-idempotency-key'], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const body = JSON.parse(creates[0].body);
  assert.equal(body.order_amount, 118); assert.equal(body.customer_details.customer_phone, '+919876543210');
  assert.equal(body.order_meta.return_url, 'https://tws.example.com/checkout?booking_id=booking-1');
  assert.ok(creates.every(request => request.url === 'https://api.cashfree.com/pg/orders'));
});

test('retry reuses the existing Cashfree session and does not create another order', async t => {
  setup(t); const fetch = t.mock.method(globalThis, 'fetch', async () => response(order));
  const result = await createPaymentOrder(booking);
  assert.equal(result.paymentSessionId, 'test-session'); assert.equal(fetch.mock.callCount(), 1);
  assert.equal(fetch.mock.calls[0].arguments[1].method, undefined);
});

test('already-paid orders are reconciled instead of reopening checkout', async t => {
  setup(t); t.mock.method(globalThis, 'fetch', async () => response({ ...order, order_status: 'PAID' }));
  assert.equal((await createPaymentOrder(booking)).paid, true);
});

test('expired and mismatched existing orders cannot be used for checkout', async t => {
  setup(t); let data = { ...order, order_status: 'EXPIRED' };
  t.mock.method(globalThis, 'fetch', async () => response(data));
  await assert.rejects(createPaymentOrder(booking), /expired/);
  data = { ...order, order_amount: 1 };
  await assert.rejects(createPaymentOrder(booking), /does not match/);
});

test('payment verification requires PAID and matching order, amount and currency', async t => {
  setup(t); let data = { ...order, order_status: 'PAID' };
  t.mock.method(globalThis, 'fetch', async () => response(data));
  const verify = () => verifyPayment({ orderId: 'TWS_123', amount: 118 });
  assert.equal(await verify(), true);
  for (const override of [{ order_status: 'ACTIVE' }, { order_id: 'another-order' }, { order_amount: 1 }, { order_currency: 'USD' }]) {
    data = { ...order, order_status: 'PAID', ...override }; assert.equal(await verify(), false);
  }
  data = { ...order, order_status: 'PAID' };
  assert.equal(await verifyPayment({ orderId: 'TWS_123' }), false);
});

test('disabled payments and production mock cannot confirm payments', async t => {
  setup(t); t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network request'); });
  config.paymentProvider = 'disabled';
  await assert.rejects(createPaymentOrder(booking), /not enabled/);
  assert.equal(await verifyPayment({ orderId: 'anything' }), false);
  config.paymentProvider = 'mock';
  await assert.rejects(createPaymentOrder(booking), /production payment provider/);
  assert.equal(await verifyPayment({ signature: 'development-approved' }), false);
  assert.equal(verifyCashfreeWebhook('{}', '123', 'invalid'), false);
});
