"use client";
// Ported from the "orb input" (TSX -> JSX). The orb GIF is replaced by a CSS-animated orb so it works offline
// and matches the app colours. Placeholders type themselves out, one after another.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CHAR_DELAY = 75;
const IDLE_DELAY_AFTER_FINISH = 2200;

export function useTypewriter(list) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(true);
  const key = list.join("\u0000");

  useEffect(() => { setIndex(0); }, [key]);
  useEffect(() => {
    const current = list[index % Math.max(list.length, 1)];
    if (!current) { setText(""); setTyping(false); return; }
    const chars = Array.from(current);
    setText(""); setTyping(true);
    let i = 0, timeout;
    const iv = window.setInterval(() => {
      if (i < chars.length) { setText(chars.slice(0, i + 1).join("")); i += 1; }
      else {
        clearInterval(iv); setTyping(false);
        timeout = window.setTimeout(() => setIndex((p) => (p + 1) % list.length), IDLE_DELAY_AFTER_FINISH);
      }
    }, CHAR_DELAY);
    return () => { clearInterval(iv); clearTimeout(timeout); };
  }, [index, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return `${text}${typing ? "|" : ""}`;
}

export function Orb({ size = 28 }) {
  return (
    <span className="orb relative inline-block shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }} aria-hidden="true">
      <span className="orb-spin absolute inset-[-30%]" />
      <span className="absolute inset-[18%] rounded-full bg-black/25 blur-[2px]" />
      <span className="absolute left-[22%] top-[14%] h-[28%] w-[34%] rounded-full bg-white/50 blur-[3px]" />
    </span>
  );
}

/** Dark pill input with a glowing orb and typing placeholder. Pass the usual input props through. */
export function OrbInput({ placeholders = [], orbSize = 28, className, inputClassName, inputRef, onFocus, onBlur, trailing, ...props }) {
  const [focused, setFocused] = useState(false);
  const placeholder = useTypewriter(placeholders);
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-full border bg-black px-2.5 py-1.5 shadow-lg transition-all duration-300 ease-out",
      focused ? "border-orange-400/70 shadow-orange-500/20" : "border-white/20", className)}>
      <Orb size={orbSize} />
      <span className="h-6 w-px shrink-0 bg-white/20" />
      <input ref={inputRef} type="text" {...props} placeholder={placeholder}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }} onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        className={cn("min-w-0 flex-1 border-none bg-transparent text-sm font-light text-white outline-none placeholder:text-white/45", inputClassName)} />
      {trailing}
    </div>
  );
}

export default OrbInput;
