export const injectScript = (html: string, scriptContent: string, location: 'head' | 'body' = 'body'): string => {
  if (!html || !scriptContent) return html;
  
  const scriptTag = `<script>${scriptContent}</script>`;
  
  if (location === 'head') {
    return html.replace('</head>', `${scriptTag}</head>`);
  } else {
    return html.replace('</body>', `${scriptTag}</body>`);
  }
};
