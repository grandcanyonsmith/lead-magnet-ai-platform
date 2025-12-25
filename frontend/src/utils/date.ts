/**
 * Date formatting utilities
 */

export function formatRelativeTime(dateString: string): string {
  // Normalize date string: if it's missing timezone indicator, assume UTC
  // This handles cases like "2025-12-11T01:37:36.150707" which should be treated as UTC
  // ISO 8601 strings without timezone are ambiguous - we assume UTC for API timestamps
  let normalizedDateString = dateString;
  if (
    dateString &&
    !dateString.includes("Z") &&
    !dateString.match(/[+-]\d{2}:\d{2}$/)
  ) {
    // Append 'Z' to indicate UTC if no timezone is present
    normalizedDateString = dateString + "Z";
  }

  const date = new Date(normalizedDateString);
  const now = new Date();

  // Check if date is invalid
  if (isNaN(date.getTime())) {
    return "Invalid date";
  }

  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Handle negative values (date in future or clock skew) - clamp to 0
  if (seconds < 0) {
    return "just now";
  }

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDuration(seconds: number): string {
  if (seconds === 0) return "Instant";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString();
}
