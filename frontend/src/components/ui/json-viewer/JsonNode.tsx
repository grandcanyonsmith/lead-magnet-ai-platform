import React, { useState } from "react";
import clsx from "clsx";
import { FiChevronRight } from "react-icons/fi";
import {
  MAX_CHILDREN_PREVIEW,
  formatItemCount,
  formatKeyCount,
  isPlainObject,
} from "./utils";
import { JsonPrimitiveValue } from "./JsonPrimitive";

function JsonLeafRow({
  name,
  children,
}: {
  name?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 py-0.5 min-w-0">
      {name !== undefined && (
        <span className="text-cyan-700 dark:text-cyan-300 shrink-0">
          {name}:
        </span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function JsonNode({
  name,
  value,
  depth,
  defaultExpandedDepth,
  ancestors,
}: {
  name?: string;
  value: unknown;
  depth: number;
  defaultExpandedDepth: number;
  ancestors: object[];
}) {
  const [isOpen, setIsOpen] = useState(depth < defaultExpandedDepth);
  const [showAllChildren, setShowAllChildren] = useState(false);

  const isObjectLike = typeof value === "object" && value !== null;
  const nextAncestors =
    isObjectLike && (Array.isArray(value) || isPlainObject(value))
      ? [...ancestors, value as object]
      : ancestors;

  if (isObjectLike) {
    const obj = value as object;
    if (ancestors.includes(obj)) {
      return (
        <JsonLeafRow name={name}>
          <span className="text-gray-400">[Circular]</span>
        </JsonLeafRow>
      );
    }
  }

  if (Array.isArray(value)) {
    const total = value.length;
    const shown = showAllChildren ? total : Math.min(total, MAX_CHILDREN_PREVIEW);
    const remaining = total - shown;

    return (
      <details
        open={isOpen}
        onToggle={(e) => {
          const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
          setIsOpen(nextOpen);
        }}
        className="select-none"
      >
        <summary className="list-none cursor-pointer flex items-start gap-2 py-0.5">
          <FiChevronRight
            className={clsx(
              "mt-0.5 h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0 transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <div className="min-w-0 flex-1">
            <span className="text-cyan-700 dark:text-cyan-300">{name ?? "(root)"}</span>
            <span className="text-gray-500 dark:text-gray-400">: </span>
            <span className="text-gray-700 dark:text-gray-200">[</span>
            <span className="text-gray-500 dark:text-gray-400">{formatItemCount(total)}</span>
            <span className="text-gray-700 dark:text-gray-200">]</span>
          </div>
        </summary>

        <div className="pl-5 ml-[7px] border-l border-gray-200 dark:border-gray-700/60">
          {value.slice(0, shown).map((item, idx) => (
            <JsonNode
              key={`${name ?? "root"}-idx-${idx}`}
              name={`[${idx}]`}
              value={item}
              depth={depth + 1}
              defaultExpandedDepth={defaultExpandedDepth}
              ancestors={nextAncestors}
            />
          ))}
          {remaining > 0 && (
            <button
              type="button"
              className="mt-1 text-[11px] text-cyan-600 dark:text-cyan-300 hover:text-cyan-500 dark:hover:text-cyan-200 active:text-cyan-700 dark:active:text-cyan-100 underline underline-offset-2"
              onClick={() => setShowAllChildren(true)}
            >
              Show {remaining.toLocaleString()} more…
            </button>
          )}
        </div>
      </details>
    );
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    const total = keys.length;
    const shown = showAllChildren ? total : Math.min(total, MAX_CHILDREN_PREVIEW);
    const remaining = total - shown;
    const previewKeys = keys.slice(0, 3);

    return (
      <details
        open={isOpen}
        onToggle={(e) => {
          const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
          setIsOpen(nextOpen);
        }}
        className="select-none"
      >
        <summary className="list-none cursor-pointer flex items-start gap-2 py-0.5">
          <FiChevronRight
            className={clsx(
              "mt-0.5 h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0 transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <div className="min-w-0 flex-1">
            <span className="text-cyan-700 dark:text-cyan-300">{name ?? "(root)"}</span>
            <span className="text-gray-500 dark:text-gray-400">: </span>
            <span className="text-gray-700 dark:text-gray-200">{"{"}</span>
            <span className="text-gray-500 dark:text-gray-400">{formatKeyCount(total)}</span>
            {previewKeys.length > 0 && (
              <span className="text-gray-500 dark:text-gray-400">
                {" "}
                • {previewKeys.join(", ")}
                {total > previewKeys.length ? ", …" : ""}
              </span>
            )}
            <span className="text-gray-700 dark:text-gray-200">{"}"}</span>
          </div>
        </summary>

        <div className="pl-5 ml-[7px] border-l border-gray-200 dark:border-gray-700/60">
          {keys.slice(0, shown).map((key) => (
            <JsonNode
              key={`${name ?? "root"}-key-${key}`}
              name={key}
              value={(value as Record<string, unknown>)[key]}
              depth={depth + 1}
              defaultExpandedDepth={defaultExpandedDepth}
              ancestors={nextAncestors}
            />
          ))}
          {remaining > 0 && (
            <button
              type="button"
              className="mt-1 text-[11px] text-cyan-600 dark:text-cyan-300 hover:text-cyan-500 dark:hover:text-cyan-200 active:text-cyan-700 dark:active:text-cyan-100 underline underline-offset-2"
              onClick={() => setShowAllChildren(true)}
            >
              Show {remaining.toLocaleString()} more…
            </button>
          )}
        </div>
      </details>
    );
  }

  // Fallback for non-plain objects (Date, etc.)
  if (isObjectLike) {
    return (
      <JsonLeafRow name={name}>
        <span className="text-gray-700 dark:text-gray-200">
          {Object.prototype.toString.call(value)}
        </span>
      </JsonLeafRow>
    );
  }

  return (
    <JsonLeafRow name={name}>
      <JsonPrimitiveValue value={value} />
    </JsonLeafRow>
  );
}
