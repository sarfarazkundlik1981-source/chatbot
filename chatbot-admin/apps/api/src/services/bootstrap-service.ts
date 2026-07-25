import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { hashPassword } from "../lib/crypto.js";
import { newId } from "../lib/ids.js";

const PLATFORM_SESSION_CLIENT_NAME = "__platform_internal__";

export async function bootstrapPlatformOwner(): Promise<void> {
  const platformClient = await prisma.client.findFirst({
    where: { name: PLATFORM_SESSION_CLIENT_NAME },
    select: { id: true }
  });

  if (!platformClient) {
    await prisma.client.create({
      data: {
        id: newId(),
        name: PLATFORM_SESSION_CLIENT_NAME
      }
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: env.PLATFORM_OWNER_EMAIL }
  });

  if (existingUser) {
    return;
  }

  const user = await prisma.user.create({
    data: {
      id: newId(),
      email: env.PLATFORM_OWNER_EMAIL,
      passwordHash: hashPassword(env.PLATFORM_OWNER_PASSWORD)
    }
  });

  await prisma.platformUser.create({
    data: {
      id: newId(),
      userId: user.id,
      role: "platform_owner"
    }
  });
}
