function normalize(version: string): number[] {
  return version
    .replace(/^[^\d]*/, "")
    .split(".")
    .map((part) => Number.parseInt(part.replace(/[^\d].*$/, ""), 10))
    .filter((value) => Number.isFinite(value));
}

export function compareVersions(left: string | null | undefined, right: string | null | undefined): number {
  const a = normalize(left ?? "0.0.0");
  const b = normalize(right ?? "0.0.0");
  const max = Math.max(a.length, b.length, 3);

  for (let index = 0; index < max; index += 1) {
    const leftPart = a[index] ?? 0;
    const rightPart = b[index] ?? 0;
    if (leftPart > rightPart) {
      return 1;
    }
    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}
