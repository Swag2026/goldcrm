"use client";
// Minimal TimelineContent: staggered reveal once the container scrolls into view.
import { motion, useInView } from "motion/react";

const DEFAULT_VARIANTS = {
  visible: (i) => ({ y: 0, opacity: 1, filter: "blur(0px)", transition: { delay: i * 0.25, duration: 0.5 } }),
  hidden: { filter: "blur(10px)", y: -20, opacity: 0 },
};

export function TimelineContent({ as = "div", animationNum = 0, timelineRef, customVariants, className, children, ...props }) {
  const inView = useInView(timelineRef, { once: true, amount: 0.05 });
  const Tag = motion[as] || motion.div;
  return (
    <Tag {...props} custom={animationNum} variants={customVariants || DEFAULT_VARIANTS}
      initial="hidden" animate={inView ? "visible" : "hidden"} className={className}>
      {children}
    </Tag>
  );
}
