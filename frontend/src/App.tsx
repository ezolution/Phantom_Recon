import { useState } from 'react'
import { Navigation } from './components/Navigation'
import { UploadPage } from './pages/UploadPage'
import { SearchPage } from './pages/SearchPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'

function App() {
  const [activeTab, setActiveTab] = useState('upload')

  const renderContent = () => {
    switch (activeTab) {
      case 'upload':
        return <UploadPage />
      case 'search':
        return <SearchPage />
      case 'dashboard':
        return <DashboardPage />
      case 'analytics':
        return <DashboardPage /> // For now, reuse dashboard - can create separate analytics page later
      case 'settings':
        return <SettingsPage />
      case 'logs':
        return <SettingsPage /> // For now, reuse settings - can create separate logs page later
      default:
        return <UploadPage />
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-900">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex min-h-screen">
        {/* Left Sidebar - will be added to Navigation component */}
        <main className="flex-1 bg-slate-100">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default App
// Force rebuild Fri Sep  5 10:41:23 +08 2025
// Force rebuild Fri Sep  5 10:42:29 +08 2025
