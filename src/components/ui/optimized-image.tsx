import Image, { type ImageProps } from "next/image";

interface OptimizedImageProps extends Omit<ImageProps, "src"> {
  src: string;
}

const RASTER_EXTENSION_PATTERN = /\.(avif|webp|png|jpe?g|gif)$/i;

/**
 * Normalizes local gallery paths under public/images.
 * Bare filenames become `/images/{name}`; legacy `.png`/`.jpg` callers map to `.avif`.
 */
function resolveLocalImageSrc(src: string): string | null {
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:")
  ) {
    return null;
  }

  if (src.toLowerCase().endsWith(".svg")) {
    return null;
  }

  const normalized = src.startsWith("/") ? src : `/images/${src}`;

  if (!normalized.startsWith("/images/")) {
    return null;
  }

  if (normalized.endsWith(".avif")) {
    return normalized;
  }

  if (!RASTER_EXTENSION_PATTERN.test(normalized)) {
    return normalized;
  }

  const base = normalized.replace(RASTER_EXTENSION_PATTERN, "");
  return `${base}.avif`;
}

export function OptimizedImage({
  src,
  alt,
  sizes,
  ...props
}: OptimizedImageProps) {
  const resolvedSizes = sizes ?? "(max-width: 768px) 100vw, 768px";
  const resolvedSrc = resolveLocalImageSrc(src) ?? src;

  return (
    <Image src={resolvedSrc} alt={alt} sizes={resolvedSizes} {...props} />
  );
}
