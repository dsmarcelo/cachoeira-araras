"use client";

import { useEffect, useState } from "react";
import { FaApple, FaGoogle, FaWaze } from "react-icons/fa";
import { Button } from "@/components/ui/button";

const LAT = -15.733303493238164;
const LNG = -49.03570865266417;

/** One deep-link pill button; `children` is the icon plus the app name. */
function MapLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      variant="brand"
      className="h-12 gap-2 rounded-full text-base"
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </Button>
  );
}

/**
 * Deep-links to the three map apps for the same pinned location.
 * Apple Maps only makes sense on iOS, so it's hidden on other platforms.
 */
export function MapAppButtons() {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 w-full max-w-[500px]">
      <MapLink href={`https://www.google.com/maps/dir/?api=1&destination=${LAT},${LNG}`}>
        <FaGoogle />
        Google Maps
      </MapLink>
      {isIOS && (
        <MapLink href={`https://maps.apple.com/?daddr=${LAT},${LNG}`}>
          <FaApple />
          Apple Maps
        </MapLink>
      )}
      <MapLink href={`https://waze.com/ul?ll=${LAT},${LNG}&navigate=yes`}>
        <FaWaze />
        Waze
      </MapLink>
    </div>
  );
}
