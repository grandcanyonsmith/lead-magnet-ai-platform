/**
 * Utilities for exporting data to CSV and JSON
 */

export interface ExportableData {
  [key: string]: unknown;
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(
  data: ExportableData[],
  headers?: string[],
): string {
  if (!data || data.length === 0) {
    return "";
  }

  // Get headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);

  // Escape CSV values (handle commas, quotes, newlines)
  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "";
    }
    const stringValue = String(value);
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (
      stringValue.includes(",") ||
      stringValue.includes('"') ||
      stringValue.includes("\n")
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // Create CSV rows
  const rows = [
    csvHeaders.map(escapeCSV).join(","), // Header row
    ...data.map((row) =>
      csvHeaders.map((header) => escapeCSV(row[header])).join(","),
    ), // Data rows
  ];

  return rows.join("\n");
}

/**
 * Download data as CSV file
 */
export function downloadCSV(
  data: ExportableData[],
  filename: string,
  headers?: string[],
): void {
  const csv = convertToCSV(data, headers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download data as JSON file
 */
export function downloadJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date for filename
 */
export function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}
