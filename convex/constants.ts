import { Doc } from "./_generated/dataModel";
//time constants in milliseconds
export const DURATION = {
  TICKET_OFFER: 30 * 60 * 1000, // 30 minutes
} as const;

export const WAITING_LIST_STATUS: Record<string, Doc<"waitinglist">["status"]> =
  {
    WAITING: "waiting",
    OFERED: "offered",
    PURCHASED: "purchased",
    EXPIRED: "expired",
  } as const;
export const TICKET_STATUS: Record<string, Doc<"tickets">["status"]> = {
  VALID: "valid",
  USED: "used",
  REFUNDED: "refunded",
  CANCELLED: "cancelled",
} as const;
