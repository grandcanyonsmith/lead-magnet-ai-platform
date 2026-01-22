"use client";

import React, { Fragment, useRef } from "react";
import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const buttonRef = useRef<HTMLSpanElement>(null);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <Popover className="relative inline-block">
      {({ open, close }) => (
        <div
          onMouseEnter={() => {
            if (!open) {
              buttonRef.current?.click();
            }
          }}
          onMouseLeave={() => {
            if (open) close();
          }}
          onFocus={() => {
            if (!open) {
              buttonRef.current?.click();
            }
          }}
          onBlur={() => {
            if (open) close();
          }}
        >
          <PopoverButton as="span" className="inline-flex">
            <span ref={buttonRef} className="inline-flex">
              {children}
            </span>
          </PopoverButton>
          <Transition
            as={Fragment}
            show={open}
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 translate-y-0.5"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-75"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-0.5"
          >
            <PopoverPanel
              static
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
                  <div className="w-2 h-2 bg-gray-900 rotate-45" />
                </div>
              </div>
            </PopoverPanel>
          </Transition>
        </div>
      )}
    </Popover>
  );
}
