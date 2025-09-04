import { useState } from 'react'
import { Layout } from './components/Layout'
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
    <Layout>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 lg:ml-64">
        <div className="p-6">
          {renderContent()}
        </div>
      </main>
    </Layout>
  )
}

export default App
