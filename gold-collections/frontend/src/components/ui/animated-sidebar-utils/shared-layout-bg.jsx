import { motion } from "motion/react";
import { forwardRef, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SPRING_LAYOUT } from "./ease";

/**
 * Container that draws one "hover pill" which glides between its
 * [data-slot=sidebar-menu-item] children (shared-layout background).
 */
export const SharedLayoutBg = forwardRef(function SharedLayoutBg(
  { as = "div", children, className, inset = 0, pillClassName, pillContainerClassName, onPointerLeave, onPointerMove, onFocus, onBlur, ...props },
  forwardedRef,
) {
  const innerRef = useRef(null);
  const [pill, setPill] = useState(null);
  const Tag = as;

  const setRefs = useCallback(
    (node) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const measure = (target) => {
    const item = target?.closest?.("[data-slot=sidebar-menu-item]");
    const root = innerRef.current;
    if (!item || !root || !root.contains(item)) return setPill(null);
    const a = item.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    // Only the row itself (first child), not an expanded submenu below it.
    const row = item.firstElementChild?.getBoundingClientRect() ?? a;
    setPill({ top: row.top - b.top, height: row.height });
  };

  return (
    <Tag
      {...props}
      ref={setRefs}
      className={cn("relative", className)}
      onPointerMove={(e) => { onPointerMove?.(e); measure(e.target); }}
      onPointerLeave={(e) => { onPointerLeave?.(e); setPill(null); }}
      onFocus={(e) => { onFocus?.(e); measure(e.target); }}
      onBlur={(e) => { onBlur?.(e); setPill(null); }}
    >
      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0", pillContainerClassName)} style={{ insetInline: inset, height: 0, top: 0 }}>
        <motion.span
          initial={false}
          animate={{ y: pill?.top ?? 0, height: pill?.height ?? 36, opacity: pill ? 1 : 0 }}
          transition={{ ...SPRING_LAYOUT, opacity: { duration: 0.12 } }}
          className={cn("absolute inset-x-0 top-0 block", pillClassName)}
        />
      </span>
      {children}
    </Tag>
  );
});
