'use client'

import { useEffect, useState, useRef } from 'react'
import { getTokenInfo } from '../../../lib/auth'

interface Step {
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
}

export default function RestoreImagePage() {
  const [token, setToken] = useState<string | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [steps, setSteps] = useState<Step[]>([
    { label: 'Restart DRBL server', status: 'pending' },
    { label: 'Restore disk from image', status: 'pending' },
  ])

  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const info = getTokenInfo()
    if (info) setToken(info.token)
  }, [])

  useEffect(() => {
    if (!token) return

    const fetchImages = async () => {
      try {
        const res = await fetch('/api/listClones', {
          headers: { Authorization: `${token}` },
        })
        const data = await res.json()
        if (data.images) {
          const parsed = Array.isArray(data.images)
            ? data.images
            : data.images.toString().split(',').map((s: string) => s.trim()).filter(Boolean)
          setImages(parsed)
        } else {
          setImages([])
        }
      } catch {
        setImages([])
      }
    }

    fetchImages()
    const interval = setInterval(fetchImages, 5000)
    return () => clearInterval(interval)
  }, [token])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSelectedImage(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleRestore = async () => {
    if (!token || !selectedImage) return

    setLoading(true)
    setMessage(null)
    setSteps(prev =>
      prev.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' }))
    )

    try {
      const restartRes = await fetch('/api/restartDrbl', {
        method: 'POST',
        headers: { Authorization: `${token}` },
      })
      const restartJson = await restartRes.json()
      if (restartJson.status === 'drbl started') {
        setSteps(prev =>
          prev.map((s, i) =>
            i === 0 ? { ...s, status: 'done' } : i === 1 ? { ...s, status: 'active' } : s
          )
        )
      } else {
        throw new Error('Restart DRBL failed')
      }

      const restoreRes = await fetch('/api/restoreDiskImage', {
        method: 'POST',
        headers: {
          Authorization: `${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: selectedImage }),
      })
      const restoreJson = await restoreRes.json()

      if (restoreJson.status === 'restore started') {
        setSteps(prev => prev.map(s => ({ ...s, status: 'done' })))
        setMessage('Disk restore started successfully.')
      } else {
        throw new Error('Restore failed to start')
      }
    } catch (err: any) {
      setMessage(err.message || 'Operation failed')
      setSteps(prev =>
        prev.map(s =>
          s.status === 'active' ? { ...s, status: 'error' } : s
        )
      )
    } finally {
      setLoading(false)
      setSelectedImage(null)
    }
  }

  const progressValue =
    (steps.filter(s => s.status === 'done').length / steps.length) * 100

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4 text-gray-800">
        Restore Disk Image
      </h1>
      <p className="text-gray-700 mb-4">
        Select an image from the list below and restore it to disk.
      </p>

      <div className="space-y-2 mb-6">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-gray-800">
            <div
              className={`w-3 h-3 rounded-full ${
                step.status === 'done'
                  ? 'bg-green-500'
                  : step.status === 'active'
                  ? 'bg-blue-500 animate-pulse'
                  : step.status === 'error'
                  ? 'bg-red-500'
                  : 'bg-gray-300'
              }`}
            ></div>
            <span>{step.label}</span>
          </div>
        ))}
      </div>

      <div className="w-full h-3 bg-gray-200 rounded-full mb-6">
        <div
          className="h-3 bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${progressValue}%` }}
        ></div>
      </div>

      <div ref={tableRef} className="border rounded-lg mb-6 overflow-hidden">
        <table className="w-full text-sm text-gray-700">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="py-2 px-3 w-12">No.</th>
              <th className="py-2 px-3">Image Name</th>
            </tr>
          </thead>
          <tbody>
            {images.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center py-3 text-gray-500">
                  No images found.
                </td>
              </tr>
            ) : (
              images.map((img, i) => (
                <tr
                  key={i}
                  className={`cursor-pointer ${
                    selectedImage === img ? 'bg-blue-100' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedImage(img)}
                >
                  <td className="py-2 px-3">{i + 1}</td>
                  <td className="py-2 px-3">{img}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleRestore}
        disabled={loading || !selectedImage || images.length === 0}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Start Restore'}
      </button>

      {loading && (
        <div className="mt-4 flex justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {message && (
        <p
          className={`mt-4 text-sm ${
            message.includes('failed') ? 'text-red-600' : 'text-green-600'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
