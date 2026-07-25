import type { HealthComponentDto, HealthStatus } from "../../../../packages/contracts/src/index.js";

export function createHealthComponent(
  name: string,
  status: HealthStatus,
  message: string
): HealthComponentDto {
  return {
    name,
    status,
    message,
    checked_at: new Date().toISOString()
  };
}
