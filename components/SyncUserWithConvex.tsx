'use client';

import { api } from "@/convex/_generated/api";
import { useClerk } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useEffect } from "react";

function SyncUserWithConvex() {
    const { user } = useClerk();
    const updateUser = useMutation(api.users.updateUser);
    useEffect(()=>{
      if (!user) return;
      const syncUser = async () => {
        try {
         await updateUser({
            userId: user.id,
            name: user.fullName || user.firstName || "Unknown",
            email: user.emailAddresses[0]?.emailAddress ?? ""
         })
        } catch (error) {
           console.log("Error syncing user with Convex:", error);
        }
      }
      syncUser();
    },[user, updateUser]);
  return (
    <div>SyncUserWithConvex</div>
  )
}

export default SyncUserWithConvex