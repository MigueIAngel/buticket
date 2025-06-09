import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { DURATION, TICKET_STATUS, WAITING_LIST_STATUS } from "./constants";
import { internal } from "./_generated/api";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("is_cancelled"), undefined))
      .collect();
  },
});

export const getById = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.eventId);
  },
});

export const getEventAvailability = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
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
    const totalReserved = purchasedTickets + activeOffers;
    return {
      ifSouldOut: totalReserved >= event.totalTickets,
      totalTickets: event.totalTickets,
      purchasedTickets,
      activeOffers,
      remainingTickets: Math.max(0, event.totalTickets - totalReserved),
    };
  },
});
export const checkAvailability = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
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
    const availableSpots =
      event.totalTickets - (purchasedTickets + activeOffers);
    return {
      available: availableSpots > 0,
      availableSpots,
      totalTickets: event.totalTickets,
      purchasedTickets,
      activeOffers,
    };
  },
});

export const joinWaitingList = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
  },
  handler: async (ctx, { eventId, userId }) => {
    const existingEntry = await ctx.db
      .query("waitinglist")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", userId).eq("eventId", eventId)
      )
      .filter((q) => q.neq(q.field("status"), WAITING_LIST_STATUS.EXPIRED))
      .first();

    if (existingEntry) throw new Error("Already on the waiting list");
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Event not found");

    // Replicate the checkAvailability logic here since queries can't be called directly from mutations
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
    const availableSpots =
      event.totalTickets - (purchasedTickets + activeOffers);
    const available = availableSpots > 0;
    if (available) {
      const waitingListId = await ctx.db.insert("waitinglist", {
        eventId,
        userId,
        status: WAITING_LIST_STATUS.OFERED,
        offerExpiresAt: Date.now() + DURATION.TICKET_OFFER,
      });

      // Schedule a job to expire the offer
      await ctx.scheduler.runAfter(
        DURATION.TICKET_OFFER,
        internal.waitingList.expireOffer,
        {
          waitingListId,
          eventId,
        }
      );
    } else {
      const waitingListId = await ctx.db.insert("waitinglist", {
        eventId,
        userId,
        status: WAITING_LIST_STATUS.WAITING,
      });
    }
    return {
      success: true,
      status: available
        ? WAITING_LIST_STATUS.OFERED
        : WAITING_LIST_STATUS.WAITING,
      message: available
        ? `Ticket offered. you have ${DURATION.TICKET_OFFER / (60 * 1000)} minutes to purchase it.`
        : "You have been added to the waiting list.",
    };
  },
});
