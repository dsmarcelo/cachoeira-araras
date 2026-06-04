"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { motion } from "framer-motion";
import { infoTopics } from "@/lib/info-topics";
import { AttractionCard } from "./attraction-card";

// Center-focus layout tuning. The active card keeps a 4:3 ratio capped at this
// width; neighbors fill the leftover horizontal space on each side. When that
// leftover (per side) drops below MIN_SIDE_PEEK, we collapse to a single
// full-width card instead of showing a sliver of the neighbors.
const MAX_CENTER_WIDTH = 600; // px
const MIN_SIDE_PEEK = 20; // px

// Matches info.tsx scroll-in animation (fade + upward movement).
const itemVariants = {
  hidden: { opacity: 0, y: -40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.1 } },
};

export function AttractionCardCarousel() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure the carousel's real available width (not the viewport): it lives
  // inside max-w-5xl + a padded main, so window.innerWidth would be wrong.
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  // Derive the active layout from the measured width.
  const centerWidth = Math.min(MAX_CENTER_WIDTH, containerWidth);
  const sidePeek = (containerWidth - centerWidth) / 2;
  const isCenterMode = containerWidth > 0 && sidePeek >= MIN_SIDE_PEEK;
  // Before measurement (containerWidth === 0) slideWidth stays 0, so we fall
  // back to the primitive's default basis-full (one full-width card, no flash).
  const slideWidth = containerWidth === 0 ? 0 : isCenterMode ? centerWidth : containerWidth;

  // Embla caches slide sizes; re-measure whenever our computed width changes.
  useEffect(() => {
    api?.reInit();
  }, [api, slideWidth]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="mx-auto min-w-0 w-full max-w-5xl"
    >
      {/* Small screens: stacked cards with portrait 3:4 ratio */}
      <ul className="flex flex-col gap-4 md:hidden">
        {infoTopics.map(({ key, ...attraction }) => (
          <motion.li
            key={key}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={itemVariants}
            className="aspect-[3/4] w-full overflow-hidden rounded-2xl"
          >
            <AttractionCard {...attraction} prominentText className="h-full w-full" />
          </motion.li>
        ))}
      </ul>

      {/* md+: horizontal center-focus carousel with 4:3 cards */}
      <div
        ref={wrapperRef}
        className="hidden overflow-hidden rounded-2xl md:block"
      >
        <Carousel
          setApi={setApi}
          opts={{
            loop: true,
            align: "center",
          }}
        >
          <CarouselContent className="rounded-xl">
            {infoTopics.map(({ key, ...attraction }) => (
              <CarouselItem
                key={key}
                className="aspect-[4/3]"
                style={slideWidth ? { flexBasis: `${slideWidth}px` } : undefined}
              >
                <AttractionCard {...attraction} className="h-full w-full" />
              </CarouselItem>
            ))}
          </CarouselContent>
          {isCenterMode && (
            <>
              <CarouselPrevious variant="ghost" className="invisible sm:visible" />
              <CarouselNext variant="ghost" className="invisible sm:visible" />
            </>
          )}
        </Carousel>
      </div>
    </motion.div>
  );
}
