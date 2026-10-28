"use client";
// Ported from the shadcn/21st.dev Banner (TSX -> JSX, no shadcn Button needed)
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * variant: "normal" | "rainbow" | "warning" | "danger"
 * id: when given, the banner is dismissible and the choice is remembered in localStorage.
 * changeLayout: publishes --banner-height on <html> while visible so sticky headers can sit below it.
 */
export function Banner({ id, variant = "normal", changeLayout = true, message, height = "2.5rem", className, children, ...props }) {
  const key = id ? `banner-${id}` : null;
  const read = () => { try { return key ? localStorage.getItem(key) !== "true" : true; } catch { return true; } };
  const [open, setOpen] = useState(read);

  useEffect(() => { setOpen(read()); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!changeLayout) return;
    const root = document.documentElement;
    if (open) root.style.setProperty("--banner-height", height);
    else root.style.removeProperty("--banner-height");
    return () => root.style.removeProperty("--banner-height");
  }, [open, height, changeLayout]);

  const close = useCallback(() => {
    setOpen(false);
    try { if (key) localStorage.setItem(key, "true"); } catch { /* ignore */ }
  }, [key]);

  if (!open) return null;
  return (
    <div
      id={id}
      role="status"
      {...props}
      style={{ minHeight: height }}
      className={cn(
        "sticky top-0 z-40 flex items-center justify-center gap-3 overflow-hidden px-10 py-1.5 text-center text-sm font-medium",
        variant === "normal" && "bg-card text-ink border-b border-line",
        variant === "rainbow" && "bg-panel text-ink border-b border-line",
        variant === "warning" && "bg-warn-soft text-warn border-b border-warn/20",
        variant === "danger" && "bg-danger-soft text-danger border-b border-danger/20",
        className,
      )}
    >
      {variant === "rainbow" && (
        <>
          <div className="rainbow-banner-gradient-1 absolute inset-0 -z-10" />
          <div className="rainbow-banner-gradient-2 absolute inset-0 -z-10" />
        </>
      )}
      <span className="relative flex flex-wrap items-center justify-center gap-x-3 gap-y-1">{message || children}</span>
      {id && (
        <button type="button" aria-label="Close banner" onClick={close}
          className="absolute end-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-dim hover:bg-black/5">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
