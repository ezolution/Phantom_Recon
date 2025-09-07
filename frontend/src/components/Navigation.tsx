import { useState } from 'react'
import { 
  Upload, 
  Search, 
  BarChart3, 
  Settings, 
  Shield, 
  Menu,
  X,
  Database,
  Activity,
  FileText,
  Bell,
  User,
  HelpCircle,
  Code,
  Bookmark
} from 'lucide-react'

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const navigationSections = [
    {
      title: 'Core Operations',
      items: [
        {
          id: 'upload',
          label: 'Upload',
          icon: Upload,
          description: 'Process CSV files'
        },
        {
          id: 'search',
          label: 'Search',
          icon: Search,
          description: 'Query IOCs'
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
          description: 'System overview'
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
          description: 'Configuration'
        },
        {
          id: 'logs',
          label: 'Logs',
          icon: FileText,
          description: 'System logs'
        }
      ]
    }
  ]

  return (
    <>
      {/* Top Navigation Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-8 py-5">
        <div className="flex items-center justify-between w-full">
          {/* Left Side - Menu and Branding */}
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-white font-bold text-xl">Threat Intelligence IOC Processing Platform</span>
              </div>
            </div>
          </div>

          {/* Right Side - Search Bar and Icons */}
          <div className="flex items-center space-x-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search IOCs, campaigns, threats..."
                className="w-64 pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm"
              />
            </div>
            {/* Icon Buttons */}
            <div className="flex items-center space-x-1">
              <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors shadow-sm hover:shadow-md">
                <Shield className="h-4 w-4 text-white" />
              </button>
              <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors shadow-sm hover:shadow-md">
                <Bell className="h-4 w-4 text-white" />
              </button>
              <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors shadow-sm hover:shadow-md">
                <FileText className="h-4 w-4 text-white" />
              </button>
              <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors shadow-sm hover:shadow-md">
                <Code className="h-4 w-4 text-white" />
              </button>
              <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors shadow-sm hover:shadow-md">
                <User className="h-4 w-4 text-white" />
              </button>
              <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors shadow-sm hover:shadow-md">
                <HelpCircle className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Left Sidebar */}
      {isSidebarOpen && (
        <div className="w-64 bg-slate-900 border-r border-slate-800 min-h-screen">
          <div className="p-8">
            {/* Sidebar Header */}
            <div className="mb-10">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">Navigation</h2>
            </div>

            {/* Navigation Sections */}
            <div className="space-y-8">
              {navigationSections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                    {section.title}
                  </h3>
                  <div className="space-y-2">
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const isActive = activeTab === item.id
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => onTabChange(item.id)}
                          className={`
                            w-full flex items-center space-x-4 px-4 py-3 rounded-xl text-left transition-all duration-200 group
                            ${isActive 
                              ? 'bg-red-600 text-white shadow-lg' 
                              : 'text-slate-300 hover:text-white hover:bg-slate-800 hover:shadow-md'
                            }
                          `}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="font-medium text-sm">{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto px-2.5 py-1 text-xs font-medium bg-emerald-500 text-white rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar Footer */}
            <div className="mt-10 pt-8 border-t border-slate-800">
              <div className="flex items-center space-x-3 text-sm text-slate-400">
                <div className="w-3 h-3 bg-emerald-400 rounded-full shadow-sm"></div>
                <span className="font-medium">System Online</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
