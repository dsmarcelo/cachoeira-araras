import Image, { type ImageProps } from "next/image";

interface OptimizedImageProps extends Omit<ImageProps, "src"> {
  src: string;
}

const IMAGE_EXTENSION_PATTERN = /\.(avif|webp|png|jpe?g|gif)$/i;

/**
 * Static gallery assets are pre-generated as `{basename}-768.avif` under public/images.
 * Callers may pass `/images/foo`, `/images/foo.avif`, or `foo.png` — all resolve to the same file.
 */
function resolveLocalImageSrc(src: string): string | null {
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:")
  ) {
    return null;
  }

  // Vectors and other non-raster assets are served as-is from public/.
  if (src.toLowerCase().endsWith(".svg")) {
    return null;
  }

  const normalized = src.startsWith("/") ? src : `/images/${src}`;

  if (!normalized.startsWith("/images/")) {
    return null;
  }

  if (normalized.endsWith("-768.avif")) {
    return normalized;
  }

  const base = normalized.replace(IMAGE_EXTENSION_PATTERN, "");
  return `${base}-768.avif`;
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
