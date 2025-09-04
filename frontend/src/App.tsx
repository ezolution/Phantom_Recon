import { Layout } from './components/Layout'
import { UploadPage } from './pages/UploadPage'
import { SearchPage } from './pages/SearchPage'
import { DashboardPage } from './pages/DashboardPage'
import { Shield, Bug, Fingerprint, Terminal } from 'lucide-react'

function App() {
  return (
    <div className="min-h-screen bg-blackhat-950 relative">
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-neon-green rounded-full animate-pulse opacity-60"></div>
        <div className="absolute top-40 right-20 w-1 h-1 bg-neon-cyan rounded-full animate-pulse opacity-40"></div>
        <div className="absolute bottom-32 left-1/4 w-1.5 h-1.5 bg-neon-purple rounded-full animate-pulse opacity-50"></div>
        <div className="absolute bottom-20 right-1/3 w-1 h-1 bg-neon-yellow rounded-full animate-pulse opacity-30"></div>
      </div>

      <Layout>
        <div className="space-y-8 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between cyber-border scan-line p-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-neon-green glow-text" />
                <Bug className="h-6 w-6 text-neon-cyan" />
                <Fingerprint className="h-6 w-6 text-neon-purple" />
              </div>
              <div>
                <h1 className="text-4xl font-mono font-bold text-neon-green glow-text">
                  Threat-Forge
                </h1>
                <p className="text-slate-400 font-mono text-sm mt-1">
                  IOC Processor & Threat Intelligence Platform
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-sm font-mono text-neon-green">
                <Terminal className="h-4 w-4" />
                <span className="terminal-cursor">System Online</span>
              </div>
              <div className="w-3 h-3 bg-neon-green rounded-full animate-pulse glow-text"></div>
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
