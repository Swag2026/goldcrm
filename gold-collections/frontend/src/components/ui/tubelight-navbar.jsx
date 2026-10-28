"use client";
// Ported from the "tubelight navbar" (TSX/Next Link -> JSX, controlled by the app's own router).
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * items: [{ id, name, icon }]; active: id; onSelect(id)
 * floating: fixed bottom bar for phones (icons only). Otherwise an inline pill for the header.
 */
export function NavBar({ items, active, onSelect, className, floating = false }) {
  const bar = (
    <nav aria-label="Main"
      className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-1 py-1 shadow-lg backdrop-blur-lg">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button key={item.id} type="button" onClick={() => onSelect(item.id)} aria-current={isActive ? "page" : undefined}
            aria-label={item.name} title={item.name}
            className={cn(
              "relative cursor-pointer rounded-full text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-orange-300",
              floating ? "px-5 py-2.5" : "px-4 py-2",
              "text-white/75 hover:text-orange-300",
              isActive && "bg-white/10 text-orange-300",
            )}>
            <span className={cn("items-center gap-2", floating ? "hidden" : "hidden md:inline-flex")}>
              <Icon size={15} strokeWidth={2.4} /> {item.name}
            </span>
            <span className={floating ? "block" : "md:hidden"}><Icon size={18} strokeWidth={2.5} /></span>
            {isActive && (
              <motion.div layoutId={floating ? "lamp-float" : "lamp"} initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute inset-0 -z-10 w-full rounded-full bg-orange-400/10">
                <div className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-orange-400">
                  <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-orange-400/25 blur-md" />
                  <div className="absolute -top-1 h-6 w-8 rounded-full bg-orange-400/25 blur-md" />
                  <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-orange-400/25 blur-sm" />
                </div>
              </motion.div>
            )}
          </button>
        );
      })}
    </nav>
  );
  if (!floating) return <div className={className}>{bar}</div>;
  return (
    <div className={cn("fixed bottom-0 left-1/2 z-50 mb-4 -translate-x-1/2", className)}>
      <div className="rounded-full bg-side/90 shadow-2xl backdrop-blur-lg">{bar}</div>
    </div>
  );
}
