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
      case 'settings':
        return <SettingsPage />
      default:
        return <UploadPage />
    }
  }

  return (
    <div className="min-h-screen bg-black w-full">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 lg:ml-64 bg-black">
        <div className="p-6 bg-black">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}

export default App
// Force rebuild Fri Sep  5 10:41:23 +08 2025
