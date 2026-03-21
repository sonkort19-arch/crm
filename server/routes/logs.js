import { Router } from 'express';
import * as c from '../controllers/userController.js';

const router = Router();

router.post('/', c.createLog);
router.get('/:userId', c.getLogsByUserId);

export default router;
