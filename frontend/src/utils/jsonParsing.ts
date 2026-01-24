type JsonSlice = {
  json: string;
  endIndex: number;
};

const tryParseJson = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const isJsonStart = (ch: string) => ch === "{" || ch === "[";

const extractBalancedJson = (value: string, startIndex: number): JsonSlice | null => {
  const opening = value[startIndex];
  if (!isJsonStart(opening)) return null;

  const stack: string[] = [opening];
  let inString = false;
  let escaped = false;

  for (let i = startIndex + 1; i < value.length; i += 1) {
    const ch = value[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }

    if (ch === "}" || ch === "]") {
      const open = stack.pop();
      if (!open) return null;
      const isMatch = (open === "{" && ch === "}") || (open === "[" && ch === "]");
      if (!isMatch) return null;
      if (stack.length === 0) {
        return { json: value.slice(startIndex, i + 1), endIndex: i };
      }
    }
  }

  return null;
};

const extractJsonCandidates = (value: string, maxCandidates = 6): string[] => {
  const candidates: string[] = [];
  let cursor = 0;

  while (cursor < value.length && candidates.length < maxCandidates) {
    let startIndex = -1;
    for (let i = cursor; i < value.length; i += 1) {
      if (isJsonStart(value[i])) {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) break;

    const slice = extractBalancedJson(value, startIndex);
    if (slice) {
      candidates.push(slice.json);
      cursor = slice.endIndex + 1;
    } else {
      cursor = startIndex + 1;
    }
  }

  return candidates;
};

export const parseJsonFromText = <T>(
  raw: string,
  options?: { preferLast?: boolean },
): T | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = tryParseJson<T>(trimmed);
  if (direct !== null) return direct;

  const candidates = extractJsonCandidates(trimmed);
  if (candidates.length === 0) return null;

  let parsed: T | null = null;
  for (const candidate of candidates) {
    const next = tryParseJson<T>(candidate);
    if (next !== null) {
      parsed = next;
      if (!options?.preferLast) break;
    }
  }

  return parsed;
};
