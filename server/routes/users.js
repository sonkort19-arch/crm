import { Router } from 'express';
import * as c from '../controllers/userController.js';
import { requireRole } from '../auth/requireRole.js';

const router = Router();

router.get('/', c.listUsers);
router.post('/', requireRole('admin'), c.createUser);
router.put('/:id', requireRole('admin'), c.updateUser);
router.delete('/:id', requireRole('admin'), c.deleteUser);
router.post('/:id/income', c.addUserIncomeFromGross);
router.post('/:id/withdraw', c.addWithdraw);

export default router;
