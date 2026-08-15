"use client";

import { useEffect, useState } from "react";
import { FaApple, FaGoogle, FaWaze } from "react-icons/fa";

const LAT = -15.733303493238164;
const LNG = -49.03570865266417;

const buttonClass =
  "h-12 flex justify-center items-center gap-2 rounded-full font-medium bg-primary-500 text-bg-blue hover:bg-primary-600";

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
      <a
        className={buttonClass}
        href={`https://www.google.com/maps/dir/?api=1&destination=${LAT},${LNG}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaGoogle />
        Google Maps
      </a>
      {isIOS && (
        <a
          className={buttonClass}
          href={`https://maps.apple.com/?daddr=${LAT},${LNG}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaApple />
          Apple Maps
        </a>
      )}
      <a
        className={buttonClass}
        href={`https://waze.com/ul?ll=${LAT},${LNG}&navigate=yes`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaWaze />
        Waze
      </a>
    </div>
  );
}
