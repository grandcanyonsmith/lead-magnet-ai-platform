export const replaceText = (html: string, target: string, replacement: string): string => {
  if (!html || !target) return html;
  return html.split(target).join(replacement);
};
