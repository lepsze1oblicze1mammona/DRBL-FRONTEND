'use client'

import { useEffect, useMemo, useState } from 'react'
import { getTokenInfo } from '../../../lib/auth'

type StepState = 'pending' | 'active' | 'done' | 'error'

type SectionFields = Record<string, string>

export default function DrblConfigPage() {
  const [token, setToken] = useState<string | null>(null)
  // grouped inputs
  const [general, setGeneral] = useState<SectionFields>({
    domain: '',
    nisdomain: '',
    localswapfile: '', // yes/no
    client_init: '', // graphic/text
    login_gdm_opt: '',
    maxswapsize: '',
    ocs_img_repo_dir: '',
    total_client_no: '',
    account_passwd_length: '',
    hostname: '',
    purge_client: '', // yes/no
    set_client_system_select: '', // yes/no
    use_graphic_pxelinux_menu: '', // yes/no
    client_system_boot_timeout: '',
    language: '',
    drbl_server_as_NAT_server: '', // yes/no
    clonezilla_mode: '',
  })
  const [eth1, setEth1] = useState<SectionFields>({
    interface: '',
    range: '',
  })

  const [steps, setSteps] = useState([
    { label: 'Apply config changes', state: 'pending' } as { label: string; state: StepState },
    { label: 'Restart DRBL', state: 'pending' } as { label: string; state: StepState },
  ])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const info = getTokenInfo()
    if (info) setToken(info.token)
  }, [])

  // helpers
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
    } catch (e) {
      throw new Error(`Invalid JSON from server: ${text}`)
    }
  }

  // compute if any writable field has a value
  const hasChanges = useMemo(() => {
    const anyNonEmpty = (o: SectionFields) => Object.values(o).some(v => v.trim() !== '')
    return anyNonEmpty(general) || anyNonEmpty(eth1)
  }, [general, eth1])

  // simple client-side validations (mirrors fieldValidators minimally)
  const validators: Record<string, (v: string) => boolean> = {
    total_client_no: v => /^\d+$/.test(v),
    maxswapsize: v => /^\d+$/.test(v),
    account_passwd_length: v => /^\d+$/.test(v) && Number(v) > 0 && Number(v) <= 128,
    client_system_boot_timeout: v => /^\d+$/.test(v),
    language: v => v === '' || /^[a-z]{2}_[A-Z]{2}\.?/.test(v + ' '),
    drbl_server_as_NAT_server: v => v === '' || v === 'yes' || v === 'no',
    range: v => v === '' || /^\d+-\d+$/.test(v),
  }

  const validateAll = () => {
    // collect invalids
    const bad: string[] = []
    for (const [k, fn] of Object.entries(validators)) {
      const value =
        (k in general ? (general as any)[k] : '') || (k in eth1 ? (eth1 as any)[k] : '')
      if (value !== '' && !fn(value)) bad.push(k)
    }
    return bad
  }

  const buildPayload = () => {
    const payload: Record<string, SectionFields> = {}
    const pickNonEmpty = (obj: SectionFields) => {
      const out: SectionFields = {}
      for (const [k, v] of Object.entries(obj)) {
        if (v.trim() !== '') out[k] = v.trim()
      }
      return out
    }
    const g = pickNonEmpty(general)
    const e = pickNonEmpty(eth1)
    if (Object.keys(g).length > 0) payload.general = g
    if (Object.keys(e).length > 0) payload.eth1 = e
    return payload
  }

  const clearAll = () => {
    setGeneral(prev => {
      const cleared: SectionFields = {}
      Object.keys(prev).forEach(k => (cleared[k] = ''))
      return cleared
    })
    setEth1(prev => {
      const cleared: SectionFields = {}
      Object.keys(prev).forEach(k => (cleared[k] = ''))
      return cleared
    })
  }

  const handleApplyAndStart = async () => {
    setMessage(null)

    if (!token) {
      setMessage('No token found. Login again.')
      return
    }

    const invalid = validateAll()
    if (invalid.length > 0) {
      setMessage(`Validation failed for: ${invalid.join(', ')}`)
      return
    }

    const payload = buildPayload()
    if (Object.keys(payload).length === 0) {
      setMessage('No changes to apply.')
      return
    }

    setLoading(true)
    runStep(0, 'active')
    runStep(1, 'pending')

    try {
      // Step 1: changeConfig
      const res = await fetchWithTimeout('/api/changeConfig', {
        method: 'POST',
        headers: {
          Authorization: `${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }, 60000)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`changeConfig HTTP ${res.status} ${text}`)
      }

      const json = await parseResponseJson(res)
      // changeConfig returns 200 on success; backend uses {"status":"config updated on remote server", ...}
      if (json.error) {
        // backend can respond with validation errors in details
        throw new Error(typeof json.error === 'string' ? json.error : JSON.stringify(json.error))
      }

      runStep(0, 'done')
      runStep(1, 'active')
      setMessage('Config applied. Restarting DRBL (up to 60s)...')

      // Step 2: startDrbl
      const res2 = await fetchWithTimeout('/api/startDrbl', {
        method: 'POST',
        headers: { Authorization: `${token}` },
      }, 60000)

      if (!res2.ok) {
        const text = await res2.text().catch(() => '')
        throw new Error(`startDrbl HTTP ${res2.status} ${text}`)
      }

      const json2 = await parseResponseJson(res2)
      if (json2.status !== 'drbl started') {
        throw new Error(`Unexpected startDrbl status: ${String(json2.status)}`)
      }

      runStep(1, 'done')
      setMessage('DRBL restarted. Changes applied successfully.')
    } catch (err: any) {
      // mark active step as error
      setSteps(prev => prev.map(s => (s.state === 'active' ? { ...s, state: 'error' } : s)))
      if (err?.name === 'AbortError') {
        setMessage('Request timed out (60s)')
      } else {
        setMessage(`Error: ${err?.message ?? String(err)}`)
      }
    } finally {
      setLoading(false)
      // clear inputs and disable button per your requirement
      clearAll()
    }
  }

  // small helper components: row rendering and tips
  const InputRow = ({ section, keyName, tip, placeholder }: { section: 'general' | 'eth1'; keyName: string; tip?: string; placeholder?: string }) => {
    const value = section === 'general' ? (general as any)[keyName] : (eth1 as any)[keyName]
    const setValue = (v: string) => {
      if (section === 'general') setGeneral(prev => ({ ...prev, [keyName]: v }))
      else setEth1(prev => ({ ...prev, [keyName]: v }))
    }

    return (
      <div className="grid grid-cols-3 gap-2 items-start py-2">
        <label className="text-sm text-gray-700">{keyName}</label>
        <input
          className="col-span-2 px-2 py-1 border rounded text-sm"
          value={value}
          placeholder={placeholder ?? tip}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
        />
        <div className="col-span-3 text-xs text-gray-500">{tip}</div>
      </div>
    )
  }

  const progress = (steps.filter(s => s.state === 'done').length / steps.length) * 100
  const isButtonDisabled = loading || !hasChanges

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">DRBL Configuration</h1>
      <p className="text-gray-700">
        Edit values you want to change. Empty fields are omitted from the update (they will not be written).
        Fields that are blank in the current config cannot be modified by the API — the backend will validate and reject those.
      </p>

      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${s.state === 'done' ? 'bg-green-500' : s.state === 'active' ? 'bg-blue-500 animate-pulse' : s.state === 'error' ? 'bg-red-500' : 'bg-gray-300'}`} />
            <div className="text-sm text-gray-800">{s.label}</div>
            <div className="ml-auto text-sm text-gray-600">{s.state}</div>
          </div>
        ))}
      </div>

      <div className="w-full h-3 bg-gray-200 rounded-full">
        <div style={{ width: `${progress}%` }} className="h-3 rounded-full bg-blue-500 transition-all" />
      </div>

      {/* GENERAL */}
      <section className="p-4 border rounded">
        <h2 className="font-medium mb-2">[general]</h2>

        <InputRow section="general" keyName="domain" tip="Primary domain (e.g. drbl.org)" placeholder="drbl.org" />
        <InputRow section="general" keyName="nisdomain" tip="NIS domain name (optional)" placeholder="penguinzilla" />
        <InputRow section="general" keyName="localswapfile" tip="yes | no" placeholder="yes" />
        <InputRow section="general" keyName="client_init" tip="graphic or text" placeholder="graphic" />
        <InputRow section="general" keyName="login_gdm_opt" tip="login option for GDM" placeholder="login" />
        <InputRow section="general" keyName="maxswapsize" tip="swap size (MB) — integer" placeholder="128" />
        <InputRow section="general" keyName="ocs_img_repo_dir" tip="image repository path" placeholder="/home/partimag" />
        <InputRow section="general" keyName="total_client_no" tip="expected total clients — integer" placeholder="100" />
        <InputRow section="general" keyName="account_passwd_length" tip="account password length (1..128)" placeholder="8" />
        <InputRow section="general" keyName="hostname" tip="hostname prefix" placeholder="debian-" />
        <InputRow section="general" keyName="purge_client" tip="yes | no" placeholder="no" />
        <InputRow section="general" keyName="set_client_system_select" tip="yes | no" placeholder="yes" />
        <InputRow section="general" keyName="use_graphic_pxelinux_menu" tip="yes | no" placeholder="yes" />
        <InputRow section="general" keyName="client_system_boot_timeout" tip="boot timeout in seconds" placeholder="70" />
        <InputRow section="general" keyName="language" tip="locale (e.g. en_US.UTF-8)" placeholder="en_US.UTF-8" />
        <InputRow section="general" keyName="drbl_server_as_NAT_server" tip="yes | no" placeholder="yes" />
        <InputRow section="general" keyName="clonezilla_mode" tip="clonezilla_box_mode or other" placeholder="clonezilla_box_mode" />
      </section>

      {/* ETH1 */}
      <section className="p-4 border rounded">
        <h2 className="font-medium mb-2">[eth1]</h2>
        <InputRow section="eth1" keyName="interface" tip="network interface name (e.g. eth1)" placeholder="eth1" />
        <InputRow section="eth1" keyName="range" tip="IP range like 1-100" placeholder="1-100" />
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleApplyAndStart}
          disabled={isButtonDisabled}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Apply & Restart DRBL'}
        </button>

        {loading && (
          <div className="inline-flex items-center gap-3">
            <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-gray-700">Working... please wait</div>
          </div>
        )}
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded text-sm ${message.toLowerCase().includes('error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}
    </div>
  )
}
