import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Upload, 
  Search, 
  Terminal,
  Bug,
  Fingerprint
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Upload & Enrich', href: '/upload', icon: Upload },
  { name: 'Search & History', href: '/search', icon: Search },
]

export function Sidebar() {
  return (
    <aside className="w-64 bg-blackhat-900/50 border-r border-blackhat-700/50 min-h-screen">
      <div className="p-6">
        {/* Terminal animation */}
        <div className="mb-8">
          <div className="terminal-text text-sm mb-2">
            <Terminal className="h-4 w-4 inline mr-2" />
            Upload → Enrich → Attribute
          </div>
          <div className="text-xs text-blackhat-400 font-mono">
            <span className="animate-pulse">&gt; enriching...</span>
            <span className="terminal-cursor"></span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-mono transition-all duration-200 ${
                  isActive
                    ? 'bg-neon-green/20 text-neon-green border-l-2 border-neon-green'
                    : 'text-blackhat-300 hover:text-neon-green hover:bg-neon-green/10'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Icons */}
        <div className="mt-8 pt-6 border-t border-blackhat-700/50">
          <div className="flex space-x-4 justify-center">
            <Bug className="h-5 w-5 text-neon-green/50 hover:text-neon-green transition-colors cursor-pointer" />
            <Fingerprint className="h-5 w-5 text-neon-green/50 hover:text-neon-green transition-colors cursor-pointer" />
            <Terminal className="h-5 w-5 text-neon-green/50 hover:text-neon-green transition-colors cursor-pointer" />
          </div>
        </div>
      </div>
    </aside>
  )
}
