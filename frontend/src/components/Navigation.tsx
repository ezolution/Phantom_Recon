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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

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
      {/* Top Navigation Bar */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl">
              <Shield className="h-6 w-6 text-white" />
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

          {/* Dropdown Menu Button */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Menu className="h-5 w-5" />
              <span className="font-medium">Menu</span>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-50">
                <div className="p-4">
                  {navigationSections.map((section, sectionIndex) => (
                    <div key={section.title} className="mb-6 last:mb-0">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        {section.title}
                      </h3>
                      <div className="space-y-1">
                        {section.items.map((item) => {
                          const Icon = item.icon
                          const isActive = activeTab === item.id
                          
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                onTabChange(item.id)
                                setIsDropdownOpen(false)
                              }}
                              className={`
                                w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group
                                ${isActive 
                                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
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
                      </div>
                    </div>
                  ))}
                  
                  {/* Footer */}
                  <div className="pt-4 border-t border-slate-700">
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay to close dropdown */}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </>
  )
}
