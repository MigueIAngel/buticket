import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getUserStripeConnectId = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .filter((q) => q.neq(q.field("stripeConnectId"), undefined))
      .first();
    return user?.stripeConnectId;
  },
});

export const updateOrCreateUserStripeConnectId = mutation({
  args: {
    userId: v.string(),
    stripeConnectId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }
    await ctx.db.patch(user._id, {
      stripeConnectId: args.stripeConnectId,
    });
  },
});

export const updateUser = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    /* If user exists */
    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        email: args.email,
      });
      return existingUser;
    }
    /* Create new user if does not exists */
    const newUser = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      userId: args.userId,
      stripeConnectId: undefined, // Assuming you want to set this to null initially
    });
    return newUser;
  },
});
