import type { NextFunction, Request, Response } from "express";

import { logger } from "./logger.js";

export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = performance.now();

  res.on("finish", () => {
    const durationMs = Number((performance.now() - startedAt).toFixed(2));

    logger.info({
      requestId: res.locals.requestId,
      method: req.method,
      endpoint: req.path,
      statusCode: res.statusCode,
      durationMs
    });
  });

  next();
}
