'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth/context'
import toast from 'react-hot-toast'

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
          toast.success('File uploaded')
        } catch (error) {
          console.error('Error uploading file:', error)
          toast.error('Failed to upload file')
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
    } catch (error) {
      console.error('Error searching files:', error)
      toast.error('Failed to search files')
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

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return
    }

    try {
      await api.delete(`/files/${fileId}`)
      await loadFiles()
      if (selectedFile?.file_id === fileId) {
        setSelectedFile(null)
        setDownloadUrl(null)
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      toast.error('Failed to delete file')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Files</h1>
        <p className="text-gray-600">Upload and manage your customer files</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Upload File</h2>
        <div className="flex items-center gap-4">
          <label className="cursor-pointer">
            <span className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              {isUploading ? 'Uploading...' : 'Choose File'}
            </span>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
          <span className="text-sm text-gray-500">Max file size: 10MB</span>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Search Files</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search files by content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Search Results</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{searchResults.response}</p>
            <p className="text-sm text-gray-500 mt-2">
              Searched {searchResults.filesSearched} file(s)
            </p>
          </div>
        )}
      </div>

      {/* Files List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Your Files ({files.length})</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No files uploaded yet. Upload your first file above.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {files.map((file) => (
              <div
                key={file.file_id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleFileClick(file)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{file.original_filename}</h3>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                      <span>{file.file_type}</span>
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>{new Date(file.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(file.file_id)
                    }}
                    className="ml-4 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {selectedFile && downloadUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selectedFile.original_filename}</h3>
              <button
                onClick={() => {
                  setSelectedFile(null)
                  setDownloadUrl(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Download File
                </a>
              </div>
              <div className="text-sm text-gray-600">
                <p>Type: {selectedFile.file_type}</p>
                <p>Size: {formatFileSize(selectedFile.file_size)}</p>
                <p>Uploaded: {new Date(selectedFile.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

