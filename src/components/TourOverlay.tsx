import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tour } from "@/lib/tour-system";

interface TourOverlayProps {
  tour: Tour;
  onComplete: () => void;
  onSkip: () => void;
}

export function TourOverlay({ tour, onComplete, onSkip }: TourOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const step = tour.steps[stepIndex];
  const isLast = stepIndex === tour.steps.length - 1;

  const updateTargetRect = useCallback(() => {
    if (!step?.target) return;
    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        setTargetRect(el.getBoundingClientRect());
      }, 350);
    } else {
      setTargetRect(null);
    }
  }, [step?.target]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener("resize", updateTargetRect);
    return () => window.removeEventListener("resize", updateTargetRect);
  }, [updateTargetRect]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      if (e.key === "ArrowRight" || e.key === "Enter") {
        if (isLast) onComplete();
        else setStepIndex((i) => i + 1);
      }
      if (e.key === "ArrowLeft" && stepIndex > 0) setStepIndex((i) => i - 1);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isLast, onComplete, onSkip, stepIndex]);

  const padding = step?.spotlightPadding ?? 8;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const pos = step?.position || "bottom";
    const gap = 12;
    const style: React.CSSProperties = { position: "fixed", zIndex: 10002, maxWidth: 360 };

    switch (pos) {
      case "top":
        style.bottom = `${window.innerHeight - targetRect.top + gap + padding}px`;
        style.left = `${targetRect.left + targetRect.width / 2}px`;
        style.transform = "translateX(-50%)";
        break;
      case "left":
        style.top = `${targetRect.top + targetRect.height / 2}px`;
        style.right = `${window.innerWidth - targetRect.left + gap + padding}px`;
        style.transform = "translateY(-50%)";
        break;
      case "right":
        style.top = `${targetRect.top + targetRect.height / 2}px`;
        style.left = `${targetRect.right + gap + padding}px`;
        style.transform = "translateY(-50%)";
        break;
      default: // bottom
        style.top = `${targetRect.bottom + gap + padding}px`;
        style.left = `${targetRect.left + targetRect.width / 2}px`;
        style.transform = "translateX(-50%)";
        break;
    }

    return style;
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000]"
        onClick={(e) => {
          if (e.target === overlayRef.current) onSkip();
        }}
      >
        {/* Backdrop with spotlight cutout using CSS clip-path */}
        <div
          className="absolute inset-0 bg-background/70 backdrop-blur-[2px]"
          style={
            targetRect
              ? {
                  clipPath: `polygon(
                    0% 0%, 0% 100%, 
                    ${targetRect.left - padding}px 100%, 
                    ${targetRect.left - padding}px ${targetRect.top - padding}px, 
                    ${targetRect.right + padding}px ${targetRect.top - padding}px, 
                    ${targetRect.right + padding}px ${targetRect.bottom + padding}px, 
                    ${targetRect.left - padding}px ${targetRect.bottom + padding}px, 
                    ${targetRect.left - padding}px 100%, 
                    100% 100%, 100% 0%
                  )`,
                }
              : {}
          }
        />

        {/* Spotlight border */}
        {targetRect && (
          <div
            className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_4px_hsl(var(--primary)/0.15)] pointer-events-none"
            style={{
              top: targetRect.top - padding,
              left: targetRect.left - padding,
              width: targetRect.width + padding * 2,
              height: targetRect.height + padding * 2,
              zIndex: 10001,
            }}
          />
        )}

        {/* Tooltip card */}
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          style={getTooltipStyle()}
          className="bg-card border border-border rounded-xl shadow-2xl p-4 w-[340px]"
        >
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-muted-foreground">
              📍 Step {stepIndex + 1} of {tour.steps.length}
            </span>
            <button
              onClick={onSkip}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close tour"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title & content */}
          <h4 className="text-sm font-semibold text-foreground mb-1">{step.title}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
            {step.content.split(/\*\*(.*?)\*\*/g).map((part, i) =>
              i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : part
            )}
          </p>

          {/* Progress dots & buttons */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-1">
              {tour.steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === stepIndex ? "bg-primary" : i < stepIndex ? "bg-primary/40" : "bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setStepIndex((i) => i - 1)}
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </Button>
              )}
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  if (isLast) onComplete();
                  else setStepIndex((i) => i + 1);
                }}
              >
                {isLast ? "Done" : "Next"} {!isLast && <ChevronRight className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
