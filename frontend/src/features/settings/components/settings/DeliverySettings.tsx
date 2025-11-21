/**
 * Delivery settings form section
 */

'use client'

import { useState } from 'react'
import { Settings } from '@/shared/types'
import { FormField } from './FormField'
import { FiCopy, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import { useRegenerateWebhookToken } from '@/features/settings/hooks/useSettings'
import { WebhookTester } from './WebhookTester'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'

interface DeliverySettingsProps {
  settings: Settings
  onChange: (field: keyof Settings, value: string) => void
  onSettingsUpdate: (updatedSettings: Settings) => void
  errors?: Record<string, string>
}

export function DeliverySettings({
  settings,
  onChange,
  onSettingsUpdate,
  errors,
}: DeliverySettingsProps) {
  const { regenerateToken, loading: isRegenerating } = useRegenerateWebhookToken()
  const [showConfirm, setShowConfirm] = useState(false)

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
    const updatedSettings = await regenerateToken()
    if (updatedSettings) {
      onSettingsUpdate(updatedSettings)
    }
    setShowConfirm(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-ink-900 mb-2">Delivery Settings</h3>
        <p className="text-sm text-ink-600 mb-4">
          Configure webhook endpoints and delivery preferences for your lead magnets.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <FormField
            label={
              <>
                Your Webhook URL
                <span className="ml-2 text-xs text-ink-500" title="Public webhook endpoint for triggering workflows">
                  ℹ️
                </span>
              </>
            }
            name="webhook_url"
            type="text"
            value={settings.webhook_url || ''}
            onChange={() => {}} // Read-only
            readOnly
            helpText="Public webhook endpoint for triggering workflows. POST requests to this URL with workflow_id/workflow_name and form_data will trigger workflow execution."
            className="font-mono text-sm"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleCopyWebhookUrl}
              disabled={!settings.webhook_url}
              className="flex items-center px-4 py-2 bg-surface-100 text-ink-700 rounded-2xl hover:bg-surface-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/60 shadow-soft"
            >
              <FiCopy className="w-4 h-4 mr-2" />
              Copy
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={isRegenerating || !settings.webhook_url}
              className="flex items-center px-4 py-2 bg-amber-100 text-amber-800 rounded-2xl hover:bg-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-amber-200 shadow-soft"
            >
              <FiRefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
          </div>
          {settings.webhook_url && (
            <>
              <div className="mt-4 p-3 bg-brand-50/70 border border-brand-100 rounded-2xl">
                <p className="text-xs font-medium text-brand-900 mb-1">Example Usage:</p>
                <pre className="text-xs text-brand-800 overflow-x-auto">
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
              <WebhookTester webhookUrl={settings.webhook_url} />
            </>
          )}
        </div>

        <FormField
          label={
            <>
              GHL Webhook URL
              <span className="ml-2 text-xs text-ink-500" title="Your GoHighLevel webhook endpoint for SMS/Email delivery">
                ℹ️
              </span>
            </>
          }
          name="ghl_webhook_url"
          type="url"
          value={settings.ghl_webhook_url || ''}
          onChange={(value) => onChange('ghl_webhook_url', value)}
          error={errors?.ghl_webhook_url}
          helpText="Your GoHighLevel webhook endpoint for SMS/Email delivery"
          placeholder="https://api.gohighlevel.com/webhook/..."
        />

        <FormField
          label="Lead Phone Number Field"
          name="lead_phone_field"
          type="text"
          value={settings.lead_phone_field || ''}
          onChange={(value) => onChange('lead_phone_field', value)}
          error={errors?.lead_phone_field}
          helpText='Phone number field name from your form (e.g., "phone" or "phone_number")'
          placeholder="phone"
        />
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Regenerate webhook token?"
        description="The existing webhook URL will stop working after regeneration."
        confirmLabel="Regenerate token"
        tone="danger"
        loading={isRegenerating}
        onConfirm={handleRegenerateToken}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
