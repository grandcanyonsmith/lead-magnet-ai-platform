"use client";

import React, { useState } from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
        >
          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg max-w-xs whitespace-normal">
            {content}
            <div
              className={`absolute ${
                position === "top"
                  ? "top-full left-1/2 -translate-x-1/2 -mt-1"
                  : position === "bottom"
                    ? "bottom-full left-1/2 -translate-x-1/2 -mb-1"
                    : position === "left"
                      ? "left-full top-1/2 -translate-y-1/2 -ml-1"
                      : "right-full top-1/2 -translate-y-1/2 -mr-1"
              }`}
            >
              <div
                className={`w-2 h-2 bg-gray-900 ${
                  position === "top"
                    ? "rotate-45"
                    : position === "bottom"
                      ? "rotate-45"
                      : position === "left"
                        ? "rotate-45"
                        : "rotate-45"
                }`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
