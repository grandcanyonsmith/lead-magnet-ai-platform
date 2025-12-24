/**
 * Delivery settings form section
 */

'use client'

import { Settings } from '@/types'
import { FormField } from './FormField'
import { FiCopy, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import { useRegenerateWebhookToken } from '@/hooks/api/useSettings'
import { WebhookTester } from './WebhookTester'

interface DeliverySettingsProps {
  settings: Settings
  onChange: (field: keyof Settings, value: string) => void
  onSettingsUpdate: (updatedSettings: Settings) => void
  errors?: Record<string, string>
}

import { ServerStackIcon, GlobeAltIcon, PhoneIcon } from '@heroicons/react/24/outline'

export function DeliverySettings({
  settings,
  onChange,
  onSettingsUpdate,
  errors,
}: DeliverySettingsProps) {
  const { regenerateToken, loading: isRegenerating } = useRegenerateWebhookToken()

  const handleCopyWebhookUrl = async () => {
    if (settings.webhook_url) {
      try {
        await navigator.clipboard.writeText(settings.webhook_url)
        toast.success('Webhook URL copied to clipboard!')
      } catch (error) {
        toast.error('Failed to copy to clipboard')
      }
    }
  }

  const handleRegenerateToken = async () => {
    if (
      !confirm(
        'Are you sure you want to regenerate your webhook token? The old URL will stop working.'
      )
    ) {
      return
    }

    const updatedSettings = await regenerateToken()
    if (updatedSettings) {
      onSettingsUpdate(updatedSettings)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <ServerStackIcon className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Webhook Integration</h3>
          </div>
          <p className="text-sm text-gray-600 ml-12">
            Configure webhook endpoints to receive form submissions and trigger automation.
          </p>
        </div>

        <div className="p-8 space-y-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Your Webhook URL
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyWebhookUrl}
                  disabled={!settings.webhook_url}
                  className="text-xs flex items-center px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <FiCopy className="w-3.5 h-3.5 mr-1.5" />
                  Copy URL
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateToken}
                  disabled={isRegenerating || !settings.webhook_url}
                  className="text-xs flex items-center px-3 py-1.5 bg-white border border-gray-200 text-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <FiRefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              </div>
            </div>
            
            <div className="relative">
              <input
                type="text"
                value={settings.webhook_url || ''}
                readOnly
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              POST requests to this URL with <code>workflow_id</code> and <code>form_data</code> will trigger workflow execution.
            </p>

            {settings.webhook_url && (
              <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Example Usage</span>
                </div>
                <div className="bg-gray-900 p-4 overflow-x-auto">
                  <pre className="text-xs text-blue-300 font-mono">
{`curl -X POST "${settings.webhook_url}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workflow_id": "wf_xxxxx",
    "form_data": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+14155551234"
    }
  }'`}
                  </pre>
                </div>
              </div>
            )}
            
            {settings.webhook_url && (
              <div className="mt-6">
                 <WebhookTester webhookUrl={settings.webhook_url} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <GlobeAltIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Delivery Configuration</h3>
          </div>
          <p className="text-sm text-gray-600 ml-12">
            Set up external integrations and domain settings.
          </p>
        </div>

        <div className="p-8 space-y-6">
          <FormField
            label="GHL Webhook URL"
            name="ghl_webhook_url"
            type="url"
            value={settings.ghl_webhook_url || ''}
            onChange={(value) => onChange('ghl_webhook_url', value)}
            error={errors?.ghl_webhook_url}
            helpText="Your GoHighLevel webhook endpoint for SMS/Email delivery"
            placeholder="https://api.gohighlevel.com/webhook/..."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Custom Domain"
              name="custom_domain"
              type="text"
              value={settings.custom_domain || ''}
              onChange={(value) => onChange('custom_domain', value)}
              error={errors?.custom_domain}
              placeholder="forms.yourdomain.com"
              helpText="CNAME your domain to this app to use custom links."
            />

            <FormField
              label="Lead Phone Field"
              name="lead_phone_field"
              type="text"
              value={settings.lead_phone_field || ''}
              onChange={(value) => onChange('lead_phone_field', value)}
              error={errors?.lead_phone_field}
              helpText='Field name in your form (e.g., "phone")'
              placeholder="phone"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

