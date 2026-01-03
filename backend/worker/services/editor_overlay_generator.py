"""
Editor Overlay Generator
Injects a dormant visual editor overlay into HTML lead magnets.
"""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


class EditorOverlayGenerator:
    """Generates and injects a visual editor overlay into lead magnet HTML."""

    def __init__(self):
        # Get API URL from environment (preferred for cross-domain calls from CloudFront-served HTML).
        self.api_url = os.environ.get("API_URL") or os.environ.get("API_GATEWAY_URL") or ""

    def generate_editor_overlay_script(
        self, job_id: str, tenant_id: str, api_url: Optional[str] = None
    ) -> str:
        """
        Generate the editor overlay HTML+JS to inject.

        The overlay stays dormant unless the page is opened with `?editMode=true`.
        """

        effective_api_url = (api_url or self.api_url or "").strip().rstrip("/")

        # Escape values to prevent XSS; json.dumps produces JS string literals safely.
        escaped_job_id = json.dumps(job_id)
        escaped_tenant_id = json.dumps(tenant_id)
        escaped_api_url = json.dumps(effective_api_url)

        # Keep this dependency-free (vanilla JS) so it works in static HTML outputs.
        script = f"""
<!-- Lead Magnet Editor Overlay -->
<style id="lm-editor-overlay-style">
  #lm-editor-overlay-root {{
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    color: #111827;
  }}

  /* Always-visible edit shortcut (shows when editMode is NOT enabled) */
  #lm-edit-mode-fab {{
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483646;
    width: 44px;
    height: 44px;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(17,24,39,0.92);
    color: white;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }}

  #lm-edit-mode-fab:hover {{
    background: #111827;
    transform: translateY(-1px);
  }}

  #lm-edit-mode-fab:active {{
    transform: translateY(0px);
  }}

  #lm-edit-mode-fab:focus-visible {{
    outline: 3px solid rgba(124,58,237,0.9);
    outline-offset: 2px;
  }}

  #lm-edit-mode-fab svg {{
    width: 18px;
    height: 18px;
    display: block;
  }}

  #lm-editor-overlay-tab {{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #111827;
    color: white;
    padding: 10px 12px;
    border-radius: 9999px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    cursor: pointer;
    user-select: none;
  }}

  #lm-editor-overlay-panel {{
    margin-top: 10px;
    width: 340px;
    background: rgba(255,255,255,0.98);
    border: 1px solid rgba(17,24,39,0.12);
    border-radius: 14px;
    box-shadow: 0 16px 50px rgba(0,0,0,0.25);
    overflow: hidden;
    display: none;
  }}

  #lm-editor-overlay-panel .lm-row {{
    display: flex;
    gap: 8px;
    align-items: center;
  }}

  #lm-editor-overlay-panel header {{
    padding: 12px 12px 10px 12px;
    border-bottom: 1px solid rgba(17,24,39,0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}

  #lm-editor-overlay-panel header .lm-title {{
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0.02em;
  }}

  #lm-editor-overlay-panel main {{
    padding: 12px;
  }}

  #lm-editor-overlay-panel .lm-label {{
    font-size: 11px;
    font-weight: 700;
    color: #374151;
    margin: 10px 0 6px 0;
  }}

  #lm-editor-overlay-panel textarea {{
    width: 100%;
    resize: vertical;
    min-height: 84px;
    border: 1px solid rgba(17,24,39,0.18);
    border-radius: 10px;
    padding: 10px;
    font-size: 12px;
    outline: none;
  }}

  #lm-editor-overlay-panel textarea:focus {{
    border-color: rgba(124,58,237,0.7);
    box-shadow: 0 0 0 3px rgba(124,58,237,0.18);
  }}

  #lm-editor-overlay-panel .lm-meta {{
    font-size: 11px;
    color: #6B7280;
    line-height: 1.3;
    word-break: break-all;
  }}

  #lm-editor-overlay-panel .lm-actions {{
    margin-top: 10px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }}

  #lm-editor-overlay-panel button {{
    appearance: none;
    border: 1px solid rgba(17,24,39,0.14);
    background: white;
    color: #111827;
    border-radius: 10px;
    padding: 9px 10px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }}

  #lm-editor-overlay-panel button:hover {{
    background: rgba(17,24,39,0.04);
  }}

  #lm-editor-overlay-panel button.lm-primary {{
    background: #7C3AED;
    color: white;
    border-color: rgba(124,58,237,0.85);
  }}

  #lm-editor-overlay-panel button.lm-primary:hover {{
    background: #6D28D9;
  }}

  #lm-editor-overlay-panel button:disabled {{
    opacity: 0.6;
    cursor: not-allowed;
  }}

  #lm-editor-overlay-panel .lm-footer {{
    padding: 10px 12px;
    border-top: 1px solid rgba(17,24,39,0.08);
    background: rgba(17,24,39,0.02);
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }}

  #lm-editor-overlay-panel .lm-pill {{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.02em;
    padding: 6px 8px;
    border-radius: 999px;
    border: 1px solid rgba(17,24,39,0.12);
    background: white;
  }}

  .lm-editor-highlight {{
    outline: 3px solid rgba(124,58,237,0.9) !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 0 5px rgba(124,58,237,0.18) !important;
    cursor: crosshair !important;
  }}

  .lm-editor-highlight-hover {{
    outline: 2px solid rgba(59,130,246,0.95) !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 0 4px rgba(59,130,246,0.18) !important;
    cursor: crosshair !important;
  }}
</style>
<script>
(function() {{
  'use strict';

  const CFG = {{
    jobId: {escaped_job_id},
    tenantId: {escaped_tenant_id},
    apiUrl: {escaped_api_url},
  }};

  function isEditModeEnabled() {{
    try {{
      const params = new URLSearchParams(window.location.search || '');
      const v = (params.get('editMode') || params.get('editmode') || params.get('edit_mode') || '').trim();
      return /^(1|true|yes)$/i.test(v);
    }} catch (_e) {{
      return false;
    }}
  }}

  function enableEditMode() {{
    try {{
      const url = new URL(window.location.href);
      url.searchParams.set('editMode', 'true');
      window.location.assign(url.toString());
    }} catch (_e) {{
      // Fallback: naive append
      const hasQuery = (window.location.search || '').length > 1;
      window.location.href = window.location.href + (hasQuery ? '&' : '?') + 'editMode=true';
    }}
  }}

  function mountEditFab() {{
    try {{
      if (document.getElementById('lm-edit-mode-fab')) return;
      const btn = document.createElement('button');
      btn.id = 'lm-edit-mode-fab';
      btn.type = 'button';
      btn.title = 'Edit this lead magnet';
      btn.setAttribute('aria-label', 'Edit this lead magnet');
      btn.innerHTML =
        '<svg viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">' +
        '<path d=\"M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z\" fill=\"currentColor\"/>' +
        '<path d=\"M20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z\" fill=\"currentColor\"/>' +
        '</svg>';
      btn.addEventListener('click', function(e) {{
        try {{ e.preventDefault(); e.stopPropagation(); }} catch (_e) {{}}
        enableEditMode();
      }}, true);
      (document.body || document.documentElement).appendChild(btn);
    }} catch (_e) {{}}
  }}

  const editModeEnabled = isEditModeEnabled();
  if (!editModeEnabled) {{
    mountEditFab();
    return;
  }}
  if (document.getElementById('lm-editor-overlay-root')) return;

  function apiBase() {{
    const base = (CFG.apiUrl || window.location.origin || '').replace(/\\/+$/, '');
    return base;
  }}

  function safeJsonParse(text) {{
    try {{ return JSON.parse(text); }} catch (_e) {{ return null; }}
  }}

  function qs(sel, root) {{
    return (root || document).querySelector(sel);
  }}

  function createEl(tag, attrs, children) {{
    const el = document.createElement(tag);
    if (attrs) {{
      Object.keys(attrs).forEach((k) => {{
        if (k === 'class') el.className = attrs[k];
        else if (k === 'text') el.textContent = attrs[k];
        else if (k === 'html') el.innerHTML = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }});
    }}
    if (Array.isArray(children)) {{
      children.forEach((c) => {{
        if (typeof c === 'string') el.appendChild(document.createTextNode(c));
        else if (c) el.appendChild(c);
      }});
    }}
    return el;
  }}

  function computeSelector(el) {{
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + CSS.escape(el.id);

    const parts = [];
    let curr = el;
    while (curr && curr.nodeType === 1 && curr !== document.body) {{
      const tag = curr.tagName.toLowerCase();
      let part = tag;
      const parent = curr.parentElement;
      if (!parent) break;
      const siblings = Array.from(parent.children).filter((c) => c.tagName === curr.tagName);
      if (siblings.length > 1) {{
        const idx = siblings.indexOf(curr) + 1;
        part += `:nth-of-type(${{idx}})`;
      }}
      parts.unshift(part);
      curr = parent;
      if (curr && curr.id) {{
        parts.unshift('#' + CSS.escape(curr.id));
        break;
      }}
    }}
    return parts.join(' > ');
  }}

  const root = createEl('div', {{ id: 'lm-editor-overlay-root' }});

  const tab = createEl('div', {{ id: 'lm-editor-overlay-tab' }}, [
    createEl('span', {{ text: 'Editor' }}),
    createEl('span', {{ text: 'editMode=true', style: 'opacity:0.7;font-weight:700;font-size:11px;' }}),
  ]);

  const panel = createEl('div', {{ id: 'lm-editor-overlay-panel' }});

  const header = createEl('header', null, [
    createEl('div', {{ class: 'lm-title', text: 'Lead Magnet Editor' }}),
    createEl('button', {{ type: 'button', id: 'lm-editor-close', text: 'Close' }}),
  ]);

  const promptLabel = createEl('div', {{ class: 'lm-label', text: 'Describe the change' }});
  const promptInput = createEl('textarea', {{ id: 'lm-editor-prompt', placeholder: 'E.g., “Change this headline to say …” or “Make this section more concise.”' }});

  const selectedLabel = createEl('div', {{ class: 'lm-label', text: 'Selected element' }});
  const selectedMeta = createEl('div', {{ class: 'lm-meta', id: 'lm-editor-selected', text: 'None (click “Pick element”)' }});

  const summaryLabel = createEl('div', {{ class: 'lm-label', text: 'Last AI change summary' }});
  const summaryMeta = createEl('div', {{ class: 'lm-meta', id: 'lm-editor-summary', text: '—' }});

  const pickBtn = createEl('button', {{ type: 'button', id: 'lm-editor-pick', text: 'Pick element' }});
  const screenshotBtn = createEl('button', {{ type: 'button', id: 'lm-editor-screenshot', text: 'Screenshot' }});
  const recordBtn = createEl('button', {{ type: 'button', id: 'lm-editor-record', text: 'Record video' }});
  const previewBtn = createEl('button', {{ type: 'button', id: 'lm-editor-preview', class: 'lm-primary', text: 'Preview AI patch' }});
  const saveBtn = createEl('button', {{ type: 'button', id: 'lm-editor-save', class: 'lm-primary', text: 'Save' }});

  const actionsTop = createEl('div', {{ class: 'lm-actions' }}, [pickBtn, screenshotBtn, recordBtn, previewBtn]);
  const footer = createEl('div', {{ class: 'lm-footer' }}, [
    createEl('div', {{ class: 'lm-pill', text: `job ${{String(CFG.jobId).slice(-8)}}` }}),
    saveBtn,
  ]);

  const main = createEl('main', null, [
    selectedLabel,
    selectedMeta,
    promptLabel,
    promptInput,
    summaryLabel,
    summaryMeta,
    actionsTop,
  ]);

  panel.appendChild(header);
  panel.appendChild(main);
  panel.appendChild(footer);
  root.appendChild(tab);
  root.appendChild(panel);
  document.body.appendChild(root);

  let isOpen = false;
  let pickMode = false;
  let hoveredEl = null;
  let selectedEl = null;
  let selectedSelector = '';
  let lastPatchedHtml = '';

  function setOpen(next) {{
    isOpen = next;
    panel.style.display = isOpen ? 'block' : 'none';
  }}

  function isOverlayElement(el) {{
    if (!el) return false;
    return Boolean(el.closest && el.closest('#lm-editor-overlay-root'));
  }}

  function clearHover() {{
    if (hoveredEl) hoveredEl.classList.remove('lm-editor-highlight-hover');
    hoveredEl = null;
  }}

  function clearSelected() {{
    if (selectedEl) selectedEl.classList.remove('lm-editor-highlight');
    selectedEl = null;
    selectedSelector = '';
    selectedMeta.textContent = 'None (click “Pick element”)';
  }}

  function enablePickMode(enable) {{
    pickMode = enable;
    pickBtn.textContent = pickMode ? 'Picking… (click element)' : 'Pick element';
    if (!pickMode) {{
      clearHover();
    }}
  }}

  tab.addEventListener('click', () => setOpen(!isOpen));
  qs('#lm-editor-close', panel).addEventListener('click', () => setOpen(false));

  pickBtn.addEventListener('click', () => {{
    setOpen(true);
    enablePickMode(!pickMode);
  }});

  document.addEventListener('mousemove', (e) => {{
    if (!pickMode) return;
    const target = e.target;
    if (!target || target === document.body || isOverlayElement(target)) return;
    if (hoveredEl === target) return;
    clearHover();
    hoveredEl = target;
    hoveredEl.classList.add('lm-editor-highlight-hover');
  }}, true);

  document.addEventListener('click', (e) => {{
    if (!pickMode) return;
    const target = e.target;
    if (!target || isOverlayElement(target)) return;
    e.preventDefault();
    e.stopPropagation();
    clearHover();
    if (selectedEl) selectedEl.classList.remove('lm-editor-highlight');
    selectedEl = target;
    selectedEl.classList.add('lm-editor-highlight');
    selectedSelector = computeSelector(selectedEl);
    selectedMeta.textContent = selectedSelector || '(unable to compute selector)';
    enablePickMode(false);
    setOpen(true);
  }}, true);

  async function loadScriptOnce(src) {{
    return await new Promise((resolve, reject) => {{
      const existing = document.querySelector(`script[src=\"${{src}}\"]`);
      if (existing) return resolve(true);
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error('Failed to load script: ' + src));
      document.head.appendChild(s);
    }});
  }}

  screenshotBtn.addEventListener('click', async () => {{
    if (!selectedEl) {{
      alert('Pick an element first.');
      return;
    }}
    try {{
      screenshotBtn.disabled = true;
      screenshotBtn.textContent = 'Preparing…';
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
      const canvas = await window.html2canvas(selectedEl, {{ backgroundColor: null, scale: 2 }});
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `leadmagnet_${{String(CFG.jobId).slice(-8)}}.png`;
      a.click();
    }} catch (err) {{
      console.error(err);
      alert('Screenshot failed.');
    }} finally {{
      screenshotBtn.disabled = false;
      screenshotBtn.textContent = 'Screenshot';
    }}
  }});

  let recorder = null;
  let recordedChunks = [];
  recordBtn.addEventListener('click', async () => {{
    try {{
      if (recorder && recorder.state !== 'inactive') {{
        recordBtn.disabled = true;
        recordBtn.textContent = 'Stopping…';
        recorder.stop();
        return;
      }}

      recordedChunks = [];
      const stream = await navigator.mediaDevices.getDisplayMedia({{ video: true, audio: false }});
      recorder = new MediaRecorder(stream, {{ mimeType: 'video/webm' }});
      recorder.ondataavailable = (e) => {{
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      }};
      recorder.onstop = async () => {{
        try {{
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(recordedChunks, {{ type: 'video/webm' }});
          
          recordBtn.textContent = 'Uploading…';
          
          // 1. Get Presigned URL
          const sessionId = `sess_${{Math.random().toString(36).slice(2)}}${Date.now()}`;
          const uploadData = await postJson('/v1/tracking/recording-url', {{
            job_id: CFG.jobId,
            session_id: sessionId,
            content_type: 'video/webm',
            timestamp: Date.now()
          }});
          
          if (!uploadData || !uploadData.uploadUrl) {{
             throw new Error('Failed to get upload URL');
          }}
          
          // 2. Upload video
          const uploadRes = await fetch(uploadData.uploadUrl, {{
            method: 'PUT',
            headers: {{ 'Content-Type': 'video/webm' }},
            body: blob
          }});
          
          if (!uploadRes.ok) {{
             throw new Error('Upload to S3 failed: ' + uploadRes.status);
          }}
          
          // 3. Record event
          await postJson('/v1/tracking/event', {{
             job_id: CFG.jobId,
             session_id: sessionId,
             event_type: 'recording_uploaded',
             recording_url: uploadData.uploadUrl.split('?')[0], // Public URL (approx)
             recording_key: uploadData.key,
             page_url: window.location.href,
             page_title: document.title
          }});

          alert('Recording uploaded successfully!');
          
        }} catch (err) {{
          console.error(err);
          alert('Recording upload failed: ' + err.message);
        }} finally {{
           recordBtn.disabled = false;
           recordBtn.textContent = 'Record video';
        }}
      }};
      recorder.start();
      recordBtn.textContent = 'Stop recording';
    }} catch (err) {{
      console.error(err);
      alert('Recording failed or was blocked.');
      recordBtn.disabled = false;
      recordBtn.textContent = 'Record video';
    }}
  }});

  async function postJson(path, payload) {{
    const url = apiBase() + path;
    const res = await fetch(url, {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify(payload || {{}}),
    }});
    const text = await res.text();
    const data = safeJsonParse(text) || {{ raw: text }};
    if (!res.ok) {{
      const msg = (data && data.message) ? data.message : ('Request failed: ' + res.status);
      throw new Error(msg);
    }}
    return data;
  }}

  function applyPatchedHtml(html) {{
    // Replace body contents with patched body, then re-mount overlay.
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    if (!doc || !doc.body) {{
      throw new Error('Invalid patched HTML');
    }}
    const nextBody = doc.body.innerHTML || '';
    document.body.innerHTML = nextBody;
    // re-add overlay
    document.body.appendChild(root);
    // Re-apply highlight if possible
    clearSelected();
    clearHover();
  }}

  previewBtn.addEventListener('click', async () => {{
    const prompt = (promptInput.value || '').trim();
    if (!prompt) {{
      alert('Please describe what you want changed.');
      return;
    }}
    try {{
      previewBtn.disabled = true;
      previewBtn.textContent = 'Patching…';
      const payload = {{
        selector: selectedSelector || null,
        selected_outer_html: selectedEl ? String(selectedEl.outerHTML || '').slice(0, 5000) : null,
        prompt,
        page_url: window.location.href,
      }};
      const data = await postJson(`/v1/jobs/${{encodeURIComponent(CFG.jobId)}}/html/patch`, payload);
      if (data && data.summary) summaryMeta.textContent = String(data.summary);
      if (data && data.patched_html) {{
        lastPatchedHtml = String(data.patched_html);
        applyPatchedHtml(lastPatchedHtml);
        setOpen(true);
      }} else {{
        throw new Error('No patched_html returned.');
      }}
    }} catch (err) {{
      console.error(err);
      alert(err && err.message ? err.message : 'Patch failed.');
    }} finally {{
      previewBtn.disabled = false;
      previewBtn.textContent = 'Preview AI patch';
    }}
  }});

  saveBtn.addEventListener('click', async () => {{
    if (!lastPatchedHtml) {{
      alert('Preview a patch first.');
      return;
    }}
    try {{
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      const data = await postJson(`/v1/jobs/${{encodeURIComponent(CFG.jobId)}}/html/save`, {{
        patched_html: lastPatchedHtml,
      }});
      if (data && data.message) {{
        summaryMeta.textContent = String(data.message);
      }}
      saveBtn.textContent = 'Saved ✓';
      setTimeout(() => {{
        // Reload to pick up the saved, invalidated CloudFront version.
        window.location.reload();
      }}, 800);
    }} catch (err) {{
      console.error(err);
      alert(err && err.message ? err.message : 'Save failed.');
    }} finally {{
      setTimeout(() => {{
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }}, 1500);
    }}
  }});

  // Open by default when entering edit mode to make it obvious.
  setOpen(true);
}})();
</script>
"""

        return script.strip()

    def inject_editor_overlay(
        self, html_content: str, job_id: str, tenant_id: str, api_url: Optional[str] = None
    ) -> str:
        """
        Inject editor overlay into HTML content (before </body> when present).
        """

        overlay = self.generate_editor_overlay_script(job_id, tenant_id, api_url=api_url)
        if not overlay:
            logger.warning("[EditorOverlayGenerator] No overlay generated; returning original HTML")
            return html_content

        # Insert before closing body tag (case-insensitive).
        if "</body>" in html_content.lower():
            import re

            html_content = re.sub(
                r"</body>",
                overlay + "\n</body>",
                html_content,
                flags=re.IGNORECASE,
            )
        else:
            html_content += "\n" + overlay

        logger.info(
            "[EditorOverlayGenerator] Editor overlay injected into HTML",
            extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "overlay_length": len(overlay),
            },
        )

        return html_content


