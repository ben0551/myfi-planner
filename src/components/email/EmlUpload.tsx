'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/Button'
import type { ParsedTransaction } from '@/lib/email/types'

interface EmlUploadProps {
  onParsed: (result: ParsedTransaction, rawText: string) => void
}

export function EmlUpload({ onParsed }: EmlUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file) return
      setFileName(file.name)
      setError('')
      setLoading(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/email/upload', { method: 'POST', body: fd })
        const data = await res.json()
        onParsed(data, `Uploaded: ${file.name}`)
      } catch {
        setError('Failed to parse .eml file')
      } finally {
        setLoading(false)
      }
    },
    [onParsed]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'message/rfc822': ['.eml'] },
    maxFiles: 1,
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive
          ? 'border-indigo-400 bg-indigo-50'
          : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
      }`}
    >
      <input {...getInputProps()} />
      {loading ? (
        <p className="text-sm text-gray-600 animate-pulse">Parsing…</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            {isDragActive
              ? 'Drop the .eml file here'
              : fileName
              ? `File: ${fileName} — drop another or click`
              : 'Drag & drop a .eml file here, or click to select'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Save the email as .eml from your email client
          </p>
        </>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}
