import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { generateOpaqueToken, hashPassword, hashValue, verifyPassword } from "../lib/crypto.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/auth.js";
import { eventBus } from "../domain/event-bus.js";
import { writeAuditLog } from "../lib/audit.js";
import { newId } from "../lib/ids.js";

const PASSWORD_RESET_HOURS = 2;
const INVITE_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_DAYS = 30;
const PLATFORM_SESSION_CLIENT_NAME = "__platform_internal__";

function buildTokenPayload(input: {
  userId: string;
  platformRole?: string | null;
  clientId?: string | null;
  clientRole?: string | null;
}) {
  return {
    sub: input.userId,
    scope: "dashboard" as const,
    platformRole: input.platformRole ?? undefined,
    clientId: input.clientId ?? undefined,
    clientRole: input.clientRole ?? undefined
  };
}

async function issueDashboardTokens(input: {
  userId: string;
  platformRole?: string | null;
  clientId?: string | null;
  clientRole?: string | null;
}) {
  const sessionId = newId();
  const sessionClientId = input.clientId ?? (await ensurePlatformSessionClientId());
  const accessPayload = buildTokenPayload(input);
  const refreshToken = signRefreshToken({
    ...accessPayload,
    scope: "dashboard_refresh",
    sessionId
  });

  await prisma.sessionToken.create({
    data: {
      id: sessionId,
      clientId: sessionClientId,
      tokenHash: hashValue(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)
    }
  });

  return {
    access_token: signAccessToken(accessPayload),
    refresh_token: refreshToken
  };
}

async function ensurePlatformSessionClientId(): Promise<string> {
  const existing = await prisma.client.findFirst({
    where: { name: PLATFORM_SESSION_CLIENT_NAME },
    select: { id: true }
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.client.create({
    data: {
      id: newId(),
      name: PLATFORM_SESSION_CLIENT_NAME
    },
    select: { id: true }
  });

  return created.id;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: true,
      platformUser: true
    }
  });

  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const clientMembership = user.memberships.find((membership: { deletedAt: Date | null }) => !membership.deletedAt);

  const tokens = await issueDashboardTokens({
    userId: user.id,
    platformRole: user.platformUser?.role,
    clientId: clientMembership?.clientId,
    clientRole: clientMembership?.role
  });

  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      platform_role: user.platformUser?.role ?? null,
      client_role: clientMembership?.role ?? null,
      client_id: clientMembership?.clientId ?? null
    }
  };
}

export async function refreshDashboardSession(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  const session = await prisma.sessionToken.findUnique({
    where: { tokenHash: hashValue(refreshToken) }
  });

  if (!session || session.expiresAt < new Date()) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.");
  }

  await prisma.sessionToken.delete({ where: { id: session.id } });

  return issueDashboardTokens({
    userId: payload.sub,
    platformRole: payload.platformRole,
    clientId: payload.clientId,
    clientRole: payload.clientRole
  });
}

export async function revokeDashboardSession(refreshToken: string) {
  await prisma.sessionToken.deleteMany({
    where: {
      tokenHash: hashValue(refreshToken)
    }
  });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { accepted: true };
  }

  const token = generateOpaqueToken(24);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.create({
      data: {
        id: newId(),
        userId: user.id,
        tokenHash: hashValue(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_HOURS * 60 * 60 * 1000)
      }
    });

    await tx.emailEvent.create({
      data: {
        id: newId(),
        provider: "resend",
        templateKey: "password_reset",
        status: "queued"
      }
    });
  });

  return { accepted: true, reset_token_preview: token };
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashValue(token) }
  });

  if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt < new Date()) {
    throw new AppError(422, "RESET_TOKEN_INVALID", "Reset token is invalid or expired.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash: hashPassword(newPassword) }
    });

    await tx.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() }
    });

    await tx.log.create({
      data: {
        id: newId(),
        type: "SECURITY",
        severity: "info",
        source: "auth.reset_password",
        payload: { user_id: tokenRecord.userId }
      }
    });
  });

  return { reset: true };
}

export async function inviteUser(clientId: string, email: string, role: "owner" | "admin" | "editor" | "viewer" | "support", invitedByUserId?: string) {
  const token = generateOpaqueToken(24);

  await prisma.$transaction(async (tx) => {
    const user =
      (await tx.user.findUnique({ where: { email } })) ??
      (await tx.user.create({
        data: {
          id: newId(),
          email
        }
      }));

    await tx.clientUser.upsert({
      where: {
        clientId_userId: {
          clientId,
          userId: user.id
        }
      },
      update: {
        role,
        deletedAt: null,
        deletedBy: null,
        version: { increment: 1 }
      },
      create: {
        id: newId(),
        clientId,
        userId: user.id,
        role
      }
    });

    await tx.inviteToken.create({
      data: {
        id: newId(),
        clientId,
        email,
        tokenHash: hashValue(token),
        invitedByUserId,
        expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    await tx.emailEvent.create({
      data: {
        id: newId(),
        clientId,
        provider: "resend",
        templateKey: "invite_user",
        status: "queued"
      }
    });
  });

  await eventBus.emit({ type: "user.invited", clientId, userId: invitedByUserId ?? "system" });

  return { invited: true, invite_token_preview: token };
}

export async function acceptInvite(token: string, password: string) {
  const invite = await prisma.inviteToken.findUnique({
    where: { tokenHash: hashValue(token) }
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new AppError(422, "INVITE_INVALID", "Invite token is invalid or expired.");
  }

  const user = await prisma.user.findUnique({ where: { email: invite.email } });
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "Invited user was not found.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(password) }
    });

    await tx.inviteToken.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() }
    });
  });

  await writeAuditLog({
    clientId: invite.clientId,
    actorId: user.id,
    action: "invite.accepted",
    target: invite.id
  });

  return { accepted: true };
}
