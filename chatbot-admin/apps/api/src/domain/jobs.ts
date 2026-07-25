import { eventBus } from "./event-bus.js";
import { prisma } from "../lib/prisma.js";
import { decryptValue, encryptValue } from "../lib/crypto.js";
import { evaluateCompatibility } from "../lib/compatibility.js";

export type ScheduledJob = {
  name:
    | "retention_cleanup"
    | "daily_analytics_aggregation"
    | "encryption_rekey_migration"
    | "expired_session_cleanup"
    | "license_expiry_checks"
    | "plugin_compatibility_refresh"
    | "unanswered_question_aggregation"
    | "stale_plugin_installation_refresh"
    | "missed_customer_alert_scan";
  run: () => Promise<void>;
  intervalMs: number;
};

type ScheduledJobState = {
  status: "idle" | "running" | "completed" | "failed";
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
};

const schedulerState = {
  bootedAt: null as string | null,
  jobs: {} as Record<ScheduledJob["name"], ScheduledJobState>
};

function ensureJobState(name: ScheduledJob["name"]): ScheduledJobState {
  if (!schedulerState.jobs[name]) {
    schedulerState.jobs[name] = {
      status: "idle",
      lastStartedAt: null,
      lastCompletedAt: null,
      lastDurationMs: null,
      lastError: null
    };
  }

  return schedulerState.jobs[name];
}

async function emitScheduledJob(name: ScheduledJob["name"], run: () => Promise<void>): Promise<void> {
  const state = ensureJobState(name);
  const startedAt = Date.now();
  state.status = "running";
  state.lastStartedAt = new Date(startedAt).toISOString();
  state.lastError = null;

  try {
    await run();
    state.status = "completed";
    state.lastCompletedAt = new Date().toISOString();
    state.lastDurationMs = Date.now() - startedAt;
    await eventBus.emit({ type: "scheduled_job.completed", jobName: name });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown scheduler error";
    state.status = "failed";
    state.lastCompletedAt = new Date().toISOString();
    state.lastDurationMs = Date.now() - startedAt;
    state.lastError = reason;
    await eventBus.emit({ type: "scheduled_job.failed", jobName: name, reason });
  }
}

export const scheduledJobs: ScheduledJob[] = [
  {
    name: "retention_cleanup",
    intervalMs: 24 * 60 * 60 * 1000,
    run: async () => {
      const now = Date.now();
      await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: new Date(now - 30 * 24 * 60 * 60 * 1000) } } });
      await prisma.log.deleteMany({ where: { createdAt: { lt: new Date(now - 365 * 24 * 60 * 60 * 1000) }, type: { not: "AUDIT" } } });
      await prisma.emailEvent.deleteMany({ where: { createdAt: { lt: new Date(now - 90 * 24 * 60 * 60 * 1000) } } });
    }
  },
  {
    name: "daily_analytics_aggregation",
    intervalMs: 24 * 60 * 60 * 1000,
    run: async () => {
      const clients = await prisma.client.findMany({ select: { id: true } });
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      yesterday.setUTCHours(0, 0, 0, 0);
      const end = new Date(yesterday);
      end.setUTCDate(end.getUTCDate() + 1);

      for (const client of clients) {
        const [messages, leads] = await Promise.all([
          prisma.message.count({ where: { conversation: { clientId: client.id }, createdAt: { gte: yesterday, lt: end } } }),
          prisma.lead.count({ where: { clientId: client.id, createdAt: { gte: yesterday, lt: end } } })
        ]);

        await prisma.dailyAnalytics.upsert({
          where: { clientId_day: { clientId: client.id, day: yesterday } },
          update: { metrics: { messages, leads } },
          create: { clientId: client.id, day: yesterday, metrics: { messages, leads } }
        });
      }
    }
  },
  {
    name: "encryption_rekey_migration",
    intervalMs: 6 * 60 * 60 * 1000,
    run: async () => {
      const activeKey = await prisma.encryptionKey.findFirst({
        where: { status: "active" },
        orderBy: { createdAt: "desc" }
      });

      if (!activeKey) {
        return;
      }

      const credentials = await prisma.apiCredential.findMany({
        where: { keyVersion: { not: activeKey.keyId } }
      });

      for (const credential of credentials) {
        const plaintext = decryptValue(credential.encryptedValue);
        await prisma.apiCredential.update({
          where: { id: credential.id },
          data: {
            encryptedValue: encryptValue(plaintext),
            keyVersion: activeKey.keyId
          }
        });
      }
    }
  },
  {
    name: "expired_session_cleanup",
    intervalMs: 60 * 60 * 1000,
    run: async () => {
      await prisma.sessionToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await prisma.inviteToken.deleteMany({ where: { expiresAt: { lt: new Date() }, acceptedAt: null } });
    }
  },
  {
    name: "license_expiry_checks",
    intervalMs: 6 * 60 * 60 * 1000,
    run: async () => {
      await prisma.license.updateMany({
        where: {
          status: { in: ["trial", "active"] },
          expiresAt: { lt: new Date() }
        },
        data: { status: "expired" }
      });
    }
  },
  {
    name: "plugin_compatibility_refresh",
    intervalMs: 12 * 60 * 60 * 1000,
    run: async () => {
      const installations = await prisma.pluginInstallation.findMany({
        where: { deletedAt: null }
      });

      for (const installation of installations) {
        const compatibility = evaluateCompatibility({
          pluginVersion: installation.pluginVersion,
          wordpressVersion: installation.wordpressVersion ?? undefined,
          phpVersion: installation.phpVersion ?? undefined
        });

        await prisma.log.create({
          data: {
            clientId: installation.clientId,
            type: "API",
            severity: compatibility.status === "compatible" ? "info" : "warning",
            source: "scheduler.plugin_compatibility_refresh",
            payload: {
              installation_id: installation.id,
              compatibility_status: compatibility.status,
              details: compatibility.details
            }
          }
        });
      }
    }
  },
  {
    name: "unanswered_question_aggregation",
    intervalMs: 60 * 60 * 1000,
    run: async () => {
      const rows = await prisma.unansweredQuestion.findMany();
      const seen = new Map<string, typeof rows[number]>();
      for (const row of rows) {
        const key = `${row.clientId}:${row.normalizedQuestion}`;
        const existing = seen.get(key);
        if (!existing) {
          seen.set(key, row);
          continue;
        }
        await prisma.unansweredQuestion.update({
          where: { id: existing.id },
          data: {
            frequency: existing.frequency + row.frequency,
            lastAskedAt: row.lastAskedAt > existing.lastAskedAt ? row.lastAskedAt : existing.lastAskedAt
          }
        });
        await prisma.unansweredQuestion.delete({ where: { id: row.id } });
      }
    }
  },
  {
    name: "stale_plugin_installation_refresh",
    intervalMs: 12 * 60 * 60 * 1000,
    run: async () => {
      await prisma.pluginInstallation.updateMany({
        where: {
          lastSeen: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
          deletedAt: null
        },
        data: {
          deletedAt: new Date(),
          deletedBy: "scheduler"
        }
      });
    }
  },
  {
    name: "missed_customer_alert_scan",
    intervalMs: 60 * 60 * 1000,
    run: async () => {
      const configs = await prisma.missedCustomerAlertConfig.findMany({
        where: { enabled: true }
      });

      for (const config of configs) {
        const staleConversationCutoff = new Date(Date.now() - config.conversationDelayMins * 60 * 1000);
        const staleLeadCutoff = new Date(Date.now() - config.leadDelayMins * 60 * 1000);

        const [staleConversations, staleLeads] = await Promise.all([
          prisma.conversation.findMany({
            where: {
              clientId: config.clientId,
              lastSeenAt: { lt: staleConversationCutoff },
              messages: { some: { role: "user" } }
            },
            take: 25
          }),
          prisma.lead.findMany({
            where: {
              clientId: config.clientId,
              updatedAt: { lt: staleLeadCutoff },
              deletedAt: null,
              status: { in: ["new", "open"] }
            },
            take: 25
          })
        ]);

        for (const conversation of staleConversations) {
          await prisma.missedCustomerAlert.upsert({
            where: { id: `conv-${conversation.id}` },
            update: {
              status: "open",
              payload: { conversation_last_seen_at: conversation.lastSeenAt.toISOString() }
            },
            create: {
              id: `conv-${conversation.id}`,
              clientId: config.clientId,
              conversationId: conversation.id,
              reason: "stale_conversation",
              status: "open",
              payload: { conversation_last_seen_at: conversation.lastSeenAt.toISOString() }
            }
          });
        }

        for (const lead of staleLeads) {
          await prisma.missedCustomerAlert.upsert({
            where: { id: `lead-${lead.id}` },
            update: {
              status: "open",
              payload: { lead_status: lead.status, lead_updated_at: lead.updatedAt.toISOString() }
            },
            create: {
              id: `lead-${lead.id}`,
              clientId: config.clientId,
              leadId: lead.id,
              reason: "stale_lead",
              status: "open",
              payload: { lead_status: lead.status, lead_updated_at: lead.updatedAt.toISOString() }
            }
          });
        }
      }
    }
  }
];

export function startScheduler(): void {
  schedulerState.bootedAt = new Date().toISOString();

  for (const job of scheduledJobs) {
    ensureJobState(job.name);
    setInterval(() => {
      void emitScheduledJob(job.name, job.run);
    }, job.intervalMs).unref();
  }
}

export function getSchedulerHealthSnapshot(): {
  bootedAt: string | null;
  jobs: Record<ScheduledJob["name"], ScheduledJobState>;
} {
  return {
    bootedAt: schedulerState.bootedAt,
    jobs: { ...schedulerState.jobs }
  };
}
