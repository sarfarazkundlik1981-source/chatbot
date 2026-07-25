export type JsonParseResult<T> =
  | { success: true; value: T }
  | { success: false; error: string };

export function parseJsonInput<T>(raw: string, label: string): JsonParseResult<T> {
  try {
    return { success: true, value: JSON.parse(raw) as T };
  } catch (error) {
    return {
      success: false,
      error: `${label} must be valid JSON.${error instanceof Error && error.message ? ` ${error.message}` : ""}`
    };
  }
}

export function clearFieldError<T extends Record<string, string>>(errors: T, key: string): T {
  if (!errors[key]) {
    return errors;
  }

  const next = { ...errors };
  delete next[key];
  return next;
}
