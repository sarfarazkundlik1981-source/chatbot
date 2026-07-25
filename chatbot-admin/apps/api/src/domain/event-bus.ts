import { logger } from "../lib/logger.js";
import type { DomainEvent, InfrastructureEvent } from "./events.js";

type AnyEvent = DomainEvent | InfrastructureEvent;
type EventHandler<T extends AnyEvent> = (event: T) => Promise<void> | void;

export class InProcessEventBus {
  private handlers = new Map<string, Array<EventHandler<AnyEvent>>>();

  on<T extends AnyEvent>(eventType: T["type"], handler: EventHandler<T>): void {
    const currentHandlers = this.handlers.get(eventType) ?? [];
    currentHandlers.push(handler as EventHandler<AnyEvent>);
    this.handlers.set(eventType, currentHandlers);
  }

  async emit<T extends AnyEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          logger.error({ error, eventType: event.type }, "Event handler failed");
        }
      })
    );
  }
}

export const eventBus = new InProcessEventBus();
