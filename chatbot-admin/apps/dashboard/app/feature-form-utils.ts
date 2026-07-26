export const businessWeekdays = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" }
] as const;

export type BusinessScheduleForm = Record<string, { open: string; close: string; closed: boolean }>;
export type CtaLine = { label: string; url: string; kind: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function defaultBusinessSchedule(): BusinessScheduleForm {
  return Object.fromEntries(
    businessWeekdays.map((day) => [
      day.key,
      {
        open: "09:00",
        close: "17:00",
        closed: day.key === "sat" || day.key === "sun"
      }
    ])
  );
}

export function formatBusinessSchedule(value: unknown): BusinessScheduleForm {
  const defaults = defaultBusinessSchedule();
  if (!isRecord(value)) {
    return defaults;
  }

  return Object.fromEntries(
    businessWeekdays.map((day) => {
      const rawEntry = value[day.key];
      const entry: Record<string, unknown> = isRecord(rawEntry) ? rawEntry : {};
      return [
        day.key,
        {
          open: typeof entry.open === "string" ? entry.open : defaults[day.key].open,
          close: typeof entry.close === "string" ? entry.close : defaults[day.key].close,
          closed: Boolean(entry.closed)
        }
      ];
    })
  );
}

export function serializeBusinessSchedule(schedule: BusinessScheduleForm) {
  return Object.fromEntries(
    businessWeekdays.map((day) => {
      const entry = schedule[day.key] ?? defaultBusinessSchedule()[day.key];
      return [
        day.key,
        entry.closed
          ? { closed: true }
          : {
              open: entry.open || "09:00",
              close: entry.close || "17:00"
            }
      ];
    })
  );
}

export function formatStringList(value: unknown, fallback: string[] = []): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join("\n");
  }

  if (isRecord(value) && Array.isArray(value.terms)) {
    return value.terms.map((item) => String(item)).join("\n");
  }

  if (typeof value === "string") {
    return value;
  }

  return fallback.join("\n");
}

export function parseStringList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatCtaLines(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter(isRecord)
    .map((item) => [item.label, item.url, item.kind ?? "custom"].map((part) => String(part ?? "").trim()).join(" | "))
    .join("\n");
}

export function parseCtaLines(raw: string): CtaLine[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "", url = "", kind = "custom"] = line.split("|").map((part) => part.trim());
      return { label, url, kind };
    })
    .filter((item) => item.label || item.url);
}

export function formatKeyValueLines(value: unknown): string {
  if (!isRecord(value)) {
    return "";
  }

  return Object.entries(value)
    .map(([key, val]) => `${key} = ${String(val)}`)
    .join("\n");
}

export function parseKeyValueLines(raw: string): Record<string, string | number> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string | number>>((result, line) => {
      const separatorIndex = line.indexOf("=");
      const key = (separatorIndex >= 0 ? line.slice(0, separatorIndex) : line).trim();
      const rawValue = (separatorIndex >= 0 ? line.slice(separatorIndex + 1) : "1").trim();
      if (!key) {
        return result;
      }
      const numericValue = Number(rawValue);
      result[key] = rawValue !== "" && Number.isFinite(numericValue) ? numericValue : rawValue;
      return result;
    }, {});
}

export function clearFieldError<T extends Record<string, string>>(errors: T, key: string): T {
  if (!errors[key]) {
    return errors;
  }

  const next = { ...errors };
  delete next[key];
  return next;
}
