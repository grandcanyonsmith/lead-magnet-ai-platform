"""
Recording Script Generator
Generates JavaScript recording code (rrweb) to inject into HTML lead magnets.
"""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


class RecordingScriptGenerator:
    """Generates JavaScript session recording code for lead magnets."""
    
    def __init__(self):
        """Initialize recording script generator."""
        # Get API URL from environment
        self.api_url = os.environ.get('API_URL') or os.environ.get('API_GATEWAY_URL') or ''
    
    def generate_recording_script(self, job_id: str, tenant_id: str, api_url: Optional[str] = None) -> str:
        """
        Generate JavaScript recording code to inject into HTML.
        
        Args:
            job_id: Job ID for the lead magnet
            tenant_id: Tenant ID
            api_url: Optional API base URL override (preferred). Falls back to env/API_URL.
            
        Returns:
            JavaScript code as string
        """
        effective_api_url = (api_url or self.api_url or '').strip()

        if not effective_api_url:
            logger.warning("[RecordingScriptGenerator] API_URL not set; recording will likely fail")
        
        # Escape values
        escaped_job_id = json.dumps(job_id)
        escaped_tenant_id = json.dumps(tenant_id)
        escaped_api_url = json.dumps(effective_api_url.rstrip("/"))
        
        # Generate recording script
        # We use rrweb for session recording
        script = f"""
<!-- Session Recording Script -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/rrweb@latest/dist/rrweb.min.css" />
<script src="https://cdn.jsdelivr.net/npm/rrweb@latest/dist/rrweb.min.js"></script>
<script>
(function() {{
    'use strict';
    
    if (typeof rrweb === 'undefined') {{
        console.warn('rrweb not loaded, skipping recording');
        return;
    }}

    // Configuration
    const RECORDING_CONFIG = {{
        jobId: {escaped_job_id},
        tenantId: {escaped_tenant_id},
        apiUrl: {escaped_api_url},
        chunkSize: 50, // Upload every 50 events or on unload
        maxEvents: 5000, // Safety limit per session
    }};

    let events = [];
    let eventCount = 0;
    let sessionId = localStorage.getItem('lm_session_id') || 'sess_' + Math.random().toString(36).substring(2, 15);
    
    // Helper to get upload URL
    async function getUploadUrl(partNumber) {{
        const base = (RECORDING_CONFIG.apiUrl || window.location.origin || '').replace(/\\/+$/, '');
        if (!base || base === 'null') return null;
        
        try {{
            const response = await fetch(base + '/v1/tracking/recording-url', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{
                    job_id: RECORDING_CONFIG.jobId,
                    session_id: sessionId,
                    part_number: partNumber,
                    timestamp: Date.now()
                }})
            }});
            
            if (!response.ok) return null;
            const data = await response.json();
            return data.uploadUrl;
        }} catch (e) {{
            console.error('Failed to get upload URL', e);
            return null;
        }}
    }}
    
    // Upload a batch of events
    async function uploadEvents(eventsBatch, partNumber) {{
        if (eventsBatch.length === 0) return;
        
        const uploadUrl = await getUploadUrl(partNumber);
        if (!uploadUrl) return;
        
        try {{
            await fetch(uploadUrl, {{
                method: 'PUT',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{ events: eventsBatch }})
            }});
        }} catch (e) {{
            console.error('Failed to upload recording events', e);
        }}
    }}
    
    // Start recording
    let stopFn = rrweb.record({{
        emit(event) {{
            if (eventCount >= RECORDING_CONFIG.maxEvents) return;
            
            events.push(event);
            eventCount++;
            
            // Batch upload
            if (events.length >= RECORDING_CONFIG.chunkSize) {{
                const batch = events;
                events = [];
                uploadEvents(batch, Date.now());
            }}
        }},
        // record canvas if needed, but usually heavy
        recordCanvas: false,
        checkoutEveryNth: 100, // Checkout full snapshot every 100 events
    }});
    
    // Handle unload
    window.addEventListener('beforeunload', function() {{
        if (events.length > 0) {{
            // Attempt to upload remaining events
            // Since we can't await fetch in beforeunload easily without keepalive, 
            // and PUT to S3 presigned might not support keepalive or beacon,
            // we'll try best effort with fetch keepalive if supported for PUT? 
            // S3 PUT doesn't support beacon (POST).
            // We'll try synchronous-like behavior or fetch with keepalive: true
            
            const batch = events;
            events = [];
            
            // We have to get the URL first, which is async. 
            // This is tricky in unload.
            // Simplified: we might lose the last few events unless we use sendBeacon to a proxy.
            // But we wanted direct S3.
            // Alternative: send to our API (proxy) via sendBeacon.
            // For now, let's try to get a URL and upload if possible, or just accept some loss.
            
            // A better approach for unload is to send to an API endpoint that handles the upload async,
            // but we want to use the S3 bucket directly.
            
            // Let's try fetch with keepalive
            getUploadUrl(Date.now() + '_final').then(url => {{
                if (url) {{
                    fetch(url, {{
                        method: 'PUT',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{ events: batch }}),
                        keepalive: true
                    }}).catch(e => console.error(e));
                }}
            }});
        }}
    }});
    
}})();
</script>
"""
        return script.strip()
    
    def inject_recording_script(self, html_content: str, job_id: str, tenant_id: str, api_url: Optional[str] = None) -> str:
        """
        Inject recording script into HTML content.
        
        Args:
            html_content: Original HTML content
            job_id: Job ID
            tenant_id: Tenant ID
            api_url: Optional API base URL override
            
        Returns:
            HTML content with recording script injected
        """
        recording_script = self.generate_recording_script(job_id, tenant_id, api_url=api_url)
        
        if not recording_script:
            return html_content
        
        # Try to inject before </body> tag, after tracking script if possible
        if '</body>' in html_content.lower():
            # Case-insensitive replacement
            import re
            html_content = re.sub(
                r'</body>',
                recording_script + '\n</body>',
                html_content,
                flags=re.IGNORECASE
            )
        else:
            # No body tag, append to end
            html_content += '\n' + recording_script
        
        logger.info("[RecordingScriptGenerator] Recording script injected into HTML", extra={
            'job_id': job_id,
            'tenant_id': tenant_id
        })
        
        return html_content
