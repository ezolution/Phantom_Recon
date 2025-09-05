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
  X,
  Database,
  Activity,
  FileText,
  Zap
} from 'lucide-react'

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navigationSections = [
    {
      title: 'Core Operations',
      items: [
        {
          id: 'upload',
          label: 'Upload',
          icon: Upload,
          description: 'Process CSV files',
          badge: null
        },
        {
          id: 'search',
          label: 'Search',
          icon: Search,
          description: 'Query IOCs',
          badge: null
        }
      ]
    },
    {
      title: 'Analytics',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: BarChart3,
          description: 'System overview',
          badge: null
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: Activity,
          description: 'Threat analysis',
          badge: 'New'
        }
      ]
    },
    {
      title: 'Management',
      items: [
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          description: 'Configuration',
          badge: null
        },
        {
          id: 'logs',
          label: 'Logs',
          icon: FileText,
          description: 'System logs',
          badge: null
        }
      ]
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
        fixed inset-y-0 left-0 z-40 w-72 bg-black border-r border-slate-800 transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
      `}>
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                Threat-Forge
              </h1>
              <p className="text-sm text-slate-400 font-mono">
                IOC Processing Platform
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto">
          {navigationSections.map((section, sectionIndex) => (
            <div key={section.title} className="p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {section.title}
              </h3>
              <nav className="space-y-1">
                {section.items.map((item) => {
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
                        w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group
                        ${isActive 
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                        }
                      `}
                    >
                      <div className={`
                        flex items-center justify-center w-8 h-8 rounded-lg transition-colors
                        ${isActive 
                          ? 'bg-emerald-500/20' 
                          : 'bg-slate-700 group-hover:bg-slate-600'
                        }
                      `}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-sm">{item.label}</p>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{item.description}</p>
                      </div>
                    </button>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span>System Online</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              v2.1.0
            </div>
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
