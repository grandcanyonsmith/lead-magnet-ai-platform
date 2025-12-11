"""
Tracking Script Generator
Generates JavaScript tracking code to inject into HTML lead magnets.
"""

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
    
    def _escape_js_string(self, value: str) -> str:
        """
        Escape a string for safe use in JavaScript string literals.
        Escapes quotes, backslashes, newlines, and other special characters.
        
        Args:
            value: String to escape
            
        Returns:
            Escaped string safe for JavaScript
        """
        if not value:
            return ''
        
        # Replace backslashes first (before other replacements)
        value = value.replace('\\', '\\\\')
        # Replace single quotes
        value = value.replace("'", "\\'")
        # Replace double quotes
        value = value.replace('"', '\\"')
        # Replace newlines
        value = value.replace('\n', '\\n')
        # Replace carriage returns
        value = value.replace('\r', '\\r')
        # Replace tabs
        value = value.replace('\t', '\\t')
        # Replace backticks (for template literals)
        value = value.replace('`', '\\`')
        # Replace forward slashes (less critical but good practice)
        value = value.replace('/', '\\/')
        
        return value
    
    def generate_tracking_script(self, job_id: str, tenant_id: str) -> str:
        """
        Generate JavaScript tracking code to inject into HTML.
        
        Args:
            job_id: Job ID for the lead magnet
            tenant_id: Tenant ID
            
        Returns:
            JavaScript code as string
        """
        if not self.api_url:
            logger.warning("[TrackingScriptGenerator] API_URL not set, tracking script will not work")
            return ""
        
        # Escape values to prevent XSS
        escaped_job_id = self._escape_js_string(job_id)
        escaped_tenant_id = self._escape_js_string(tenant_id)
        escaped_api_url = self._escape_js_string(self.api_url.rstrip("/"))
        
        # Generate tracking script
        script = f"""
<!-- Lead Magnet Tracking Script -->
<script>
(function() {{
    'use strict';
    
    // Configuration
    const TRACKING_CONFIG = {{
        jobId: '{escaped_job_id}',
        tenantId: '{escaped_tenant_id}',
        apiUrl: '{escaped_api_url}',
        heartbeatInterval: 30000, // 30 seconds
        sessionTimeout: 1800000, // 30 minutes
    }};
    
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
        
        // Use sendBeacon for better reliability on page unload
        if (synchronous && navigator.sendBeacon) {{
            const blob = new Blob([JSON.stringify(eventData)], {{ type: 'application/json' }});
            navigator.sendBeacon(TRACKING_CONFIG.apiUrl + '/v1/tracking/event', blob);
        }} else {{
            // Use fetch for normal events
            fetch(TRACKING_CONFIG.apiUrl + '/v1/tracking/event', {{
                method: 'POST',
                headers: {{
                    'Content-Type': 'application/json',
                }},
                body: JSON.stringify(eventData),
                keepalive: true // Keep request alive even if page unloads
            }}).catch(function(error) {{
                // Silently fail - don't break the page if tracking fails
                console.debug('Tracking error:', error);
            }});
        }}
    }}
}})();
</script>
"""
        return script.strip()
    
    def inject_tracking_script(self, html_content: str, job_id: str, tenant_id: str) -> str:
        """
        Inject tracking script into HTML content.
        
        Args:
            html_content: Original HTML content
            job_id: Job ID
            tenant_id: Tenant ID
            
        Returns:
            HTML content with tracking script injected
        """
        tracking_script = self.generate_tracking_script(job_id, tenant_id)
        
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