"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  text: string;
  /** Number of lines to clamp before showing the toggle. Default 3. */
  lines?: number;
  /** Optional additional className for the paragraph */
  className?: string;
  /** Labels for the toggle button */
  readMoreLabel?: string;
  showLessLabel?: string;
}

/**
 * Renders text clamped to a specified number of lines.
 * A "Read more" / "Show less" toggle appears dynamically whenever the content
 * exceeds the clamped boundary, with cross-browser line-clamping and resize detection.
 */
export function ExpandableText({
  text,
  lines = 3,
  className = "",
  readMoreLabel = "Read more",
  showLessLabel = "Show less",
}: Props) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const measure = () => {
      if (!expanded) {
        // scrollHeight > clientHeight indicates the text is clipped
        setOverflows(el.scrollHeight > el.clientHeight + 1);
      }
    };

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [text, lines, expanded]);

  if (!text) return null;

  return (
    <div className="w-full min-w-0">
      <p
        ref={textRef}
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
        }
        className={`break-words transition-all duration-200 ${className}`}
      >
        {text}
      </p>

      {(overflows || expanded) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((prev) => !prev);
          }}
          className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-royal-600 hover:text-royal-800 transition-colors focus:outline-none"
          aria-expanded={expanded}
        >
          <span>{expanded ? showLessLabel : readMoreLabel}</span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}

export const ExpandableBio = ExpandableText;
