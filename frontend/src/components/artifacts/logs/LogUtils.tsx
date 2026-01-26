import React from "react";

export const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const highlightMatches = (text: string, query: string) => {
  if (!query) return text;
  const escaped = escapeRegExp(query);
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  const lowerQuery = query.toLowerCase();
  return parts.map((part, index) =>
    part.toLowerCase() === lowerQuery ? (
      <mark
        key={`match-${index}`}
        className="rounded bg-amber-400/30 px-0.5 text-amber-100"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
};
