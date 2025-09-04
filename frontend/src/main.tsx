import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const rootElement = document.getElementById('root')!
rootElement.className = 'bg-gray-900 min-h-screen'

createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#10b981',
            border: '1px solid #10b981',
            fontFamily: 'Inter, sans-serif',
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
)
