export const modifyStyle = (html: string, selector: string, css: string): string => {
  if (!html || !selector || !css) return html;
  
  // Naive implementation: append a new style block
  // A robust implementation would parse HTML/CSS, but for a "patch" service, appending is often sufficient override
  const styleTag = `<style>${selector} { ${css} }</style>`;
  return html.replace('</head>', `${styleTag}</head>`);
};
