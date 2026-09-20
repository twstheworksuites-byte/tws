import { Router } from 'express';
import { z } from 'zod';
import { Workspace, Seat, ResourceLock, Maintenance } from '../models.js';
import { audit, resourceKey, slotsBetween } from '../services.js';
import { authenticate, authorize, validate } from '../middleware.js';

const router = Router();
router.get('/', async (req, res, next) => {
  try {
    const query = { bookable: true, status: { $ne: 'inactive' } };
    if (req.query.type) query.type = req.query.type;
    if (req.query.floor) query.floor = req.query.floor;
    if (req.query.capacity) query.capacity = { $gte: Number(req.query.capacity) };
    const items = await Workspace.find(query).sort({ floor: 1, type: 1, name: 1 }).lean();
    res.json({ items });
  } catch (error) { next(error); }
});

router.get('/availability', async (req, res, next) => {
  try {
    const startAt = new Date(req.query.startAt), endAt = new Date(req.query.endAt);
    if (!Number.isFinite(+startAt) || !Number.isFinite(+endAt) || endAt <= startAt) return res.status(422).json({ message: 'Choose a valid date and time.' });
    const workspaceFilter = req.query.workspace ? { _id: req.query.workspace } : { bookable: true };
    const workspaces = await Workspace.find(workspaceFilter).lean();
    const ids = workspaces.map(w => w._id);
    const seats = await Seat.find({ workspace: { $in: ids }, bookable: true }).lean();
    const keys = [...workspaces.map(w => resourceKey(w._id)), ...seats.map(s => resourceKey(s.workspace, s._id))];
    const locks = await ResourceLock.find({ resourceKey: { $in: keys }, slotStart: { $lt: endAt, $gte: new Date(startAt.getTime() - 15 * 60_000) } }).lean();
    const lockStates = new Map(locks.map(lock => [lock.resourceKey, lock.hold ? 'held' : 'booked']));
    const now = new Date();
    const maintenance = await Maintenance.find({ workspace: { $in: ids }, status: { $in: ['scheduled', 'active'] }, startAt: { $lt: endAt }, endAt: { $gt: startAt } }).lean();
    const maintenanceKeys = new Set(maintenance.map(m => resourceKey(m.workspace, m.seat)));
    res.json({
      startAt, endAt,
      workspaces: workspaces.map(w => { const key=resourceKey(w._id); return { ...w, availability: w.status !== 'active' ? (w.status === 'inactive' ? 'blocked' : w.status) : maintenanceKeys.has(key) ? 'maintenance' : lockStates.get(key) || 'available' }; }),
      seats: seats.map(s => { const key=resourceKey(s.workspace,s._id),parent=workspaces.find(w=>String(w._id)===String(s.workspace)),parentKey=resourceKey(s.workspace);return{...s,availability:parent?.status!=='active'?(parent?.status==='inactive'?'blocked':parent?.status):s.status!=='active'?(s.status==='inactive'?'blocked':s.status):maintenanceKeys.has(parentKey)||maintenanceKeys.has(key)?'maintenance':lockStates.get(key)||'available'}; }),
      generatedAt: now
    });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => { try { const item = await Workspace.findById(req.params.id).lean(); if (!item) return res.status(404).json({ message: 'Workspace not found.' }); const seats = await Seat.find({ workspace: item._id }).lean(); res.json({ item, seats }); } catch (e) { next(e); } });

const workspaceInput = z.object({ name: z.string().min(2), slug: z.string().min(2), type: z.enum(['hot_desk','dedicated_desk','private_cabin','meeting_room','conference_room','phone_booth']), floor: z.string(), zone: z.string().optional(), capacity: z.number().int().positive(), description: z.string().optional(), image: z.string().optional(), amenities: z.array(z.string()).default([]), pricing: z.object({ hourly: z.number().nonnegative().optional(), daily: z.number().nonnegative().optional(), weekly: z.number().nonnegative().optional(), monthly: z.number().nonnegative().optional() }), allowedDurations: z.array(z.enum(['hourly','daily','weekly','monthly'])), status: z.enum(['active','maintenance','blocked','inactive']).default('active'), bookable: z.boolean().default(true) });
router.post('/', authenticate, authorize('super_admin'), validate(workspaceInput), async (req, res, next) => { try { const item=await Workspace.create(req.validated);await audit(req,'workspace.created','Workspace',item._id);req.app.get('io').emit('operations:update',{resource:'workspace',action:'created',id:item._id});res.status(201).json({ item }); } catch(e) { next(e); } });
router.patch('/:id', authenticate, authorize('super_admin'), async (req, res, next) => { try { const item = await Workspace.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });await audit(req,'workspace.updated','Workspace',item?._id,req.body);req.app.get('io').emit('availability:update',{workspaceId:item?._id,reason:'workspace_updated'});req.app.get('io').emit('operations:update',{resource:'workspace',action:'updated',id:item?._id});res.json({ item }); } catch(e) { next(e); } });
export default router;
