import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";

const ENCRYPTION_ALGO = "aes-256-gcm";
const KEY = createHash("sha256").update(env.ENCRYPTION_KEY).digest();

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function encryptValue(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted.toString("hex")}`;
}

export function decryptValue(value: string): string {
  const [ivHex, tagHex, encryptedHex] = value.split(".");
  const decipher = createDecipheriv(ENCRYPTION_ALGO, KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(password, salt, 310000, 32, "sha256").toString("hex");
  return `${salt}.${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(".");
  const derived = pbkdf2Sync(password, salt, 310000, 32, "sha256").toString("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(derived, "hex"));
}

export function generateOpaqueToken(length = 32): string {
  return randomBytes(length).toString("hex");
}
