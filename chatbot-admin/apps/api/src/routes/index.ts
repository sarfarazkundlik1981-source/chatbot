import { Router } from "express";

import { adminRouter } from "./admin.js";
import { analyticsRouter } from "./analytics.js";
import { authRouter } from "./auth.js";
import { clientRouter } from "./clients.js";
import { dashboardRouter } from "./dashboard.js";
import { featuresRouter } from "./features.js";
import { healthRouter } from "./health.js";
import { opsRouter } from "./ops.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/", authRouter);
apiRouter.use("/", adminRouter);
apiRouter.use("/", clientRouter);
apiRouter.use("/", featuresRouter);
apiRouter.use("/", opsRouter);
apiRouter.use("/", analyticsRouter);
apiRouter.use("/", dashboardRouter);
