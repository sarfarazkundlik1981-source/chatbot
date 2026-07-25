import cors from "cors";
import express from "express";
import helmet from "helmet";

import { apiRouter } from "./routes/index.js";
import { httpLogger } from "./lib/observability.js";
import { requestContext } from "./lib/request-context.js";
import { sendError } from "./lib/api-response.js";
import { env } from "./config/env.js";
import { rateLimit } from "./middleware/rate-limit.js";

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: [env.DASHBOARD_URL] }));
  app.use(express.json({ limit: env.PUBLIC_JSON_BODY_LIMIT }));
  app.use(requestContext);
  app.use(httpLogger);
  app.use("/api/v1/auth/login", rateLimit(20, 60 * 60 * 1000));
  app.use("/api/v1/plugin/verify", rateLimit(30, 60 * 60 * 1000));
  app.use("/api/v1/plugin/heartbeat", rateLimit(10, 24 * 60 * 60 * 1000));

  app.use("/api/v1", apiRouter);

  app.use((_req, res) => sendError(res, 404, "NOT_FOUND", "Route not found."));
  app.use((error: Error & { type?: string; status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error.type === "entity.too.large" || error.status === 413) {
      return sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request payload is too large.");
    }

    return sendError(res, 500, "INTERNAL_SERVER_ERROR", "Unexpected server error.");
  });

  return app;
}
