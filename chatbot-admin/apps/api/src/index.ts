import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startScheduler } from "./domain/jobs.js";
import { logger } from "./lib/logger.js";
import { bootstrapPlatformOwner } from "./services/bootstrap-service.js";
import { startKnowledgeProcessingWorker } from "./services/knowledge-service.js";

const app = createApp();
startScheduler();
startKnowledgeProcessingWorker();

await bootstrapPlatformOwner().catch((error) => {
  logger.warn({ error }, "Platform owner bootstrap skipped");
});

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API server listening");
});
