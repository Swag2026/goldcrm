"use client";
// Ported from danielpetho/vertical-cut-reveal (TSX -> JSX, framer-motion -> motion/react)
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const VerticalCutReveal = forwardRef(function VerticalCutReveal(
  {
    children, reverse = false, transition = { type: "spring", stiffness: 190, damping: 22 }, splitBy = "words",
    staggerDuration = 0.2, staggerFrom = "first", containerClassName, wordLevelClassName, elementLevelClassName,
    onClick, onStart, onComplete, autoStart = true, ...props
  },
  ref,
) {
  const containerRef = useRef(null);
  const text = typeof children === "string" ? children : children?.toString() || "";
  const [isAnimating, setIsAnimating] = useState(false);

  const splitIntoCharacters = (s) => {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
      return Array.from(segmenter.segment(s), ({ segment }) => segment);
    }
    return Array.from(s);
  };

  const elements = useMemo(() => {
    const words = text.split(" ");
    if (splitBy === "characters") {
      return words.map((word, i) => ({ characters: splitIntoCharacters(word), needsSpace: i !== words.length - 1 }));
    }
    return splitBy === "words" ? text.split(" ") : splitBy === "lines" ? text.split("\n") : text.split(splitBy);
  }, [text, splitBy]);

  const getStaggerDelay = useCallback((index) => {
    const total = splitBy === "characters"
      ? elements.reduce((acc, word) => acc + (typeof word === "string" ? 1 : word.characters.length + (word.needsSpace ? 1 : 0)), 0)
      : elements.length;
    if (staggerFrom === "first") return index * staggerDuration;
    if (staggerFrom === "last") return (total - 1 - index) * staggerDuration;
    if (staggerFrom === "center") return Math.abs(Math.floor(total / 2) - index) * staggerDuration;
    if (staggerFrom === "random") return Math.abs(Math.floor(Math.random() * total) - index) * staggerDuration;
    return Math.abs(staggerFrom - index) * staggerDuration;
  }, [elements, splitBy, staggerFrom, staggerDuration]);

  const startAnimation = useCallback(() => { setIsAnimating(true); onStart?.(); }, [onStart]);
  useImperativeHandle(ref, () => ({ startAnimation, reset: () => setIsAnimating(false) }));
  useEffect(() => { if (autoStart) startAnimation(); }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const variants = {
    hidden: { y: reverse ? "-100%" : "100%" },
    visible: (i) => ({ y: 0, transition: { ...transition, delay: (transition?.delay || 0) + getStaggerDelay(i) } }),
  };

  const list = splitBy === "characters"
    ? elements
    : elements.map((el, i) => ({ characters: [el], needsSpace: i !== elements.length - 1 }));

  return (
    <span className={cn(containerClassName, "flex flex-wrap whitespace-pre-wrap", splitBy === "lines" && "flex-col")}
      onClick={onClick} ref={containerRef} {...props}>
      <span className="sr-only">{text}</span>
      {list.map((wordObj, wordIndex, array) => {
        const previousCharsCount = array.slice(0, wordIndex).reduce((sum, w) => sum + w.characters.length, 0);
        return (
          <span key={wordIndex} aria-hidden="true" className={cn("inline-flex overflow-hidden", wordLevelClassName)}>
            {wordObj.characters.map((char, charIndex) => (
              <span className={cn(elementLevelClassName, "whitespace-pre-wrap relative")} key={charIndex}>
                <motion.span
                  custom={previousCharsCount + charIndex}
                  initial="hidden"
                  animate={isAnimating ? "visible" : "hidden"}
                  variants={variants}
                  onAnimationComplete={wordIndex === list.length - 1 && charIndex === wordObj.characters.length - 1 ? onComplete : undefined}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              </span>
            ))}
            {wordObj.needsSpace && <span> </span>}
          </span>
        );
      })}
    </span>
  );
});

export { VerticalCutReveal };
