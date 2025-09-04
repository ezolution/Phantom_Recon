import { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-blackhat-950">
      <main className="p-6">
        {children}
      </main>
    </div>
  )
}
