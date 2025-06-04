"use client";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { use, useState } from "react";
import { XCircle } from "lucide-react";
function ReleaseTicket({
  eventId,
  waitingListId,
}: {
  eventId: Id<"events">;
  waitingListId: Id<"waitinglist">;
}) {
  const [isReleasing, setIsReleasing] = useState(false);
  const releaseTicket = useMutation(api.waitingList.releaseTicket);
  const handleRelease = async () => {
    if (!confirm("Are you sure you want to release your ticket?")) return;
    try {
        setIsReleasing(true);
        await releaseTicket({ eventId, waitingListId });
    } catch (error) {
        console.error("Error releasing ticket:", error);
    } finally{
        setIsReleasing(false);
    }
  };
  return <div>ReleaseTicket</div>;
}

export default ReleaseTicket;
