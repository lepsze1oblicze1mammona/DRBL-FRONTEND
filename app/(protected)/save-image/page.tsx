'use client'

import { useEffect, useState } from 'react'
import { getTokenInfo } from '../../../lib/auth'

type StepState = 'pending' | 'active' | 'done' | 'error'

export default function SaveImagePage() {
  const [token, setToken] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [steps, setSteps] = useState([
    { label: 'Restart DRBL', state: 'pending' } as { label: string; state: StepState },
    { label: 'Start disk save or run RAM session', state: 'pending' } as { label: string; state: StepState },
  ])

  useEffect(() => {
    const info = getTokenInfo()
    if (info) setToken(info.token)
  }, [])

  const runStep = (index: number, state: StepState) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, state } : s)))

  // fetch wrapper with abort timeout
  async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60000): Promise<Response> {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(id)
      return res
    } catch (err) {
      clearTimeout(id)
      throw err
    }
  }

  // read and parse response body safely
  async function parseResponseJson(res: Response) {
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch (e) {
      throw new Error(`Invalid JSON from server: ${text}`)
    }
  }

  const validateImageName = (name: string) => {
    const re = /^[A-Za-z0-9-]+$/
    return re.test(name)
  }

  const handleSaveImage = async () => {
    setMessage(null)

    if (!token) {
      setMessage('No token found. Login first.')
      return
    }

    if (imageName.trim() === '') {
      setMessage('Please provide an image name.')
      return
    }

    if (!validateImageName(imageName.trim())) {
      setMessage('Invalid image name. Only letters, numbers and "-" are allowed.')
      return
    }

    setLoading(true)
    setMessage('Restarting DRBL... (this may take up to 60s)')
    runStep(0, 'active')
    runStep(1, 'pending')

    try {
      // Step 1: restart DRBL
      const restartRes = await fetchWithTimeout('/api/restartDrbl', {
        method: 'POST',
        headers: { Authorization: `${token}` },
      }, 60000)

      if (!restartRes.ok) {
        const text = await restartRes.text().catch(() => '')
        throw new Error(`Restart failed: HTTP ${restartRes.status} ${text}`)
      }

      const restartJson = await parseResponseJson(restartRes)
      if (restartJson.status !== 'drbl started') {
        throw new Error(`Restart failed: ${String(restartJson.status)}`)
      }

      runStep(0, 'done')
      runStep(1, 'active')
      setMessage('DRBL restarted. Starting disk (RAM) ...')

      // Step 2: saveDiskRam POST JSON body
      const body = JSON.stringify({ image: imageName.trim() })
      const saveRes = await fetchWithTimeout('/api/saveDiskRam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${token}`,
        },
        body,
      }, 60000)

      if (!saveRes.ok) {
        const text = await saveRes.text().catch(() => '')
        throw new Error(`Save failed: HTTP ${saveRes.status} ${text}`)
      }

      const saveJson = await parseResponseJson(saveRes)
      if (saveJson.status !== 'disk save started') {
        throw new Error(`Save failed: ${String(saveJson.status)}`)
      }

      runStep(1, 'done')
      setMessage('Disk save started successfully. The image will be saved or RAM session will start.')
    } catch (err: any) {
      // mark active steps as error
      setSteps((prev) => prev.map((s) => (s.state === 'active' ? { ...s, state: 'error' } : s)))
      if (err?.name === 'AbortError') {
        setMessage('Request timed out (60s)')
      } else {
        setMessage(`Error: ${err?.message ?? String(err)}`)
      }
    } finally {
      // stop loading then clear image name so the input is blank and button disabled
      setLoading(false)
      setImageName('')
    }
  }

  const progress = (steps.filter((s) => s.state === 'done').length / steps.length) * 100
  const isButtonDisabled = loading || imageName.trim() === ''

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Save Image  or RAM session</h1>

      <p className="text-gray-700">
        This will restart the DRBL service and start a disk save or run live RAM session. Provide an image
        name (alphanumeric and hyphens allowed).
      </p>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Image name</label>
        <input
          type="text"
          value={imageName}
          onChange={(e) => setImageName(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="my-backup-image"
          disabled={loading}
        />
        <p className="text-xs text-gray-500">Allowed: A–Z, a–z, 0–9 and '-' only.</p>
      </div>

      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  s.state === 'done'
                    ? 'bg-green-500'
                    : s.state === 'active'
                    ? 'bg-blue-500 animate-pulse'
                    : s.state === 'error'
                    ? 'bg-red-500'
                    : 'bg-gray-300'
                }`}
              />
              <div className="text-sm text-gray-800">{s.label}</div>
            </div>
            <div className="text-sm text-gray-600">{s.state}</div>
          </div>
        ))}
      </div>

      <div className="w-full h-3 bg-gray-200 rounded-full">
        <div
          className="h-3 rounded-full transition-all duration-300"
          style={{ width: `${progress}%`, backgroundColor: '#3b82f6' }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSaveImage}
          disabled={isButtonDisabled}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Start Save'}
        </button>

        {loading && (
          <div className="inline-flex items-center gap-2">
            <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-700">Waiting for server...</span>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`mt-4 p-3 rounded text-sm ${
            message.toLowerCase().includes('error') || message.toLowerCase().includes('timed out')
              ? 'bg-red-50 text-red-700'
              : 'bg-green-50 text-green-700'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  )
}
