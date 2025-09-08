import { useState } from 'react'
import { TopNavigation, Sidebar } from './components/Navigation'
import { UploadPage } from './pages/UploadPage'
import { SearchPage } from './pages/SearchPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'

function App() {
  const [activeTab, setActiveTab] = useState('upload')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const renderContent = () => {
    switch (activeTab) {
      case 'upload':
        return <UploadPage />
      case 'search':
        return <SearchPage />
      case 'dashboard':
        return <DashboardPage />
      case 'analytics':
        return <AnalyticsPage />
      case 'settings':
        return <SettingsPage />
      case 'logs':
        return <SettingsPage /> // For now, reuse settings - can create separate logs page later
      default:
        return <UploadPage />
    }
  }

  const handleMenuClick = () => setIsSidebarOpen((open) => !open)

  return (
    <div className="min-h-screen w-full bg-slate-900">
      <TopNavigation onMenuClick={handleMenuClick} />
      <div className="flex min-h-screen">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} isOpen={isSidebarOpen} />
        <main className="flex-1 bg-gray-100 min-h-screen">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default App
