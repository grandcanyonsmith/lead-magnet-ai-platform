'use client'

import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { api } from '@/shared/lib/api'
import { useAuth } from '@/features/auth/lib/auth/context'
import { FiX } from 'react-icons/fi'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'

interface File {
  file_id: string
  original_filename: string
  file_type: string
  file_size: number
  content_type: string
  created_at: string
}

interface FileListResponse {
  files: File[]
  count: number
}

interface FileSearchResponse {
  response: string
  fileIds: string[]
  filesSearched: number
}

export default function FilesPage() {
  const { customerId } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileSearchResponse | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<File | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    setIsLoading(true)
    try {
      const response = await api.get<FileListResponse>('/files')
      setFiles(response.files)
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      // Read file as base64
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(',')[1] // Remove data:type;base64, prefix
          
          await api.post('/files', {
            file: base64,
            filename: file.name,
            contentType: file.type,
            fileType: 'document', // Can be made configurable
            category: 'uploads',
          })

          await loadFiles()
          setErrorMessage(null)
          setNotice('File uploaded successfully.')
        } catch (error) {
          console.error('Error uploading file:', error)
          setErrorMessage('Failed to upload file. Please try again.')
          setNotice(null)
        } finally {
          setIsUploading(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error reading file:', error)
      setIsUploading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    setIsSearching(true)
    try {
      const response = await api.post<FileSearchResponse>('/files/search', {
        query: searchQuery,
      })
      setSearchResults(response)
      setErrorMessage(null)
    } catch (error) {
      console.error('Error searching files:', error)
      setErrorMessage('Failed to search files. Please try again.')
      setNotice(null)
    } finally {
      setIsSearching(false)
    }
  }

  const handleFileClick = async (file: File) => {
    setSelectedFile(file)
    try {
      const response = await api.get<{ download_url: string }>(`/files/${file.file_id}`)
      setDownloadUrl(response.download_url)
    } catch (error) {
      console.error('Error getting file URL:', error)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      await api.delete(`/files/${deleteTarget.file_id}`)
      await loadFiles()
      if (selectedFile?.file_id === deleteTarget.file_id) {
        setSelectedFile(null)
        setDownloadUrl(null)
      }
      setNotice('File deleted.')
      setErrorMessage(null)
    } catch (error) {
      console.error('Error deleting file:', error)
      setErrorMessage('Failed to delete file. Please try again.')
      setNotice(null)
    }
    setIsDeleting(false)
    setDeleteTarget(null)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-2">Files</h1>
        <p className="text-ink-600">Upload and manage your customer files</p>
      </div>

      {(notice || errorMessage) && (
        <div className="space-y-3 mb-4">
          {errorMessage && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl px-4 py-3">
              {errorMessage}
            </div>
          )}
          {notice && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl px-4 py-3">
              {notice}
            </div>
          )}
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-ink-900">Upload File</h2>
        <div className="flex items-center gap-4">
          <label className="cursor-pointer">
            <span className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-colors shadow-soft">
              {isUploading ? 'Uploading...' : 'Choose File'}
            </span>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
          <span className="text-sm text-ink-500">Max file size: 10MB</span>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-ink-900">Search Files</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search files by content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 border border-white/60 rounded-2xl bg-white/90 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-soft"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-6 py-2 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-soft"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults && (
          <div className="mt-4 p-4 bg-white/80 rounded-2xl border border-white/60">
            <h3 className="font-semibold mb-2 text-ink-900">Search Results</h3>
            <p className="text-ink-700 whitespace-pre-wrap">{searchResults.response}</p>
            <p className="text-sm text-ink-500 mt-2">
              Searched {searchResults.filesSearched} file(s)
            </p>
          </div>
        )}
      </div>

      {/* Files List */}
      <div className="bg-white rounded-2xl shadow-soft border border-white/60">
        <div className="p-6 border-b border-white/60">
          <h2 className="text-lg font-semibold text-ink-900">Your Files ({files.length})</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-ink-500">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-ink-500">
            No files uploaded yet. Upload your first file above.
          </div>
        ) : (
          <div className="divide-y divide-white/60">
            {files.map((file) => (
              <div
                key={file.file_id}
                className="p-4 hover:bg-white/80 cursor-pointer"
                onClick={() => handleFileClick(file)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-ink-900">{file.original_filename}</h3>
                    <div className="mt-1 flex items-center gap-4 text-sm text-ink-500">
                      <span>{file.file_type}</span>
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>{new Date(file.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(file)
                    }}
                    className="ml-4 px-3 py-1 text-sm text-red-600 hover:bg-red-50/60 rounded-2xl"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Preview Modal with Headless UI */}
      <Transition appear show={!!selectedFile && !!downloadUrl} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {
          setSelectedFile(null)
          setDownloadUrl(null)
        }}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-soft border border-white/60 transition-all">
                  {selectedFile && (
                    <>
                      <div className="p-6 border-b border-white/60 flex items-center justify-between">
                        <Dialog.Title as="h3" className="text-lg font-semibold text-ink-900">
                          {selectedFile.original_filename}
                        </Dialog.Title>
                        <button
                          onClick={() => {
                            setSelectedFile(null)
                            setDownloadUrl(null)
                          }}
                          className="text-ink-500 hover:text-ink-700 rounded-2xl p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <FiX className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="p-6">
                        <div className="mb-4">
                          <a
                            href={downloadUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 shadow-soft transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                          >
                            Download File
                          </a>
                        </div>
                        <div className="text-sm text-ink-600 space-y-1">
                          <p>Type: {selectedFile.file_type}</p>
                          <p>Size: {formatFileSize(selectedFile.file_size)}</p>
                          <p>Uploaded: {new Date(selectedFile.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete file?"
        description={
          deleteTarget ? (
            <span>
              This will permanently remove <span className="font-semibold">{deleteTarget.original_filename}</span>.
            </span>
          ) : (
            'This action cannot be undone.'
          )
        }
        confirmLabel="Delete"
        tone="danger"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
