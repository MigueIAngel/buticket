import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { WAITING_LIST_STATUS } from "./constants";

export const getQueuePosition = query({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
  },
  handler: async (ctx, { eventId, userId }) => {
    const entry = await ctx.db
      .query("waitinglist")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", userId).eq("eventId", eventId)
      )
      .filter((q) => q.neq(q.field("status"), WAITING_LIST_STATUS.EXPIRED))
      .first();
    if (!entry) {
      return undefined; // User not in the waiting list
    }
    const peopleAhead = await ctx.db
      .query("waitinglist")
      .withIndex("by_event_status", (q) => q.eq("eventId", eventId))
      .filter((q) =>
        q.and(
          q.lt(q.field("_creationTime"), entry._creationTime),
          q.or(
            q.eq(q.field("status"), WAITING_LIST_STATUS.WAITING),
            q.eq(q.field("status"), WAITING_LIST_STATUS.OFERED)
          )
        )
      )
      .collect()
      .then((entries) => entries.length);
    return {
      ...entry,
      position: peopleAhead + 1, // +1 for the current user
    };
  },
});
export const releaseTicket = mutation({
  args: {
    eventId: v.id("events"),
    waitingListId: v.id("waitinglist"),
  },
  handler: async (ctx, { eventId, waitingListId }) => {
    const entry = await ctx.db.get(waitingListId);
    if (!entry || entry.status !== WAITING_LIST_STATUS.OFERED) {
      throw new Error("No valid ticket offer found");
    }
    await ctx.db.patch(waitingListId, {
      status: WAITING_LIST_STATUS.EXPIRED,
    });
  },
});
