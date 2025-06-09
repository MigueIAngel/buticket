import {
  internalMutation,
  mutation,
  MutationCtx,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { DURATION, TICKET_STATUS, WAITING_LIST_STATUS } from "./constants";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

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

export const expireOffer = internalMutation({
  args: {
    waitingListId: v.id("waitinglist"),
    eventId: v.id("events"),
  },
  handler: async (ctx, { waitingListId, eventId }) => {
    const offer = await ctx.db.get(waitingListId);
    if (!offer || offer.status !== WAITING_LIST_STATUS.OFERED) return;
    await ctx.db.patch(waitingListId, {
      status: WAITING_LIST_STATUS.EXPIRED,
    });
    await processQueueLogic(ctx, eventId);
  },
});

const processQueueLogic = async (ctx: MutationCtx, eventId: Id<"events">) => {
  const event = await ctx.db.get(eventId);
  if (!event) {
    throw new Error("Event not found");
  }
  const { availableSpots } = await ctx.db
    .query("events")
    .filter((q) => q.eq(q.field("_id"), eventId))
    .first()
    .then(async (event) => {
      if (!event) {
        throw new Error("Event not found");
      }
      const purchasedTickets = await ctx.db
        .query("tickets")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect()
        .then(
          (tickets) =>
            tickets.filter(
              (t) =>
                t.status === TICKET_STATUS.VALID ||
                t.status === TICKET_STATUS.USED
            ).length
        );
      const now = Date.now();
      const activeOffers = await ctx.db
        .query("waitinglist")
        .withIndex("by_event_status", (q) =>
          q.eq("eventId", eventId).eq("status", WAITING_LIST_STATUS.OFERED)
        )
        .collect()
        .then(
          (offers) =>
            offers.filter((offer) => (offer.offerExpiresAt ?? 0) > now).length
        );
      return {
        availableSpots: event.totalTickets - (purchasedTickets + activeOffers),
      };
    });
  if (availableSpots <= 0) return; // No available spots to process
  const waitingUsers = await ctx.db
    .query("waitinglist")
    .withIndex("by_event_status", (q) =>
      q.eq("eventId", eventId).eq("status", WAITING_LIST_STATUS.WAITING)
    )
    .order("asc")
    .take(availableSpots);

  const now = Date.now();
  for (const user of waitingUsers) {
    await ctx.db.patch(user._id, {
      status: WAITING_LIST_STATUS.OFERED,
      offerExpiresAt: now + DURATION.TICKET_OFFER, // Offer expires in 24 hours
    });
    await ctx.scheduler.runAfter(
      DURATION.TICKET_OFFER,
      internal.waitingList.expireOffer,
      { waitingListId: user._id, eventId }
    );
  }
};

export const processQueue = internalMutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, { eventId }) => {
    await processQueueLogic(ctx, eventId);
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
    await processQueueLogic(ctx, eventId);
  },
});
