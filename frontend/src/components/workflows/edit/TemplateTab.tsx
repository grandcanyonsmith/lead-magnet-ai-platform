'use client'

import { useEffect, useRef, useState } from 'react'
import { FiSave, FiEye, FiCode, FiCopy, FiMonitor, FiTablet, FiSmartphone, FiZap, FiRotateCcw, FiRotateCw, FiClock, FiChevronDown } from 'react-icons/fi'
import { TemplateData } from '@/hooks/useTemplateEdit'
import { extractPlaceholders, formatHTML, getPreviewHtml, getDevicePreviewWidth } from '@/utils/templateUtils'

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
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  history?: Array<{ label: string; timestamp: number }>
  historyIndex?: number
  onJumpToHistory?: (index: number) => void
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
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  history = [],
  historyIndex = -1,
  onJumpToHistory,
}: TemplateTabProps) {
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false)
  const historyDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(event.target as Node)) {
        setShowHistoryDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+Z (Mac) or Ctrl+Z (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          // Redo: Cmd+Shift+Z
          if (canRedo && onRedo) onRedo()
        } else {
          // Undo: Cmd+Z
          if (canUndo && onUndo) onUndo()
        }
      }
      // Check for Ctrl+Y (Windows Redo standard)
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault()
        if (canRedo && onRedo) onRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canUndo, canRedo, onUndo, onRedo])

  const handleRefine = async () => {
    const result = await onRefine()
    if (result.error) {
      // Error handling would be done by parent
      return
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
                {/* Undo/Redo Controls */}
                {(onUndo || onRedo) && (
                  <div className="flex items-center bg-gray-100 rounded-lg p-1 mr-2 relative">
                    <button
                      type="button"
                      onClick={onUndo}
                      disabled={!canUndo}
                      className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Undo (Cmd+Z)"
                    >
                      <FiRotateCcw className="w-4 h-4" />
                    </button>
                    
                    {/* History Dropdown Trigger */}
                    <div className="relative" ref={historyDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                        disabled={history.length === 0}
                        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-xs font-medium"
                        title="Version History"
                      >
                        <FiClock className="w-3.5 h-3.5" />
                        <FiChevronDown className="w-3 h-3" />
                      </button>

                      {/* History Dropdown Menu */}
                      {showHistoryDropdown && history.length > 0 && onJumpToHistory && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-80 overflow-y-auto">
                          <div className="p-2 text-xs font-semibold text-gray-500 border-b border-gray-100 uppercase tracking-wider">
                            Version History
                          </div>
                          <div className="py-1">
                            {[...history].reverse().map((item, reverseIndex) => {
                              const actualIndex = history.length - 1 - reverseIndex;
                              const isCurrent = actualIndex === historyIndex;
                              return (
                                <button
                                  key={actualIndex}
                                  type="button"
                                  onClick={() => {
                                    onJumpToHistory(actualIndex);
                                    setShowHistoryDropdown(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                                    isCurrent ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'
                                  }`}
                                >
                                  <span className="truncate mr-2" title={item.label}>{item.label}</span>
                                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(item.timestamp)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={onRedo}
                      disabled={!canRedo}
                      className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Redo (Cmd+Shift+Z)"
                    >
                      <FiRotateCw className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                <div className="h-6 w-px bg-gray-300 mx-2 hidden sm:block"></div>

                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => onViewModeChange('split')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                      templateViewMode === 'split'
                        ? 'bg-white text-primary-600 shadow-sm font-medium'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Split
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewModeChange('editor')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                      templateViewMode === 'editor'
                        ? 'bg-white text-primary-600 shadow-sm font-medium'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewModeChange('preview')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                      templateViewMode === 'preview'
                        ? 'bg-white text-primary-600 shadow-sm font-medium'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Split View: Editor and Preview */}
          <div className={`grid gap-6 ${templateViewMode === 'split' && templateData.html_content.trim() ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
            {/* HTML Editor */}
            {(templateViewMode === 'split' || templateViewMode === 'editor') && (
              <div className="bg-white rounded-lg shadow flex flex-col h-[600px]">
                <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50 rounded-t-lg">
                  <div className="flex items-center space-x-3">
                    <FiCode className="w-5 h-5 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">HTML Editor</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={onFormatHtml}
                      className="text-xs px-2 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded text-gray-700 transition-colors shadow-sm"
                      title="Format HTML"
                    >
                      Format Code
                    </button>
                  </div>
                </div>
                <div className="relative flex-1 flex overflow-hidden">
                  <div className="w-10 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-2 text-xs text-gray-400 font-mono select-none overflow-hidden">
                    {/* Line numbers would go here, but sync scrolling is hard with just textarea. 
                        Simplified: Just basic line count or better nothing than broken sync. 
                        Let's keep it simple for now or improve it. */}
                     <div className="w-full text-right pr-2">
                        {templateData.html_content.split('\n').map((_, i) => (
                          <div key={i} className="leading-6 h-6">{i + 1}</div>
                        ))}
                     </div>
                  </div>
                  <textarea
                    value={templateData.html_content}
                    onChange={(e) => onHtmlChange(e.target.value)}
                    className="flex-1 px-3 py-2 border-0 focus:outline-none focus:ring-0 font-mono text-sm leading-6 resize-none w-full h-full"
                    placeholder="Enter your HTML here..."
                    spellCheck={false}
                    style={{ whiteSpace: 'pre' }}
                  />
                </div>
                <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 rounded-b-lg">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-600 font-medium">Insert Placeholder:</span>
                      {detectedPlaceholders.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {detectedPlaceholders.map((placeholder) => (
                            <button
                              key={placeholder}
                              type="button"
                              onClick={() => onInsertPlaceholder(placeholder)}
                              className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-mono hover:bg-blue-100 transition-colors flex items-center"
                              title={`Insert {{${placeholder}}}`}
                            >
                              {placeholder}
                              <FiCopy className="w-3 h-3 ml-1 opacity-50" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">None detected in template</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Panel */}
            {(templateViewMode === 'split' || templateViewMode === 'preview') && templateData.html_content.trim() && (
              <div className="bg-white rounded-lg shadow flex flex-col h-[600px]">
                <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50 rounded-t-lg">
                  <div className="flex items-center space-x-3">
                    <FiEye className="w-5 h-5 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
                  </div>
                  <div className="flex items-center bg-white rounded-md border border-gray-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => onDeviceSizeChange('mobile')}
                      className={`p-1.5 rounded transition-colors ${
                        devicePreviewSize === 'mobile'
                          ? 'bg-gray-100 text-primary-600'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                      title="Mobile (375px)"
                    >
                      <FiSmartphone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeviceSizeChange('tablet')}
                      className={`p-1.5 rounded transition-colors ${
                        devicePreviewSize === 'tablet'
                          ? 'bg-gray-100 text-primary-600'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                      title="Tablet (768px)"
                    >
                      <FiTablet className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeviceSizeChange('desktop')}
                      className={`p-1.5 rounded transition-colors ${
                        devicePreviewSize === 'desktop'
                          ? 'bg-gray-100 text-primary-600'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                      title="Desktop (Full Width)"
                    >
                      <FiMonitor className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="bg-gray-100 p-4 flex justify-center flex-1 overflow-auto rounded-b-lg">
                  <div
                    className="bg-white border border-gray-300 shadow-lg transition-all duration-300 ease-in-out"
                    style={{
                      width: getDevicePreviewWidth(devicePreviewSize),
                      maxWidth: '100%',
                      height: '100%',
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
            <div className="bg-white rounded-lg shadow border border-indigo-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50">
                <div className="flex items-center space-x-2">
                  <FiZap className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-indigo-900">AI Refine</h3>
                  <span className="text-xs text-indigo-500 font-medium px-2 py-0.5 bg-white rounded-full border border-indigo-100">Optional</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => onEditPromptChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm transition-shadow shadow-sm"
                    placeholder="Describe changes (e.g., 'Make the header blue', 'Add a footer', 'Make text larger')..."
                    rows={2}
                    disabled={refining}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500 font-medium py-1">Try:</span>
                    {['Make colors more vibrant', 'Modernize the layout', 'Add more spacing', 'Improve typography'].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => onEditPromptChange(suggestion)}
                        className="text-xs px-2.5 py-1 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 rounded-full text-gray-600 transition-colors shadow-sm"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
                
                {generationStatus && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center animate-pulse">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-3"></div>
                    <span className="text-sm text-indigo-800 font-medium">{generationStatus}</span>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={handleRefine}
                  disabled={refining || !editPrompt.trim()}
                  className="w-full flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm hover:shadow"
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
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={templateData.is_published}
                  onChange={(e) => onTemplateChange('is_published', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-900">Publish Template</span>
            </label>
            <p className="mt-1 text-sm text-gray-500 ml-14">
              Published templates can be used in workflows immediately
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4 sticky bottom-0 bg-gray-50 p-4 border-t border-gray-200 -mx-4 -mb-6 sm:static sm:bg-transparent sm:p-0 sm:border-0 sm:mx-0 sm:mb-0 z-10">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-white hover:shadow-sm transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !templateData.html_content.trim()}
              className="flex items-center justify-center px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg font-medium"
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
