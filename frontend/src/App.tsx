import { Layout } from './components/Layout'
import { UploadPage } from './pages/UploadPage'
import { SearchPage } from './pages/SearchPage'
import { DashboardPage } from './pages/DashboardPage'

function App() {
  return (
    <div className="min-h-screen bg-blackhat-950">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-mono font-bold text-neon-green glow-text">
                Threat-Forge IOC Processor
              </h1>
              <p className="text-blackhat-400 font-mono mt-1">
                Upload CSV files and enrich IOCs with threat intelligence
              </p>
            </div>
            <div className="flex items-center space-x-2 text-sm font-mono text-neon-green">
              <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse"></div>
              <span>System Online</span>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload Section */}
            <div className="lg:col-span-1">
              <UploadPage />
            </div>
            
            {/* Results Section */}
            <div className="lg:col-span-1">
              <SearchPage />
            </div>
          </div>

          {/* Dashboard Stats */}
          <DashboardPage />
        </div>
      </Layout>
    </div>
  )
}

export default App
