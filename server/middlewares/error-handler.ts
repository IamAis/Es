import { Request, Response, NextFunction } from 'express';

/**
 * Error handler middleware — restituisce sempre JSON.
 * Registrare nell'app principale dopo tutte le route:
 *   import errorHandler from './middlewares/error-handler';
 *   app.use(errorHandler);
 */
export default function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  const status = err?.status || 500;
  const payload: any = {
    error: err?.message || 'Internal Server Error',
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.details = err?.details ?? err?.stack ?? null;
  }

  res.status(status).json(payload);
}
