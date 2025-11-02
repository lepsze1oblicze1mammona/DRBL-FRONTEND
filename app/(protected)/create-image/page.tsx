'use client'

import { useEffect, useState } from 'react'
import { getTokenInfo } from '../../../lib/auth'

interface Step {
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
}

export default function CreateImagePage() {
  const [token, setToken] = useState<string | null>(null)
  const [steps, setSteps] = useState<Step[]>([
    { label: 'Restart DRBL server', status: 'pending' },
    { label: 'Set Clonezilla to select_in_client', status: 'pending' },
  ])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const info = getTokenInfo()
    if (info) setToken(info.token)
  }, [])

  const handleCreateImage = async () => {
    if (!token) {
      setMessage('No token found.')
      return
    }

    setLoading(true)
    setMessage(null)
    setSteps(prev =>
      prev.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' }))
    )

    try {
      // Step 1: restart DRBL
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

      // Step 2: create image
      const imageRes = await fetch('/api/createImage', {
        method: 'POST',
        headers: { Authorization: `${token}` },
      })
      const imageJson = await imageRes.json()

      if (imageJson.status === 'select_in_client started') {
        setSteps(prev => prev.map(s => ({ ...s, status: 'done' })))
        setMessage('Clonezilla set to select_in_client mode successfully.')
      } else {
        throw new Error('Failed to start Clonezilla mode')
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
    }
  }

  const progressValue =
    (steps.filter(s => s.status === 'done').length / steps.length) * 100

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4 text-gray-800">
        Create Clonezilla Image
      </h1>
      <p className="text-gray-700 mb-4">
        This page will restart the DRBL service and set Clonezilla to
        <strong> select_in_client </strong> mode.
      </p>

      <div className="space-y-2 mb-6">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-sm text-gray-800"
          >
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

      <button
        onClick={handleCreateImage}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Start process'}
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
