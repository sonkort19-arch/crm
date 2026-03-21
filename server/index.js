import 'dotenv/config';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED:', err);
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import './database/db.js';
import usersRouter from './routes/users.js';
import logsRouter from './routes/logs.js';
import authRouter from './routes/auth.js';
import * as userController from './controllers/userController.js';
import { requireAuth } from './auth/authMiddleware.js';
import { requireRole } from './auth/requireRole.js';
import { requestLogger, rejectEmptyJsonBody } from './middleware/http.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const PORT = Number(process.env.PORT) || 3000;

const app = express();

app.set('trust proxy', 1);

app.use(express.json({ limit: '100kb', strict: true }));
app.use(cors({ origin: '*', credentials: true }));

app.get('/', (_req, res) => {
  res.send('API is running');
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(rejectEmptyJsonBody);
app.use(requestLogger);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов, попробуйте позже' },
});

app.use('/api', apiLimiter);

app.use('/api/auth', authRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/logs', requireAuth, logsRouter);
app.post('/api/operations/distribute', requireAuth, requireRole('admin'), userController.distributeIncome);

app.use(express.static(root));

app.get('/index.html', (_req, res) => {
  res.sendFile(path.join(root, 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
