import "server-only";

import fs from "node:fs";
import path from "node:path";

const GALLERY_DIR = path.join(process.cwd(), "public/images");
const GALLERY_PUBLIC_PREFIX = "/images";

const GALLERY_IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".webp",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
]);

function isGalleryImageFile(fileName: string): boolean {
  const extension = path.extname(fileName).toLowerCase();
  return GALLERY_IMAGE_EXTENSIONS.has(extension);
}

/**
 * Lists image files placed directly in public/images.
 * Subfolders such as main-carousel, novas, and principais are excluded.
 */
export function getGalleryImages(): string[] {
  if (!fs.existsSync(GALLERY_DIR)) {
    return [];
  }

  return fs
    .readdirSync(GALLERY_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isGalleryImageFile(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    )
    .map((file) => `${GALLERY_PUBLIC_PREFIX}/${file}`);
}
