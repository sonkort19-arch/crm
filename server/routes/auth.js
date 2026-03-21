import { Router } from 'express';
import * as auth from '../auth/authController.js';
import { requireAuth } from '../auth/authMiddleware.js';

const router = Router();

router.post('/login', auth.login);
router.get('/me', requireAuth, auth.me);
router.post('/logout', requireAuth, auth.logout);

export default router;
