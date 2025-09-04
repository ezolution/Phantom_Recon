import { useState } from 'react'
import { Settings, Database, Shield, Bell, Save } from 'lucide-react'

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-mono font-bold text-slate-100 mb-2">
          Settings
        </h1>
        <p className="text-slate-400 font-mono">
          Configure system preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="card">
          <h3 className="text-lg font-mono font-semibold text-slate-100 mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-emerald-400" />
            General
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-mono text-slate-300">Auto-enrichment</label>
                <p className="text-xs text-slate-500 font-mono">Automatically enrich IOCs after upload</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoEnrichment}
                  onChange={(e) => setSettings({...settings, autoEnrichment: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-mono text-slate-300">Email Notifications</label>
                <p className="text-xs text-slate-500 font-mono">Receive notifications via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* File Settings */}
        <div className="card">
          <h3 className="text-lg font-mono font-semibold text-slate-100 mb-4 flex items-center">
            <Database className="h-5 w-5 mr-2 text-cyan-400" />
            File Processing
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-mono text-slate-300">Max File Size (MB)</label>
              <input
                type="number"
                value={settings.maxFileSize}
                onChange={(e) => setSettings({...settings, maxFileSize: parseInt(e.target.value)})}
                className="input-field w-full mt-1"
                min="1"
                max="100"
              />
            </div>

            <div>
              <label className="text-sm font-mono text-slate-300">Data Retention (Days)</label>
              <input
                type="number"
                value={settings.retentionDays}
                onChange={(e) => setSettings({...settings, retentionDays: parseInt(e.target.value)})}
                className="input-field w-full mt-1"
                min="1"
                max="365"
              />
            </div>

            <div>
              <label className="text-sm font-mono text-slate-300">API Timeout (Seconds)</label>
              <input
                type="number"
                value={settings.apiTimeout}
                onChange={(e) => setSettings({...settings, apiTimeout: parseInt(e.target.value)})}
                className="input-field w-full mt-1"
                min="5"
                max="300"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="btn-primary flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>Save Settings</span>
        </button>
      </div>
    </div>
  )
}
