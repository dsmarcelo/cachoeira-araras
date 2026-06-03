import React from "react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";

interface AttractionCardProps {
  /** Image src — accepts any path accepted by OptimizedImage */
  image: string;
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
  image,
  imageAlt,
  title,
  description,
  className,
  prominentText = false,
}: AttractionCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col justify-end overflow-hidden rounded-2xl",
        className,
      )}
    >
      {/* Background image */}
      <OptimizedImage
        src={image}
        alt={imageAlt}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover"
        loading="lazy"
      />

      {/* Dark gradient overlay — transparent at top, opaque at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Text content — prominentText bumps sizes for portrait stacked cards */}
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
