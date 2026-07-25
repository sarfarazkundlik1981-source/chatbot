export type DomainEvent =
  | { type: "lead.created"; clientId: string; leadId: string }
  | { type: "lead.updated"; clientId: string; leadId: string }
  | { type: "conversation.started"; clientId: string; conversationId: string }
  | { type: "message.created"; clientId: string; messageId: string }
  | { type: "unanswered_question.detected"; clientId: string; conversationId: string }
  | { type: "config.updated"; clientId: string; configVersion: number }
  | { type: "license.status_changed"; clientId: string; status: string }
  | { type: "user.invited"; clientId: string; userId: string };

export type InfrastructureEvent =
  | { type: "plugin.verified"; clientId: string; domain: string }
  | { type: "plugin.heartbeat_received"; clientId: string; domain: string }
  | { type: "email.dispatched"; provider: string; eventId: string }
  | { type: "email.failed"; provider: string; eventId: string }
  | { type: "audit.created"; action: string; actorId?: string }
  | { type: "request.logged"; requestId: string; endpoint: string }
  | { type: "encryption.rekey_requested"; keyId: string }
  | { type: "scheduled_job.completed"; jobName: string }
  | { type: "scheduled_job.failed"; jobName: string; reason: string };
