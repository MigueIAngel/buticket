"use client;";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function PurchasedTicket({ eventId }: { eventId: Id<"events"> }) {
  // Fetch user information and router instance
  const { user } = useUser();
  const router = useRouter();
  const queuePosition = useQuery(api.waitingList.getQueuePosition, {
    eventId,
    userId: user?.id ?? "",
  });
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const offerExpireAt = queuePosition?.offerExpiresAt ?? 0;
  const isExpired = offerExpireAt < Date.now();
  return <div>PurchasedTicket</div>;
}

export default PurchasedTicket;
