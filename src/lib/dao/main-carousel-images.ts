import "server-only";

import fs from "node:fs";
import path from "node:path";

const MAIN_CAROUSEL_DIR = path.join(
  process.cwd(),
  "public/images/main-carousel",
);
const MAIN_CAROUSEL_PUBLIC_PREFIX = "/images/main-carousel";

/**
 * Lists every .avif file in public/images/main-carousel, regardless of filename.
 * Sorted naturally so carousel-2 comes before carousel-10 when names include numbers.
 */
export function getMainCarouselImages(): string[] {
  if (!fs.existsSync(MAIN_CAROUSEL_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MAIN_CAROUSEL_DIR)
    .filter((file) => file.toLowerCase().endsWith(".avif"))
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    )
    .map((file) => `${MAIN_CAROUSEL_PUBLIC_PREFIX}/${file}`);
}
