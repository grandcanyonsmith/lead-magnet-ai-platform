/**
 * Template utility functions
 */

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

export function formatHTML(html: string): string {
  // Simple HTML formatting - indent based on tags
  let formatted = html;
  formatted = formatted.replace(/>\s*</g, ">\n<");
  const lines = formatted.split("\n");
  let indent = 0;
  const formattedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("</")) {
      indent = Math.max(0, indent - 2);
    }
    const indented = " ".repeat(indent) + trimmed;
    if (
      trimmed.startsWith("<") &&
      !trimmed.startsWith("</") &&
      !trimmed.endsWith("/>")
    ) {
      indent += 2;
    }
    return indented;
  });
  return formattedLines.join("\n");
}

export function getPreviewHtml(
  html: string,
  _placeholders: Record<string, string> = {},
): string {
  if (!html.trim()) return "";

  return stripTemplatePlaceholders(html);
}

export function getDevicePreviewWidth(
  device: "mobile" | "tablet" | "desktop",
): string {
  switch (device) {
    case "mobile":
      return "375px";
    case "tablet":
      return "768px";
    default:
      return "100%";
  }
}

export function getSelectionScript(): string {
  return `
    <style>
      .ai-selected-element {
        outline: 2px solid #2563eb !important;
        outline-offset: 2px !important;
        cursor: pointer !important;
        position: relative !important;
      }
      .ai-selected-element::after {
        content: "selected";
        position: absolute;
        top: -20px;
        left: 0;
        background: #2563eb;
        color: white;
        font-size: 10px;
        padding: 2px 4px;
        border-radius: 2px;
        z-index: 10000;
        pointer-events: none;
        white-space: nowrap;
      }
      .ai-hover-element {
        outline: 1px dashed #60a5fa !important;
        cursor: pointer !important;
      }
    </style>
    <script>
      (function() {
        let isSelectMode = false;
        
        function getUniqueSelector(el) {
          if (!el || el.tagName.toLowerCase() === 'html') return null;
          if (el.id) return '#' + el.id;
          
          const path = [];
          while (el && el.nodeType === Node.ELEMENT_NODE && el.tagName.toLowerCase() !== 'html') {
            let selector = el.tagName.toLowerCase();
            if (el.className && typeof el.className === 'string') {
              const classes = el.className.split(' ').filter(c => c && !c.startsWith('ai-'));
              if (classes.length) {
                selector += '.' + classes.join('.');
              }
            }
            
            let sibling = el;
            let nth = 1;
            while (sibling = sibling.previousElementSibling) {
              if (sibling.tagName === el.tagName) nth++;
            }
            if (nth > 1) selector += ':nth-of-type(' + nth + ')';
            
            path.unshift(selector);
            el = el.parentElement;
          }
          return path.join(' > ');
        }

        function toggleSelection(el) {
          if (el.tagName.toLowerCase() === 'body' || el.tagName.toLowerCase() === 'html') return;
          el.classList.toggle('ai-selected-element');
          updateSelection();
        }

        function updateSelection() {
          const selected = document.querySelectorAll('.ai-selected-element');
          const selectors = Array.from(selected).map(getUniqueSelector).filter(Boolean);
          window.parent.postMessage({ type: 'SELECTION_CHANGED', selectors }, '*');
        }

        window.addEventListener('message', function(event) {
          if (event.data.type === 'TOGGLE_SELECT_MODE') {
            isSelectMode = event.data.enabled;
            document.body.style.cursor = isSelectMode ? 'crosshair' : 'default';
            if (!isSelectMode) {
              document.querySelectorAll('.ai-selected-element').forEach(el => el.classList.remove('ai-selected-element'));
              updateSelection();
            }
          }
        });

        document.addEventListener('mouseover', function(e) {
          if (!isSelectMode) return;
          e.stopPropagation();
          e.target.classList.add('ai-hover-element');
        });

        document.addEventListener('mouseout', function(e) {
          if (!isSelectMode) return;
          e.stopPropagation();
          e.target.classList.remove('ai-hover-element');
        });

        document.addEventListener('click', function(e) {
          if (!isSelectMode) return;
          e.preventDefault();
          e.stopPropagation();
          toggleSelection(e.target);
        });
      })();
    </script>
  `;
}
