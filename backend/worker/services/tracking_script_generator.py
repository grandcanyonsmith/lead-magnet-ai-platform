"""
Tracking Script Generator
Generates JavaScript tracking code to inject into HTML lead magnets.
"""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


class TrackingScriptGenerator:
    """Generates JavaScript tracking code for lead magnets."""
    
    def __init__(self):
        """Initialize tracking script generator."""
        # Get API URL from environment
        self.api_url = os.environ.get('API_URL') or os.environ.get('API_GATEWAY_URL') or ''
    
    def generate_tracking_script(self, job_id: str, tenant_id: str, api_url: Optional[str] = None) -> str:
        """
        Generate JavaScript tracking code to inject into HTML.
        
        Args:
            job_id: Job ID for the lead magnet
            tenant_id: Tenant ID
            api_url: Optional API base URL override (preferred). Falls back to env/API_URL.
            
        Returns:
            JavaScript code as string
        """
        effective_api_url = (api_url or self.api_url or '').strip()

        if not effective_api_url:
            # We can still inject a script that tries same-origin (/v1/tracking/event).
            # This will work when the HTML is served from the API domain (e.g. /v1/jobs/:jobId/document),
            # and safely no-op when served from a static CDN domain without the API.
            logger.warning("[TrackingScriptGenerator] API_URL not set; tracking will fall back to same-origin")
        
        # Escape values to prevent XSS using json.dumps(), which handles
        # quotes, backslashes, newlines, tabs, unicode, etc.
        escaped_job_id = json.dumps(job_id)
        escaped_tenant_id = json.dumps(tenant_id)
        escaped_api_url = json.dumps(effective_api_url.rstrip("/"))
        
        # Generate tracking script
        script = f"""
<!-- Lead Magnet Tracking Script -->
<script>
(function() {{
    'use strict';
    
    // Configuration
    const TRACKING_CONFIG = {{
        jobId: {escaped_job_id},
        tenantId: {escaped_tenant_id},
        apiUrl: {escaped_api_url},
        heartbeatInterval: 30000, // 30 seconds
        sessionTimeout: 1800000, // 30 minutes
    }};

    function getTrackingEndpoint() {{
        const base = (TRACKING_CONFIG.apiUrl || window.location.origin || '').replace(/\\/+$/, '');
        if (!base || base === 'null') {{
            return '';
        }}
        return base + '/v1/tracking/event';
    }}
    
    // Session management
    let sessionId = localStorage.getItem('lm_session_id');
    let sessionStartTime = localStorage.getItem('lm_session_start');
    let lastActivityTime = Date.now();
    let heartbeatIntervalId = null;
    let pageViewCount = 0;
    
    // Generate new session if needed
    if (!sessionId || !sessionStartTime) {{
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        sessionStartTime = new Date().toISOString();
        localStorage.setItem('lm_session_id', sessionId);
        localStorage.setItem('lm_session_start', sessionStartTime);
        
        // Send session start event
        sendEvent('session_start', {{
            session_start_time: sessionStartTime
        }});
    }}
    
    // Track page view on load
    if (document.readyState === 'loading') {{
        document.addEventListener('DOMContentLoaded', trackPageView);
    }} else {{
        trackPageView();
    }}
    
    // Track clicks on links and buttons
    document.addEventListener('click', function(e) {{
        const target = e.target;
        const tagName = target.tagName.toLowerCase();
        
        if (tagName === 'a' || tagName === 'button' || target.closest('a') || target.closest('button')) {{
            const link = target.closest('a') || target;
            const href = link.href || link.getAttribute('href') || '';
            const text = link.textContent?.trim() || '';
            
            sendEvent('click', {{
                page_url: window.location.href,
                click_target: href || text.substring(0, 100)
            }});
        }}
    }}, true);
    
    // Track page visibility changes (tab switch, minimize)
    document.addEventListener('visibilitychange', function() {{
        if (document.hidden) {{
            // Page hidden - pause tracking
            if (heartbeatIntervalId) {{
                clearInterval(heartbeatIntervalId);
                heartbeatIntervalId = null;
            }}
        }} else {{
            // Page visible - resume tracking
            lastActivityTime = Date.now();
            startHeartbeat();
        }}
    }});
    
    // Track before page unload
    window.addEventListener('beforeunload', function() {{
        const sessionDuration = Math.floor((Date.now() - new Date(sessionStartTime).getTime()) / 1000);
        
        sendEvent('session_end', {{
            session_duration_seconds: sessionDuration,
            page_url: window.location.href
        }}, true); // Synchronous for reliability
    }});
    
    // Start heartbeat to track session duration
    startHeartbeat();
    
    function trackPageView() {{
        pageViewCount++;
        sendEvent('page_view', {{
            page_url: window.location.href,
            page_title: document.title || ''
        }});
    }}
    
    function startHeartbeat() {{
        if (heartbeatIntervalId) {{
            clearInterval(heartbeatIntervalId);
        }}
        
        heartbeatIntervalId = setInterval(function() {{
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivityTime;
            
            // If inactive for too long, end session
            if (timeSinceLastActivity > TRACKING_CONFIG.sessionTimeout) {{
                const sessionDuration = Math.floor((now - new Date(sessionStartTime).getTime()) / 1000);
                sendEvent('session_end', {{
                    session_duration_seconds: sessionDuration
                }});
                
                // Start new session
                sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                sessionStartTime = new Date().toISOString();
                localStorage.setItem('lm_session_id', sessionId);
                localStorage.setItem('lm_session_start', sessionStartTime);
                
                sendEvent('session_start', {{
                    session_start_time: sessionStartTime
                }});
            }} else {{
                // Send heartbeat
                const sessionDuration = Math.floor((now - new Date(sessionStartTime).getTime()) / 1000);
                sendEvent('heartbeat', {{
                    session_duration_seconds: sessionDuration,
                    page_url: window.location.href
                }});
            }}
        }}, TRACKING_CONFIG.heartbeatInterval);
    }}
    
    // Update last activity time on user interaction
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(function(event) {{
        document.addEventListener(event, function() {{
            lastActivityTime = Date.now();
        }}, {{ passive: true }});
    }});
    
    function sendEvent(eventType, additionalData, synchronous) {{
        const endpoint = getTrackingEndpoint();
        if (!endpoint) {{
            return;
        }}

        const eventData = {{
            job_id: TRACKING_CONFIG.jobId,
            event_type: eventType,
            session_id: sessionId,
            session_start_time: sessionStartTime,
            page_url: window.location.href,
            page_title: document.title || '',
            user_agent: navigator.userAgent,
            referrer: document.referrer || '',
            ...additionalData
        }};

        const body = JSON.stringify(eventData);

        // Prefer sendBeacon (no CORS preflight) especially for unload events.
        if (navigator.sendBeacon) {{
            try {{
                // Sending a string uses text/plain; charset=UTF-8 (simple request, avoids preflight).
                const ok = navigator.sendBeacon(endpoint, body);
                if (ok) {{
                    return;
                }}
            }} catch (_e) {{
                // fall through
            }}
        }}

        // Fallback: fire-and-forget fetch without CORS preflight.
        try {{
            fetch(endpoint, {{
                method: 'POST',
                body,
                // `no-cors` ensures the browser will send the request even if the endpoint
                // is on a different domain and doesn't return CORS headers.
                mode: 'no-cors',
                keepalive: true,
            }}).catch(function() {{}});
        }} catch (_e) {{
            // swallow
        }}
    }}
}})();
</script>
"""
        return script.strip()
    
    def inject_tracking_script(self, html_content: str, job_id: str, tenant_id: str, api_url: Optional[str] = None) -> str:
        """
        Inject tracking script into HTML content.
        
        Args:
            html_content: Original HTML content
            job_id: Job ID
            tenant_id: Tenant ID
            api_url: Optional API base URL override (preferred). Falls back to env/API_URL.
            
        Returns:
            HTML content with tracking script injected
        """
        tracking_script = self.generate_tracking_script(job_id, tenant_id, api_url=api_url)
        
        if not tracking_script:
            logger.warning("[TrackingScriptGenerator] No tracking script generated, returning original HTML")
            return html_content
        
        # Try to inject before </body> tag
        if '</body>' in html_content.lower():
            # Case-insensitive replacement
            import re
            html_content = re.sub(
                r'</body>',
                tracking_script + '\n</body>',
                html_content,
                flags=re.IGNORECASE
            )
        else:
            # No body tag, append to end
            html_content += '\n' + tracking_script
        
        logger.info("[TrackingScriptGenerator] Tracking script injected into HTML", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'script_length': len(tracking_script)
        })
        
        return html_content