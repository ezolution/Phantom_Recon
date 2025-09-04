import { useState } from 'react'
import { 
  Upload, 
  Search, 
  BarChart3, 
  Settings, 
  Shield, 
  Bug, 
  Fingerprint,
  Menu,
  X
} from 'lucide-react'

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navigationItems = [
    {
      id: 'upload',
      label: 'Upload',
      icon: Upload,
      description: 'Upload CSV files'
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      description: 'Search IOCs'
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      description: 'System statistics'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Configuration'
    }
  ]

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
      >
        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-blackhat-900 border-r border-blackhat-700 transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
      `}>
        {/* Header */}
        <div className="p-6 border-b border-blackhat-700">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-neon-green glow-text" />
              <Bug className="h-6 w-6 text-neon-cyan glow-text" />
              <Fingerprint className="h-6 w-6 text-neon-purple glow-text" />
            </div>
            <div>
              <h1 className="text-xl font-mono font-bold text-slate-100 glow-text">
                Threat-Forge
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                IOC Processor
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id)
                  setIsMobileMenuOpen(false)
                }}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-300
                  ${isActive 
                    ? 'bg-neon-green/10 border border-neon-green/20 text-neon-green glow-text' 
                    : 'text-slate-300 hover:text-neon-green hover:bg-blackhat-800 hover:glow-text'
                  }
                `}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-slate-500 font-mono truncate">{item.description}</p>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center space-x-2 text-xs font-mono text-neon-green">
            <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse glow-text"></div>
            <span className="terminal-cursor">System Online</span>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
