'use client'

import { useEffect, useState } from 'react'
import { getTokenInfo } from '../../../lib/auth'

type StepState = 'pending' | 'active' | 'done' | 'error'

export default function RestoreImagePage() {
  const [token, setToken] = useState<string | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [imageName, setImageName] = useState('')
  const [clientsToWait, setClientsToWait] = useState<number>(2)
  const [maxTimeToWait, setMaxTimeToWait] = useState<number>(60)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [steps, setSteps] = useState([
    { label: 'Restart DRBL server', state: 'pending' } as { label: string; state: StepState },
    { label: 'Restore disk from image', state: 'pending' } as { label: string; state: StepState },
  ])

  useEffect(() => {
    const info = getTokenInfo()
    if (info) setToken(info.token)
  }, [])

  // fetch images from server
  useEffect(() => {
    if (!token) return

    const fetchImages = async () => {
      try {
        const res = await fetch('/api/listClones', { headers: { Authorization: `${token}` } })
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

  const runStep = (index: number, state: StepState) =>
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, state } : s)))

  async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60000): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)
      return res
    } catch (err) {
      clearTimeout(timer)
      throw err
    }
  }

  async function parseResponseJson(res: Response) {
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`Invalid JSON from server: ${text}`)
    }
  }

  const validateImageName = (name: string) => /^[A-Za-z0-9-]+$/.test(name)
  const validateClients = (n: number) => Number.isInteger(n) && n >= 0
  const validateMaxTime = (t: number) => Number.isInteger(t) && t >= 1

  const handleRestore = async () => {
    setMessage(null)

    if (!token) {
      setMessage('No token found. Login first.')
      return
    }

    const trimmed = imageName.trim()
    if (!validateImageName(trimmed)) {
      setMessage('Invalid image name. Only letters, numbers and "-" are allowed.')
      return
    }

    if (!images.includes(trimmed)) {
      setMessage('Image name not found in the available images list.')
      return
    }

    if (!validateClients(clientsToWait)) {
      setMessage('Invalid value for clients to wait. Must be integer ≥ 0.')
      return
    }

    if (!validateMaxTime(maxTimeToWait)) {
      setMessage('Invalid value for max time to wait. Must be integer ≥ 1 (seconds).')
      return
    }

    setLoading(true)
    runStep(0, 'active')
    runStep(1, 'pending')

    try {
      // Step 1: restart DRBL
      const restartRes = await fetchWithTimeout('/api/restartDrbl', {
        method: 'POST',
        headers: { Authorization: `${token}` },
      },60000)
      const restartJson = await parseResponseJson(restartRes)
      if (restartJson.status !== 'drbl started') throw new Error('Restart DRBL failed')

      runStep(0, 'done')
      runStep(1, 'active')
      setMessage('DRBL restarted. Starting restore...')

      // Step 2: restore image — include clientsToWait and maxTimeToWait in payload
      const body = JSON.stringify({
        image: trimmed,
        clientsToWait: clientsToWait,
        maxTimeToWait: maxTimeToWait,
      })
      const restoreRes = await fetchWithTimeout('/api/restoreDiskImage', {
        method: 'POST',
        headers: { Authorization: `${token}`, 'Content-Type': 'application/json' },
        body,
      },60000)
      const restoreJson = await parseResponseJson(restoreRes)
      if (restoreJson.status !== 'disk restore started') throw new Error('Restore failed to start:'+ JSON.stringify(restoreJson))

      runStep(1, 'done')
      setMessage('Disk restore started successfully.')
    } catch (err: any) {
      runStep(steps.findIndex(s => s.state === 'active'), 'error')
      setMessage(`Error: ${err?.message ?? String(err)}`)
    } finally {
      setLoading(false)
      setImageName('')
    }
  }

  const progress = (steps.filter(s => s.state === 'done').length / steps.length) * 100
  const isButtonDisabled = loading
    || !validateImageName(imageName.trim())
    || !images.includes(imageName.trim())
    || !validateClients(clientsToWait)
    || !validateMaxTime(maxTimeToWait)

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Restore Disk Image</h1>
      <p className="text-gray-700">
        Enter the name of the image to restore (as shown in the table below). Only alphanumeric characters and '-' are allowed.
      </p>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Image name</label>
        <input
          type="text"
          value={imageName}
          onChange={(e) => setImageName(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Type image name..."
          disabled={loading}
        />
        <p className="text-xs text-gray-500">Must match one of the visible images in the table above.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Clients to wait</label>
          <input
            type="number"
            value={clientsToWait}
            onChange={(e) => setClientsToWait(Number(e.target.value))}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            min={0}
            step={1}
            disabled={loading}
          />
          <p className="text-xs text-gray-500">Number of clients the restore should wait for (integer ≥ 0). Default: 2</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Max time to wait (seconds)</label>
          <input
            type="number"
            value={maxTimeToWait}
            onChange={(e) => setMaxTimeToWait(Number(e.target.value))}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            min={1}
            step={1}
            disabled={loading}
          />
          <p className="text-xs text-gray-500">Maximum wait time in seconds. Default: 60</p>
        </div>
      </div>

      <div className="border rounded-lg p-2 max-h-48 overflow-auto">
        <table className="w-full text-sm text-gray-700">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="py-1 px-2 w-12">No.</th>
              <th className="py-1 px-2">Image Name</th>
            </tr>
          </thead>
          <tbody>
            {images.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center py-2 text-gray-500">No images found.</td>
              </tr>
            ) : images.map((img, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-1 px-2">{i + 1}</td>
                <td className="py-1 px-2">{img}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleRestore}
          disabled={isButtonDisabled}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Start Restore'}
        </button>

        {loading && (
          <div className="inline-flex items-center gap-2">
            <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-700">Working...</span>
          </div>
        )}
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded text-sm ${message.toLowerCase().includes('error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="w-full h-3 bg-gray-200 rounded-full">
        <div className="h-3 rounded-full bg-blue-500 transition-all" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}
