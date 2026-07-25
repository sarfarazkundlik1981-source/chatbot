import { Router } from "express";

import { adminRouter } from "./admin.js";
import { analyticsRouter } from "./analytics.js";
import { authRouter } from "./auth.js";
import { clientRouter } from "./clients.js";
import { dashboardRouter } from "./dashboard.js";
import { featuresRouter } from "./features.js";
import { healthRouter } from "./health.js";
import { opsRouter } from "./ops.js";
import { pluginRouter } from "./plugin.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/plugin", pluginRouter);
apiRouter.use("/", adminRouter);
apiRouter.use("/", authRouter);
apiRouter.use("/", clientRouter);
apiRouter.use("/", featuresRouter);
apiRouter.use("/", opsRouter);
apiRouter.use("/", analyticsRouter);
apiRouter.use("/", dashboardRouter);
