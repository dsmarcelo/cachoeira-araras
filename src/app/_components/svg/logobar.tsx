import Image from "next/image"
import type { ComponentProps } from "react"

/** Renders the logo from an optimized static asset instead of an embedded bitmap. */
function LogoBar(
  props: Omit<ComponentProps<typeof Image>, "alt" | "height" | "src" | "width">,
) {
  return <Image alt="" src="/images/logo-bar.webp" width={1066} height={517} {...props} />
}

export { LogoBar }
