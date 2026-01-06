"use client";

import { useEffect, useState, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";

/**
 * Custom hook to detect network connectivity status
 * Shows toast notifications when connection is lost or restored
 *
 * @returns {Object} Network status information
 * @returns {boolean} isOnline - Current online status
 * @returns {boolean} wasOffline - Whether the connection was previously offline
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const { toast } = useToast();
  const previousStatusRef = useRef<boolean>(isOnline);
  const hasShownOfflineToastRef = useRef<boolean>(false);
  const hasShownOnlineToastRef = useRef<boolean>(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(false);

      // Show toast only when connection is restored (was previously offline)
      if (previousStatusRef.current === false && !hasShownOnlineToastRef.current) {
        toast({
          title: "Conexão restaurada",
          description: "Sua conexão com a internet foi restaurada. Continuando...",
          variant: "default",
        });
        hasShownOnlineToastRef.current = true;
        hasShownOfflineToastRef.current = false;
      }
      previousStatusRef.current = true;
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);

      // Show toast only once when connection is lost
      if (previousStatusRef.current === true && !hasShownOfflineToastRef.current) {
        toast({
          title: "Conexão perdida",
          description: "Verifique sua conexão com a internet.",
          variant: "destructive",
        });
        hasShownOfflineToastRef.current = true;
        hasShownOnlineToastRef.current = false;
      }
      previousStatusRef.current = false;
    };

    // Add event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);
    previousStatusRef.current = navigator.onLine;

    // Cleanup
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  return { isOnline, wasOffline };
}


