import React from "react";
import { JsonStringValue } from "./JsonString";

export function JsonPrimitiveValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-gray-500 dark:text-gray-400">null</span>;
  }
  if (value === undefined) {
    return <span className="text-gray-500 dark:text-gray-400">undefined</span>;
  }
  if (typeof value === "string") {
    return <JsonStringValue value={value} />;
  }
  if (typeof value === "number") {
    return (
      <span className="text-emerald-600 dark:text-emerald-300">
        {String(value)}
      </span>
    );
  }
  if (typeof value === "boolean") {
    return (
      <span className="text-purple-600 dark:text-purple-300">
        {value ? "true" : "false"}
      </span>
    );
  }
  if (typeof value === "bigint") {
    return (
      <span className="text-emerald-600 dark:text-emerald-300">
        {String(value)}n
      </span>
    );
  }
  return <span className="text-gray-700 dark:text-gray-200">{String(value)}</span>;
}
