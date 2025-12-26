export const SELECTION_SCRIPT = `
  window.__selectionMode = false;

  // Store original inline styles so our hover/selection UI does NOT leak into captured outerHTML.
  const __lmOriginalStyles = new WeakMap();
  const __lmGetEl = (e) => {
    const t = e && e.target;
    return t && t.nodeType === 1 ? t : null; // Element
  };
  
  document.addEventListener('mouseover', (e) => {
    if (window.__selectionMode) {
      e.stopPropagation();
      const el = __lmGetEl(e);
      if (!el) return;
      if (!__lmOriginalStyles.has(el)) {
        __lmOriginalStyles.set(el, { outline: el.style.outline || '', cursor: el.style.cursor || '' });
      }
      el.style.outline = '2px dashed #8b5cf6';
      el.style.cursor = 'crosshair';
    }
  }, true);

  document.addEventListener('mouseout', (e) => {
    if (window.__selectionMode) {
      e.stopPropagation();
      const el = __lmGetEl(e);
      if (!el) return;
      const original = __lmOriginalStyles.get(el);
      if (original) {
        el.style.outline = original.outline || '';
        el.style.cursor = original.cursor || '';
        __lmOriginalStyles.delete(el);
      } else {
        el.style.outline = '';
        el.style.cursor = '';
      }
    }
  }, true);

  document.addEventListener('click', (e) => {
    if (window.__selectionMode) {
      e.preventDefault();
      e.stopPropagation();

      const el = __lmGetEl(e);
      if (!el) return;
      
      const tagName = el.tagName.toLowerCase();
      const id = el.id ? '#' + el.id : '';
      const classes = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(c => c).join('.') : '';
      const selector = tagName + id + classes;

      // Capture the element's outerHTML WITHOUT our temporary outline/cursor styles.
      const original = __lmOriginalStyles.get(el) || { outline: '', cursor: '' };
      const clone = el.cloneNode(true);
      clone.style.outline = original.outline || '';
      clone.style.cursor = original.cursor || '';
      
      window.parent.postMessage({ 
        type: 'ELEMENT_SELECTED', 
        selector, 
        outerHtml: clone.outerHTML 
      }, '*');
      
      // Temporary flash
      const originalOutline = original.outline || '';
      const originalCursor = original.cursor || '';
      el.style.outline = '2px solid #8b5cf6';
      setTimeout(() => {
        el.style.outline = originalOutline;
        el.style.cursor = originalCursor;
        __lmOriginalStyles.delete(el);
      }, 500);
    }
  }, true);

  window.addEventListener('message', (e) => {
    if (e.data.type === 'TOGGLE_SELECTION_MODE') {
        window.__selectionMode = e.data.enabled;
    }
    if (e.data.type === 'UPDATE_CONTENT') {
        // Optional: Update content without reload if needed
    }
  });
`;

