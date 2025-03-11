import { useState, useEffect } from "react";

// useIsMobile hook returns true if the screen width is 768px or less (mobile device)
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // Check if window is defined (to support SSR)
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(max-width: 768px)");
      // Set initial value
      setIsMobile(mediaQuery.matches);

      // Define event handler for changes
      const handleChange = (event: MediaQueryListEvent) => {
        setIsMobile(event.matches);
      };

      // Modern browsers use addEventListener on mediaQueryList
      mediaQuery.addEventListener("change", handleChange);

      // Cleanup event listener on unmount
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }
  }, []);

  return isMobile;
}
