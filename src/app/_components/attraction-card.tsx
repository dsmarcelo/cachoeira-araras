"use client";

import React, { useEffect, useState } from "react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";

/** How long each background image stays visible before advancing. */
const IMAGE_ROTATION_MS = 3000;

interface AttractionCardProps {
  /** Background images - cycles when length > 1 */
  images: string[];
  /** Short alt text for the image */
  imageAlt: string;
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  className?: string;
  /** Larger type for full-width stacked cards on small screens */
  prominentText?: boolean;
}

/**
 * Card with a full-bleed background image darkened by a bottom-to-top gradient,
 * with title and description text sitting above that gradient.
 *
 * Height is controlled by the parent (e.g. carousel item aspect-ratio box).
 */
export function AttractionCard({
  images,
  imageAlt,
  title,
  description,
  className,
  prominentText = false,
}: AttractionCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    if (!hasMultipleImages) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, IMAGE_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [hasMultipleImages, images.length]);

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col justify-end overflow-hidden rounded-2xl",
        className,
      )}
    >
      {images.map((image, index) => (
        <OptimizedImage
          key={image}
          src={image}
          alt={index === activeIndex ? imageAlt : ""}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={cn(
            "object-cover transition-opacity duration-700 ease-in-out",
            index === activeIndex ? "opacity-100" : "opacity-0",
          )}
          loading="lazy"
        />
      ))}

      {/* Dark gradient overlay - transparent at top, opaque at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Text content - prominentText bumps sizes for portrait stacked cards */}
      <div
        className={cn(
          "relative z-10 flex flex-col",
          prominentText ? "gap-2 p-5" : "gap-1.5 p-4 sm:gap-2 sm:p-6",
        )}
      >
        <h3
          className={cn(
            "font-bold leading-snug text-white",
            prominentText ? "text-2xl" : "text-xl sm:text-2xl",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "leading-relaxed text-white/80",
            prominentText ? "text-base" : "text-xs sm:text-sm",
          )}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
