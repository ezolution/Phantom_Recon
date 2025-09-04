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
    <div className="min-h-screen bg-black flex">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-8 py-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">PHANTOM RECON</h1>
              <p className="text-sm text-gray-400 font-medium">IOC Hub - Threat Attribution & Enrichment Console</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sidebar */}
      <div className="w-72 bg-gray-900 border-r border-gray-800 pt-20">
        <div className="p-6 space-y-3">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full text-left px-6 py-4 rounded-xl transition-all duration-300 ${
              activeTab === 'dashboard' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <div className="font-semibold text-lg">Ops Console</div>
            <div className="text-sm opacity-75">System Overview</div>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`w-full text-left px-6 py-4 rounded-xl transition-all duration-300 ${
              activeTab === 'search' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <div className="font-semibold text-lg">Intel Vault</div>
            <div className="text-sm opacity-75">IOC Database</div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pt-20">
        <div className="flex h-screen">
          {/* Main Content Area */}
          <div className="flex-1 bg-black p-8">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
