import { useState } from 'react'
import { Shield } from 'lucide-react'
import { UploadPage } from './pages/UploadPage'
import { SearchPage } from './pages/SearchPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'

function App() {
  const [activeTab, setActiveTab] = useState('search')

  const renderContent = () => {
    switch (activeTab) {
      case 'upload':
        return <UploadPage />
      case 'search':
        return <SearchPage />
      case 'dashboard':
        return <DashboardPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <SearchPage />
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="flex items-center space-x-3">
          <Shield className="h-6 w-6 text-green-400" />
          <div>
            <h1 className="text-lg font-bold text-white">PHANTOM RECON</h1>
            <p className="text-xs text-gray-400">IOC Hub - Threat Attribution & Enrichment Console</p>
          </div>
        </div>
      </div>

      {/* Navigation Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 pt-16">
        <div className="p-4 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'dashboard' 
                ? 'bg-gray-700 text-gray-300' 
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
            }`}
          >
            <div className="font-medium">Ops Console</div>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'search' 
                ? 'bg-green-500 text-black font-bold' 
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
            }`}
          >
            <div className="font-medium">Intel Vault</div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pt-16">
        <div className="flex h-screen">
          {/* Main Content Area */}
          <div className="flex-1 bg-gray-900 p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
