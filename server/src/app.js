import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { ApiError, errorHandler, requireAuth } from './http.js';
import authRouter from './routes/auth.js';
import expensesRouter, { incomeRouter } from './routes/expenses.js';
import { categoriesRouter, cyclesRouter } from './routes/cycles.js';
import subscriptionsRouter from './routes/subscriptions.js';
import dashboardRouter from './routes/dashboard.js';
import { friendsRouter, loansRouter } from './routes/friends.js';
import { dataRouter, meRouter } from './routes/data.js';

export function createApp() {
  const app = express();
  const isTest = config.env === 'test';
  app.disable('x-powered-by');
  if (config.env === 'production') app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        if (config.clientOrigins.includes('*') || config.clientOrigins.includes(cleanOrigin)) {
          return cb(null, true);
        }
        try {
          const { hostname } = new URL(cleanOrigin);
          const isAllowed = config.clientOrigins.some((allowed) => {
            if (allowed.startsWith('*.')) {
              const domain = allowed.slice(2);
              return hostname === domain || hostname.endsWith(`.${domain}`);
            }
            return false;
          });
          if (isAllowed) return cb(null, true);
        } catch {
          // invalid URL origin
        }
        cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  if (!isTest) app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

  const json = express.json({ limit: '300kb' });
  app.use((req, res, next) => (req.path === '/api/import' ? next() : json(req, res, next)));

  const limiter = (windowMs, limit) =>
    rateLimit({
      windowMs,
      limit: isTest ? 100_000 : limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, res) =>
        res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } }),
    });

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth', limiter(15 * 60_000, 40), authRouter);
  api.use(limiter(60_000, 300));
  api.use(requireAuth);
  api.use('/me', meRouter);
  api.use('/cycles', cyclesRouter);
  api.use('/categories', categoriesRouter);
  api.use('/expenses', expensesRouter);
  api.use('/income', incomeRouter);
  api.use('/subscriptions', subscriptionsRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/friends', friendsRouter);
  api.use('/loans', loansRouter);
  api.use('/', dataRouter);
  api.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found')));

  app.use('/api', api);
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found')));
  app.use(errorHandler);
  return app;
}
