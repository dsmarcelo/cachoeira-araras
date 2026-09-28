import { cn } from "@/lib/utils";

/**
 * Full-height centered screen for terminal states of the payment flow
 * (invalid link, waiting, approved, refunded...). `tone="success"` colors the
 * title as a positive outcome.
 */
export function StatusScreen({
  title,
  description,
  tone = "neutral",
  children,
}: {
  title: string;
  description?: string;
  tone?: "neutral" | "success";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 bg-page px-4 py-8 text-center text-fg-muted md:min-h-[calc(100vh-6rem)]">
      <div
        className={cn(
          "text-3xl",
          tone === "success" && "font-bold text-success",
        )}
      >
        {title}
      </div>
      {description ? (
        <p className="max-w-md text-fg-faint">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
