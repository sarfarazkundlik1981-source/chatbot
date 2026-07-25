import type { ApiError, ApiSuccess } from "../../../../packages/contracts/src/index.js";
import type { Response } from "express";

function getRequestId(res: Response): string {
  const headerValue = res.getHeader("x-request-id");
  return typeof headerValue === "string" ? headerValue : "unknown";
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  meta: Record<string, unknown> = {},
  statusCode = 200
): Response<ApiSuccess<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
    meta,
    request_id: getRequestId(res)
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): Response<ApiError> {
  return res.status(statusCode).json({
    success: false,
    error: { code, message, details },
    request_id: getRequestId(res)
  });
}
