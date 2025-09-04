import { Layout } from './components/Layout'
import { UploadPage } from './pages/UploadPage'
import { SearchPage } from './pages/SearchPage'
import { DashboardPage } from './pages/DashboardPage'
import { Shield, Bug, Fingerprint, Terminal } from 'lucide-react'

function App() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Layout>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between p-6 bg-slate-900 rounded-xl border border-slate-700">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <Shield className="h-8 w-8 text-emerald-400" />
                <Bug className="h-6 w-6 text-cyan-400" />
                <Fingerprint className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-mono font-bold text-slate-100">
                  Threat-Forge
                </h1>
                <p className="text-slate-400 font-mono text-sm mt-1">
                  IOC Processor & Threat Intelligence Platform
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-sm font-mono text-emerald-400">
                <Terminal className="h-4 w-4" />
                <span className="terminal-cursor">System Online</span>
              </div>
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
