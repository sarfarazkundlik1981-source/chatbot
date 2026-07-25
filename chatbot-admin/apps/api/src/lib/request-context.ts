import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header(env.REQUEST_ID_HEADER) ?? randomUUID();
  res.setHeader(env.REQUEST_ID_HEADER, requestId);
  res.locals.requestId = requestId;
  (req as Request & { requestId: string }).requestId = requestId;
  next();
}
