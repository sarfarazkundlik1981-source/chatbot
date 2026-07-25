import { Router } from "express";

import { sendSuccess } from "../lib/api-response.js";
import { createHealthComponent } from "../dto/health.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { getSchedulerHealthSnapshot } from "../domain/jobs.js";

export const healthRouter = Router();

const healthRank = { healthy: 0, warning: 1, critical: 2 } as const;

function summarizeOverallStatus(statuses: Array<keyof typeof healthRank>): keyof typeof healthRank {
  return statuses.reduce((current, next) => (healthRank[next] > healthRank[current] ? next : current), "healthy");
}

healthRouter.get("/", async (_req, res) => {
  let databaseComponent = createHealthComponent("database", "critical", "Database connectivity check failed.");

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseComponent = createHealthComponent("database", "healthy", "Database connectivity check succeeded.");
  } catch {
    databaseComponent = createHealthComponent("database", "critical", "Database connectivity check failed.");
  }

  let openRouterStatus = createHealthComponent("openrouter", "warning", "Provider reachability check failed.");
  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 5000);
    const providerResponse = await fetch(env.OPENROUTER_BASE_URL.replace(/\/v1$/, ""), { signal: abortController.signal });
    clearTimeout(timeout);
    openRouterStatus = createHealthComponent(
      "openrouter",
      providerResponse.ok ? "healthy" : "warning",
      providerResponse.ok ? "Provider is reachable." : `Provider returned ${providerResponse.status}.`
    );
  } catch {
    openRouterStatus = createHealthComponent("openrouter", "warning", "Provider reachability check failed.");
  }

  let licenseStatus = createHealthComponent("license_subsystem", "warning", "License connectivity check skipped.");
  if (databaseComponent.status === "healthy") {
    try {
      const [activeLicenses, blockedLicenses] = await Promise.all([
        prisma.license.count({ where: { status: { in: ["trial", "active"] } } }),
        prisma.license.count({ where: { status: { in: ["expired", "suspended", "cancelled"] } } })
      ]);
      licenseStatus = createHealthComponent(
        "license_subsystem",
        blockedLicenses > 0 ? "warning" : "healthy",
        `${activeLicenses} active/trial licenses, ${blockedLicenses} blocked licenses.`
      );
    } catch {
      licenseStatus = createHealthComponent("license_subsystem", "warning", "License query failed.");
    }
  }

  const resendStatus = env.RESEND_API_KEY
    ? createHealthComponent("resend", "healthy", "Resend API key is configured.")
    : createHealthComponent("resend", "warning", "Resend API key is not configured.");

  const schedulerSnapshot = getSchedulerHealthSnapshot();
  const schedulerJobs = Object.values(schedulerSnapshot.jobs);
  const failedJobs = schedulerJobs.filter((job) => job.status === "failed");
  const idleJobs = schedulerJobs.filter((job) => job.status === "idle");
  const scheduledJobsStatus = createHealthComponent(
    "scheduled_jobs",
    !schedulerSnapshot.bootedAt
      ? "critical"
      : failedJobs.length > 0
        ? "warning"
        : idleJobs.length === schedulerJobs.length
          ? "warning"
          : "healthy",
    !schedulerSnapshot.bootedAt
      ? "Scheduler has not booted."
      : failedJobs.length > 0
        ? `${failedJobs.length} scheduled job(s) failed most recently.`
        : idleJobs.length === schedulerJobs.length
          ? "Scheduler booted but no jobs have completed yet."
          : "Scheduler is running."
  );

  const components = [
    createHealthComponent("backend_api", "healthy", "API is accepting requests."),
    databaseComponent,
    openRouterStatus,
    licenseStatus,
    resendStatus,
    scheduledJobsStatus
  ];

  return sendSuccess(
    res,
    { overall_status: summarizeOverallStatus(components.map((component) => component.status)), components },
    {
      generated_at: new Date().toISOString(),
      scheduler: schedulerSnapshot
    }
  );
});
