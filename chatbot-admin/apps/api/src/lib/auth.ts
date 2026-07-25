import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  scope: "dashboard" | "plugin";
  platformRole?: string;
  clientId?: string;
  clientRole?: string;
  domain?: string;
};

export type RefreshTokenPayload = {
  sub: string;
  scope: "dashboard_refresh";
  platformRole?: string;
  clientId?: string;
  clientRole?: string;
  sessionId: string;
};

export function signAccessToken(payload: AccessTokenPayload, expiresIn: string | number = "8h"): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: expiresIn as never });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload, expiresIn: string | number = "30d"): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: expiresIn as never });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as RefreshTokenPayload;
}
