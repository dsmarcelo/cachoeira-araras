import Image, { type ImageProps } from "next/image";

interface OptimizedImageProps extends Omit<ImageProps, "src"> {
  src: string;
}

export function OptimizedImage({
  src,
  alt,
  sizes,
  ...props
}: OptimizedImageProps) {
  const resolvedSizes = sizes ?? "(max-width: 768px) 100vw, 768px";
  const extensionMatch = /\.[a-zA-Z0-9]+$/.exec(src);

  if (!extensionMatch) {
    const normalizedSrc = src.startsWith("/") ? src : `/images/${src}`;
    const avif768 = `${normalizedSrc}-768.avif`;

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

  return <Image src={src} alt={alt} sizes={resolvedSizes} {...props} />;
}
