"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "../lib/utils";

/// Consistent back control for sub-pages.
export function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="size-4" />
      Back
    </button>
  );
}
