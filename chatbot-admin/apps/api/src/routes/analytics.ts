import { Router } from "express";

import { sendError, sendSuccess } from "../lib/api-response.js";
import { requireAuth, requireClientAccess } from "../middleware/auth.js";
import { exportRowsAsCsv, getAnalyticsOverview, listAuditLogs, listLeads, listUnansweredQuestions, resolveUnansweredQuestion, restoreLead } from "../services/analytics-service.js";
import { exportConversationTranscript, getConversation, listConversations } from "../services/conversation-service.js";
import { runPlaygroundMessage } from "../services/chat-service.js";
import { z } from "zod";
import { requireClientRole } from "../middleware/auth.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth("dashboard"));
analyticsRouter.use("/clients/:clientId", requireClientAccess());

analyticsRouter.get("/clients/:clientId/analytics", async (req, res) => {
  return sendSuccess(res, await getAnalyticsOverview(String(req.params.clientId)));
});

analyticsRouter.get("/clients/:clientId/conversations", async (req, res) => {
  return sendSuccess(
    res,
    await listConversations(String(req.params.clientId), {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      domain: typeof req.query.domain === "string" ? req.query.domain : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      conversationId: typeof req.query.conversation_id === "string" ? req.query.conversation_id : undefined
    })
  );
});

analyticsRouter.get("/clients/:clientId/conversations/:conversationId", async (req, res) => {
  try {
    return sendSuccess(res, await getConversation(String(req.params.clientId), String(req.params.conversationId)));
  } catch (error) {
    return sendError(res, 404, "CONVERSATION_NOT_FOUND", error instanceof Error ? error.message : "Conversation not found.");
  }
});

analyticsRouter.get("/clients/:clientId/audit-logs", async (req, res) => {
  return sendSuccess(res, await listAuditLogs(String(req.params.clientId)));
});

analyticsRouter.get("/clients/:clientId/leads", async (req, res) => {
  return sendSuccess(
    res,
    await listLeads(String(req.params.clientId), {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined
    })
  );
});

analyticsRouter.get("/clients/:clientId/unanswered-questions", async (req, res) => {
  return sendSuccess(res, await listUnansweredQuestions(String(req.params.clientId)));
});

analyticsRouter.get("/clients/:clientId/exports/leads.csv", async (req, res) => {
  const rows = await listLeads(String(req.params.clientId), {});
  const csv = await exportRowsAsCsv(
    rows.map((lead) => ({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      created_at: lead.createdAt.toISOString()
    }))
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
  res.status(200).send(csv);
});

analyticsRouter.get("/clients/:clientId/conversations/:conversationId/export.txt", async (req, res) => {
  try {
    const transcript = await exportConversationTranscript(String(req.params.clientId), String(req.params.conversationId));
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=conversation-${req.params.conversationId}.txt`);
    res.status(200).send(transcript);
  } catch (error) {
    return sendError(res, 404, "CONVERSATION_NOT_FOUND", error instanceof Error ? error.message : "Conversation export failed.");
  }
});

analyticsRouter.get("/clients/:clientId/exports/unanswered.csv", async (req, res) => {
  const rows = await listUnansweredQuestions(String(req.params.clientId));
  const csv = await exportRowsAsCsv(
    rows.map((row) => ({
      question: row.normalizedQuestion,
      frequency: row.frequency,
      status: row.status,
      last_asked_at: row.lastAskedAt.toISOString()
    }))
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=unanswered.csv");
  res.status(200).send(csv);
});

analyticsRouter.post("/clients/:clientId/playground", async (req, res) => {
  const parsed = z.object({ message: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Playground payload is invalid.", { issues: parsed.error.flatten() });
  }

  const reply = await runPlaygroundMessage(String(req.params.clientId), parsed.data.message);
  return sendSuccess(res, {
    message: reply.content,
    token_usage: reply.tokens,
    estimated_cost: Number((reply.tokens * 0.000002).toFixed(6))
  });
});

analyticsRouter.post("/clients/:clientId/leads/:leadId/restore", requireClientRole(["owner", "admin", "support"]), async (req, res) => {
  try {
    await restoreLead(
      String(req.params.clientId),
      String(req.params.leadId),
      (res.locals.auth as { sub?: string } | undefined)?.sub ?? "unknown",
      res.locals.requestId as string
    );
    return sendSuccess(res, { restored: true });
  } catch (error) {
    return sendError(res, 404, "LEAD_NOT_FOUND", error instanceof Error ? error.message : "Lead restore failed.");
  }
});

analyticsRouter.post("/clients/:clientId/unanswered-questions/:questionId/resolve", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = z
    .object({
      title: z.string().optional(),
      answer: z.string().min(1),
      mark_ignored: z.boolean().optional()
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Resolve unanswered payload is invalid.", { issues: parsed.error.flatten() });
  }

  try {
    return sendSuccess(
      res,
      await resolveUnansweredQuestion({
        clientId: String(req.params.clientId),
        questionId: String(req.params.questionId),
        actorId: (res.locals.auth as { sub?: string } | undefined)?.sub,
        requestId: res.locals.requestId as string,
        title: parsed.data.title,
        answer: parsed.data.answer,
        markIgnored: parsed.data.mark_ignored
      })
    );
  } catch (error) {
    return sendError(res, 404, "UNANSWERED_QUESTION_NOT_FOUND", error instanceof Error ? error.message : "Resolve unanswered failed.");
  }
});
