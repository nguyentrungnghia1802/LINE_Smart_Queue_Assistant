import { Router } from 'express';

export const router = Router();

// ── Root ping ─────────────────────────────────────────────────────────────────
router.get('/', (_req, res) => {
  res.json({ message: 'LINE Smart Queue Assistant API', version: '1.0.0' });
});

// ── Domain route modules (register here as they are implemented) ──────────────
// import { queueRouter }  from './queues';
// import { ticketRouter } from './tickets';
// import { userRouter }   from './users';
// import { authRouter }   from './auth';
//
// router.use('/queues',  queueRouter);
// router.use('/tickets', ticketRouter);
// router.use('/users',   userRouter);
// router.use('/auth',    authRouter);
