import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Settings, Database, Shield, Bell, Save, CheckCircle2, XCircle, RefreshCw, Clock } from 'lucide-react'
import { api } from '../lib/api'

export function SettingsPage() {
  const [settings, setSettings] = useState({
    autoEnrichment: true,
    emailNotifications: false,
    maxFileSize: 10,
    retentionDays: 30,
    apiTimeout: 30
  })

  const handleSave = () => {
    // Save settings logic here
    console.log('Settings saved:', settings)
  }

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-emerald-500/20 rounded-lg">
            <Settings className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Settings
            </h1>
            <p className="text-gray-600 text-sm">
              Configure system preferences and settings
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 bg-gray-100">
        <div className="max-w-4xl mx-auto space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-mono font-semibold text-gray-900 mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-emerald-500" />
            General
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-mono text-gray-700">Auto-enrichment</label>
                <p className="text-xs text-gray-500 font-mono">Automatically enrich IOCs after upload</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoEnrichment}
                  onChange={(e) => setSettings({...settings, autoEnrichment: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-mono text-gray-700">Email Notifications</label>
                <p className="text-xs text-gray-500 font-mono">Receive notifications via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* File Settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-mono font-semibold text-gray-900 mb-4 flex items-center">
            <Database className="h-5 w-5 mr-2 text-cyan-500" />
            File Processing
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-mono text-gray-700">Max File Size (MB)</label>
              <input
                type="number"
                value={settings.maxFileSize}
                onChange={(e) => setSettings({...settings, maxFileSize: parseInt(e.target.value)})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mt-1"
                min="1"
                max="100"
              />
            </div>

            <div>
              <label className="text-sm font-mono text-gray-700">Data Retention (Days)</label>
              <input
                type="number"
                value={settings.retentionDays}
                onChange={(e) => setSettings({...settings, retentionDays: parseInt(e.target.value)})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mt-1"
                min="1"
                max="365"
              />
            </div>

            <div>
              <label className="text-sm font-mono text-gray-700">API Timeout (Seconds)</label>
              <input
                type="number"
                value={settings.apiTimeout}
                onChange={(e) => setSettings({...settings, apiTimeout: parseInt(e.target.value)})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mt-1"
                min="5"
                max="300"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Provider Status */}
      <ProviderStatusCard />

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition-colors flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>Save Settings</span>
        </button>
      </div>
        </div>
      </div>
    </div>
  )
}

function ProviderStatusCard() {
  const { data, isLoading } = useQuery<{[k: string]: { ready: boolean; reason?: string } }>({
    queryKey: ['provider-status'],
    queryFn: async () => (await api.get('/stats/provider-status')).data,
    refetchInterval: 10000,
  })
  const [posTtl, setPosTtl] = useState(86400)
  const [negTtl, setNegTtl] = useState(21600)
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-mono font-semibold text-gray-900 mb-4 flex items-center">
        <Shield className="h-5 w-5 mr-2 text-emerald-500" />
        Provider Status
      </h3>
      {isLoading && <div className="text-sm text-gray-500 font-mono">Checking providers…</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(data || {}).map(([name, s]) => (
          <div key={name} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
            <span className="font-mono text-sm text-gray-700 capitalize">{name.replace('_',' ')}</span>
            <div className="flex items-center space-x-2">
              {s.ready ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-gray-600 font-mono">Ready</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-red-600 font-mono">{s.reason || 'Unavailable'}</span>
                </>
              )}
            </div>
          </div>
        ))}
        {(!data || Object.keys(data).length === 0) && !isLoading && (
          <div className="text-sm text-gray-500 font-mono">No providers</div>
        )}
      </div>

      {/* Cache controls */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-mono text-gray-700">Cache TTL</span>
          </div>
          <button
            onClick={async () => { await api.post('/stats/cache/clear'); window.alert('Cache cleared'); }}
            className="px-3 py-1.5 bg-gray-800 text-white rounded-md text-xs flex items-center space-x-1 hover:bg-black"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Clear Cache</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-gray-600 mb-1">Positive TTL (seconds)</label>
            <input type="number" value={posTtl} onChange={e=>setPosTtl(parseInt(e.target.value||'0'))} className="w-full px-3 py-2 border border-gray-300 rounded" min={60} max={604800} />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-600 mb-1">Negative TTL (seconds)</label>
            <input type="number" value={negTtl} onChange={e=>setNegTtl(parseInt(e.target.value||'0'))} className="w-full px-3 py-2 border border-gray-300 rounded" min={30} max={86400} />
          </div>
        </div>
        <div className="mt-3 text-right">
          <button
            onClick={async ()=>{ await api.post('/stats/cache/ttl', undefined, { params: { positive_ttl_seconds: posTtl, negative_ttl_seconds: negTtl } }); window.alert('TTL updated'); }}
            className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs hover:bg-red-700"
          >
            Update TTL
          </button>
        </div>
      </div>
    </div>
  )
}
