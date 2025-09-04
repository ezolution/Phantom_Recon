import { useState } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { Shield, User, LogOut, BookOpen } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function TopBar() {
  const { user, logout } = useAuth()
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  return (
    <header className="bg-blackhat-900/80 backdrop-blur-sm border-b border-blackhat-700/50 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-neon-green" />
          <div>
            <h1 className="text-2xl font-mono font-bold text-neon-green glow-text">
              THREAT-FORGE
            </h1>
            <p className="text-xs text-blackhat-400 font-mono">
              BlackHat Intelligence Portal
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Help button */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="btn-secondary text-sm"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Help (?)
          </button>

          {/* User menu */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center space-x-2 text-sm hover:text-neon-green transition-colors">
              <div className="w-8 h-8 bg-neon-green/20 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-neon-green" />
              </div>
              <span className="font-mono">{user?.username}</span>
              <span className="text-xs text-blackhat-400">({user?.role})</span>
            </Menu.Button>

            <Transition
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-out"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <Menu.Items className="absolute right-0 mt-2 w-48 bg-blackhat-900 border border-blackhat-700 rounded-md shadow-lg z-50">
                <div className="py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={logout}
                        className={`${
                          active ? 'bg-neon-green/10 text-neon-green' : 'text-white'
                        } flex items-center w-full px-4 py-2 text-sm font-mono transition-colors`}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>

      {/* Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-blackhat-900 border border-neon-green/30 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-mono font-bold text-neon-green mb-4">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span>/</span>
                <span>Focus search</span>
              </div>
              <div className="flex justify-between">
                <span>?</span>
                <span>Show this help</span>
              </div>
              <div className="flex justify-between">
                <span>Ctrl+U</span>
                <span>Upload page</span>
              </div>
              <div className="flex justify-between">
                <span>Ctrl+S</span>
                <span>Search page</span>
              </div>
            </div>
            <button
              onClick={() => setIsHelpOpen(false)}
              className="btn-primary mt-4 w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
