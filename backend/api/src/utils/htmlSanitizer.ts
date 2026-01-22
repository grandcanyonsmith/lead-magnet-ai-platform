const TEMPLATE_PLACEHOLDER_REGEX = /\{\{\s*[^{}]+\s*\}\}/g;

export function stripTemplatePlaceholders(html: string): string {
  if (!html) {
    return html;
  }
  if (!html.includes("{{")) {
    return html;
  }
  return html.replace(TEMPLATE_PLACEHOLDER_REGEX, "");
}
