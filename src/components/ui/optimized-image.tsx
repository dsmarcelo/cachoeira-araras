import React from "react";
import Image, { type ImageProps } from "next/image";

const OPTIMIZED_BASES = new Set([
  "cachoeira-principal",
  "cachoeira2",
  "cachoeira3",
  "cachoeira4",
  "cachoeira5",
  "carousel-1",
  "carousel-2",
  "carousel-3",
  "carousel-4",
  "carousel-5",
  "carousel-6",
  "carousel-7",
  "entrada-cachoeira",
  "mini-bar-1",
  "mini-bar-2",
  "mini-bar-3",
  "mini-cachoeira-1",
  "mini-cachoeira-2",
  "parquinho",
  "piscina-drone",
  "piscina-drone-2",
  "piscina-infantil",
  "piscinas-naturais",
  "placa-cachoeira-das-araras1",
  "placa-trilha-cachoeira2",
  "praia",
  "quiosque",
  "quiosque2",
  "redario",
  "trilha2",
]);

interface OptimizedImageProps extends Omit<ImageProps, "src"> {
  src: string;
}

export function OptimizedImage({
  src,
  alt,
  sizes,
  ...props
}: OptimizedImageProps) {
  // Parse the src to check if it points to an optimized image
  let baseName = "";
  let isOptimized = false;

  // Match optimized images in /images or legacy originals in /images/novas.
  const regex = /(?:^|\/)images\/(?:novas\/)?([^/.]+?)(?:-(?:480|768|1080))?(?:\.[a-zA-Z0-9]+)?$/;
  const match = regex.exec(src);
  if (match?.[1]) {
    const candidate = match[1];
    if (OPTIMIZED_BASES.has(candidate)) {
      baseName = candidate;
      isOptimized = true;
    }
  } else if (!src.includes("/")) {
    if (OPTIMIZED_BASES.has(src)) {
      baseName = src;
      isOptimized = true;
    }
  }

  if (isOptimized) {
    const imageDir = src.includes("/images/novas/") ? "/images/novas" : "/images";
    const avif768 = `${imageDir}/${baseName}-768.avif`;
    const resolvedSizes =
      sizes ?? "(max-width: 768px) 100vw, 768px";

    return (
      <Image
        src={avif768}
        alt={alt}
        sizes={resolvedSizes}
        unoptimized
        {...props}
      />
    );
  }

  // Fallback to standard Image component if not in optimized list
  return <Image src={src} alt={alt} sizes={sizes} {...props} />;
}
