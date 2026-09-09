import React, { useRef, useState, useEffect } from "react";

interface SafeChartContainerProps {
  height: number | string;
  minHeight?: number;
  className?: string;
  children: React.ReactNode;
}

export function SafeChartContainer({
  height,
  minHeight = 180,
  className = "",
  children,
}: SafeChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const checkSize = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setIsReady(true);
      }
    };

    checkSize();

    // Use requestAnimationFrame fallback in case initial layout takes a tick
    const rafId = requestAnimationFrame(checkSize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            setIsReady(true);
          }
        }
      });
      resizeObserver.observe(el);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: typeof height === "number" ? `${height}px` : height,
        minWidth: 0,
        minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
      }}
      className={`w-full relative min-w-0 overflow-hidden ${className}`}
    >
      {isReady ? (
        children
      ) : (
        <div className="h-full w-full flex items-center justify-center animate-pulse bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl" />
      )}
    </div>
  );
}

export default SafeChartContainer;
