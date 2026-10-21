import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { calculateQuote, hashValue, isStaffAssignedDesk, reservationResourceKeys, resourceKey, slotsBetween, verifyCashfreeWebhook, verifyHash } from '../src/services.js';

test('creates deterministic 15-minute conflict slots',()=>{
  const slots=slotsBetween('2026-08-25T10:07:00Z','2026-08-25T11:00:00Z');
  assert.equal(slots.length,4); assert.equal(slots[0].toISOString(),'2026-08-25T10:00:00.000Z');
});
test('uses seat as the exclusive resource when present',()=>assert.equal(resourceKey('workspace-1','seat-4'),'seat:seat-4'));
test('keeps staff-assigned desk reservations independent',()=>{
  assert.equal(isStaffAssignedDesk({type:'hot_desk'}),true);
  assert.equal(isStaffAssignedDesk({type:'dedicated_desk'}),true);
  assert.deepEqual(reservationResourceKeys({type:'hot_desk'},'workspace-1',[],'hold-1'),['allocation:workspace-1:hold-1']);
  assert.deepEqual(reservationResourceKeys({type:'dedicated_desk'},'workspace-1',[],'hold-2'),['allocation:workspace-1:hold-2']);
  assert.deepEqual(reservationResourceKeys({type:'meeting_room'},'workspace-1',[],'hold-3'),['workspace:workspace-1']);
  assert.deepEqual(reservationResourceKeys({type:'private_cabin'},'workspace-1',['seat-4'],'hold-4'),['seat:seat-4']);
});
test('calculates server-side hourly price and tax',()=>{
  const workspace={allowedDurations:['hourly'],pricing:{hourly:120}};
  assert.deepEqual(calculateQuote(workspace,'hourly','2026-08-25T10:00:00Z','2026-08-25T12:00:00Z'),{base:240,tax:43.2,discount:0,total:283.2});
});
test('applies the 10% meeting-room discount for every selected hour count',()=>{
  const workspace={type:'meeting_room',allowedDurations:['hourly'],pricing:{hourly:599}};
  assert.deepEqual(calculateQuote(workspace,'hourly','2026-08-25T10:00:00Z','2026-08-25T12:00:00Z'),{base:1198,tax:194.08,discount:119.8,total:1272.28});
  assert.deepEqual(calculateQuote(workspace,'hourly','2026-08-25T10:00:00Z','2026-08-25T14:00:00Z'),{base:2396,tax:388.15,discount:239.6,total:2544.55});
  assert.deepEqual(calculateQuote(workspace,'hourly','2026-08-25T10:00:00Z','2026-08-25T18:00:00Z'),{base:4792,tax:776.3,discount:479.2,total:5089.1});
});
test('updates meeting-room package prices when the admin hourly rate changes',()=>{
  const workspace={type:'meeting_room',allowedDurations:['hourly'],pricing:{hourly:700}};
  assert.deepEqual(calculateQuote(workspace,'hourly','2026-08-25T10:00:00Z','2026-08-25T14:00:00Z'),{base:2800,tax:453.6,discount:280,total:2973.6});
});
test('hashes and verifies passwords without storing plaintext',()=>{const value=hashValue('StrongPassword123');assert.notEqual(value.hash,'StrongPassword123');assert.equal(verifyHash('StrongPassword123',value.salt,value.hash),true);assert.equal(verifyHash('WrongPassword123',value.salt,value.hash),false);});
test('verifies Cashfree webhook signatures against the untouched raw body',()=>{const previous=process.env.CASHFREE_SECRET_KEY;process.env.CASHFREE_SECRET_KEY='cashfree-test-secret';const body='{"type":"PAYMENT_SUCCESS_WEBHOOK"}',timestamp='1724567890',signature=crypto.createHmac('sha256',process.env.CASHFREE_SECRET_KEY).update(timestamp+body).digest('base64');assert.equal(verifyCashfreeWebhook(body,timestamp,signature),true);assert.equal(verifyCashfreeWebhook(body+' ',timestamp,signature),false);process.env.CASHFREE_SECRET_KEY=previous;});
