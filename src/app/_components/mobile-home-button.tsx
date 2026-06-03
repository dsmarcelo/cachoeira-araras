import Link from "next/link";
import { RiArrowLeftLine } from "react-icons/ri";

/**
 * Fixed back control for small screens (e.g. gallery) so home is one tap away while scrolling.
 */
export function MobileHomeButton() {
  return (
    <Link
      href="/"
      className="fixed left-4 top-[max(4.25rem,calc(env(safe-area-inset-top)+4.25rem))] z-30 flex items-center gap-1 rounded-lg bg-dark-blue/90 px-3 py-2 font-medium text-primary-50 shadow-md backdrop-blur-sm transition-colors hover:bg-dark-blue md:hidden"
    >
      <RiArrowLeftLine className="h-5 w-5" aria-hidden />
      voltar
    </Link>
  );
}
