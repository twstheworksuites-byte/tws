import { Router } from 'express';
import { SiteContent } from '../models.js';

const router=Router();
router.get('/:key',async(req,res,next)=>{try{const item=await SiteContent.findOne({key:req.params.key,published:true}).lean();res.json({item:item||null});}catch(error){next(error)}});
export default router;
