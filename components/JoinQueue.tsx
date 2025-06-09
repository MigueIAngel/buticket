"use client";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import React from "react";
import { toast } from "sonner";
import Spiner from "./Spiner";
import { WAITING_LIST_STATUS } from "@/convex/constants";
import { Clock, OctagonXIcon } from "lucide-react";

function JoinQueue({
  eventId,
  userId,
}: {
  eventId: Id<"events">;
  userId: string;
}) {
  const joingWaitingList = useMutation(api.events.joinWaitingList);
  const queuePosition = useQuery(api.waitingList.getQueuePosition, {
    eventId,
    userId,
  });
  const userTicket = useQuery(api.tickets.getUserTicket, {
    eventId,
    userId,
  });

  const availability = useQuery(api.events.getEventAvailability, {
    eventId,
  });
  const event = useQuery(api.events.getById, {
    eventId,
  });
  const isEventOwner = event?.userId === userId;
  const handleJoinQueue = async () => {
    try {
      const result = await joingWaitingList({ eventId, userId });
      if (result.success) {
        console.log("Successfully joined the queue");
        toast.success(result.message, {
          duration: 5000,
        });
      }
    } catch (error) {
      if (
        error instanceof ConvexError &&
        error.message.includes("joined the waiting list too many times")
      ) {
        toast.error("Slow down there!.", {
          description: error.data,
          duration: 5000,
        });
      } else {
        console.error("Error joining the queue:", error);
        toast.error("Error joining the queue", {
          description:
            "Something went wrong while trying to join the queue. Please try again later.",
          duration: 5000,
        });
      }
    }
  };
  if (queuePosition === undefined || availability === undefined || !event) {
    return <Spiner />;
  }
  const isPastEvent = event?.eventDate < Date.now();

  return (
    <div>
      {(!queuePosition ||
        queuePosition.status === WAITING_LIST_STATUS.EXPIRED ||
        (queuePosition.status === WAITING_LIST_STATUS.OFERED &&
          queuePosition.offerExpiresAt &&
          queuePosition.offerExpiresAt <= Date.now())) && (
        <>
          {isEventOwner ? (
            <div className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg">
              <OctagonXIcon className="w-5 h-5 " />
              <span>You cannot buy a ticket for your own event</span>
            </div>
          ) : isPastEvent ? (
            <div className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg">
              <Clock className="w-5 h-5 " />
              <span>This event has already passed</span>
            </div>
          ) : availability.purchasedTickets >= availability.totalTickets ? (
            <div className="text-center font-semibold text-red-600">
              Sorry, this event is sold out
            </div>
          ) : (
            <button
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 shadow-md flex items-center justify-center disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer" 
              onClick={handleJoinQueue}
              disabled={isPastEvent || isEventOwner}
            >
              Buy Ticket
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default JoinQueue;
