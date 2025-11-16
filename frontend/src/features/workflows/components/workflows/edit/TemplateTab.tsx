'use client'

import { FiSave, FiEye, FiCode, FiCopy, FiMonitor, FiTablet, FiSmartphone, FiZap } from 'react-icons/fi'
import { TemplateData } from '@/features/templates/hooks/useTemplateEdit'
import { extractPlaceholders, formatHTML, getPreviewHtml, getDevicePreviewWidth } from '@/features/templates/utils/templateUtils'

interface TemplateTabProps {
  templateData: TemplateData
  templateLoading: boolean
  detectedPlaceholders: string[]
  templateViewMode: 'split' | 'editor' | 'preview'
  devicePreviewSize: 'mobile' | 'tablet' | 'desktop'
  previewKey: number
  refining: boolean
  generationStatus: string | null
  editPrompt: string
  onTemplateChange: (field: string, value: any) => void
  onHtmlChange: (html: string) => void
  onViewModeChange: (mode: 'split' | 'editor' | 'preview') => void
  onDeviceSizeChange: (size: 'mobile' | 'tablet' | 'desktop') => void
  onInsertPlaceholder: (placeholder: string) => void
  onRefine: () => Promise<{ error?: string; success?: boolean }>
  onEditPromptChange: (prompt: string) => void
  onFormatHtml: () => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  submitting: boolean
}

export function TemplateTab({
  templateData,
  templateLoading,
  detectedPlaceholders,
  templateViewMode,
  devicePreviewSize,
  previewKey,
  refining,
  generationStatus,
  editPrompt,
  onTemplateChange,
  onHtmlChange,
  onViewModeChange,
  onDeviceSizeChange,
  onInsertPlaceholder,
  onRefine,
  onEditPromptChange,
  onFormatHtml,
  onSubmit,
  onCancel,
  submitting,
}: TemplateTabProps) {
  const handleRefine = async () => {
    const result = await onRefine()
    if (result.error) {
      // Error handling would be done by parent
      return
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">

      {templateLoading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600">Loading template...</p>
        </div>
      )}

      {!templateLoading && (
        <>
          {/* Template Metadata */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={templateData.template_name}
                onChange={(e) => onTemplateChange('template_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Email Template"
                maxLength={200}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={templateData.template_description}
                onChange={(e) => onTemplateChange('template_description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe what this template is used for..."
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>

          {/* View Mode Toggle */}
          {templateData.html_content.trim() && (
            <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FiEye className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">View Mode</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => onViewModeChange('split')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    templateViewMode === 'split'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Split
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange('editor')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    templateViewMode === 'editor'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange('preview')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    templateViewMode === 'preview'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>
          )}

          {/* Split View: Editor and Preview */}
          <div className={`grid gap-6 ${templateViewMode === 'split' && templateData.html_content.trim() ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
            {/* HTML Editor */}
            {(templateViewMode === 'split' || templateViewMode === 'editor') && (
              <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <FiCode className="w-5 h-5 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">HTML Editor</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={onFormatHtml}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
                      title="Format HTML"
                    >
                      Format
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-2 text-xs text-gray-400 font-mono">
                    {templateData.html_content.split('\n').map((_, i) => (
                      <div key={i} className="leading-6">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={templateData.html_content}
                    onChange={(e) => onHtmlChange(e.target.value)}
                    className="w-full px-3 py-2 pl-12 border-0 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm leading-6 resize-none"
                    placeholder={`<!DOCTYPE html>
<html>
<head>
  <title>Lead Magnet</title>
</head>
<body>
  <h1>{{TITLE}}</h1>
  <div>{{CONTENT}}</div>
</body>
</html>`}
                    rows={20}
                    required
                    style={{ minHeight: '500px' }}
                  />
                </div>
                <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-600">Placeholders:</span>
                      {detectedPlaceholders.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {detectedPlaceholders.map((placeholder) => (
                            <button
                              key={placeholder}
                              type="button"
                              onClick={() => onInsertPlaceholder(placeholder)}
                              className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-mono hover:bg-primary-200 transition-colors flex items-center"
                              title={`Insert {{${placeholder}}}`}
                            >
                              {`{{${placeholder}}}`}
                              <FiCopy className="w-3 h-3 ml-1" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-yellow-600">None detected</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Use <code className="px-1 py-0.5 bg-gray-200 rounded">&#123;&#123;NAME&#125;&#125;</code> for placeholders
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Panel */}
            {(templateViewMode === 'split' || templateViewMode === 'preview') && templateData.html_content.trim() && (
              <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <FiEye className="w-5 h-5 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => onDeviceSizeChange('mobile')}
                      className={`p-2 rounded transition-colors touch-target ${
                        devicePreviewSize === 'mobile'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Mobile (375px)"
                    >
                      <FiSmartphone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeviceSizeChange('tablet')}
                      className={`p-2 rounded transition-colors touch-target ${
                        devicePreviewSize === 'tablet'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Tablet (768px)"
                    >
                      <FiTablet className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeviceSizeChange('desktop')}
                      className={`p-2 rounded transition-colors touch-target ${
                        devicePreviewSize === 'desktop'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Desktop (Full Width)"
                    >
                      <FiMonitor className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="bg-gray-100 p-4 flex justify-center" style={{ minHeight: '500px' }}>
                  <div
                    className="bg-white border border-gray-300 rounded-lg shadow-lg overflow-auto"
                    style={{
                      width: getDevicePreviewWidth(devicePreviewSize),
                      maxWidth: '100%',
                      height: devicePreviewSize === 'desktop' ? '600px' : '800px',
                    }}
                  >
                    <iframe
                      key={`preview-${previewKey}-${templateData.html_content.length}-${devicePreviewSize}`}
                      srcDoc={getPreviewHtml(templateData.html_content)}
                      className="w-full h-full border-0"
                      title="HTML Preview"
                      sandbox="allow-same-origin allow-scripts"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Refine Section */}
          {templateData.html_content.trim() && (
            <div className="bg-white rounded-lg shadow border border-green-200">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-green-50 to-teal-50">
                <div className="flex items-center space-x-2">
                  <FiZap className="w-5 h-5 text-green-600" />
                  <h3 className="text-sm font-semibold text-gray-900">AI Refine</h3>
                  <span className="text-xs text-gray-500">(Optional)</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => onEditPromptChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    placeholder="e.g., Make colors more vibrant, modernize layout, add spacing..."
                    rows={3}
                    disabled={refining}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-xs text-gray-500">Suggestions:</span>
                    {['Make colors more vibrant', 'Modernize the layout', 'Add more spacing', 'Improve typography'].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => onEditPromptChange(suggestion)}
                        className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
                
                {generationStatus && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-2"></div>
                    <span className="text-xs text-green-800 font-medium">{generationStatus}</span>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={handleRefine}
                  disabled={refining || !editPrompt.trim()}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {refining ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      <span>Refining...</span>
                    </>
                  ) : (
                    <>
                      <FiZap className="w-4 h-4 mr-2" />
                      <span>Apply Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Publish Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={templateData.is_published}
                onChange={(e) => onTemplateChange('is_published', e.target.checked)}
                className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Publish Template</span>
            </label>
            <p className="mt-1 text-sm text-gray-500 ml-6">
              Published templates can be used in workflows immediately
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors touch-target"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !templateData.html_content.trim()}
              className="flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
            >
              <FiSave className="w-5 h-5 mr-2" />
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </>
      )}
    </form>
  )
}

