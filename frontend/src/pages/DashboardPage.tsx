import { useQuery } from '@tanstack/react-query'
import { Shield, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { api } from '@/lib/api'

interface StatsData {
  total_iocs: number
  risk_bands: Record<string, number>
  ioc_types: Record<string, number>
  last_7d_iocs: number
  providers: Record<string, number>
}

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ['stats', 'overview'],
    queryFn: async () => {
      const response = await api.get('/stats/overview')
      return response.data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="terminal-text">Loading threat intelligence...</p>
        </div>
      </div>
    )
  }

  const riskBandColors = {
    'Low': 'risk-low',
    'Medium': 'risk-medium', 
    'High': 'risk-high',
    'Critical': 'risk-critical'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold text-neon-green glow-text">
            Threat Intelligence Dashboard
          </h1>
          <p className="text-blackhat-400 font-mono mt-1">
            Real-time IOC analysis and enrichment status
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm font-mono text-neon-green">
          <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse"></div>
          <span>System Online</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total IOCs */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-mono text-blackhat-400">Total IOCs</p>
              <p className="text-2xl font-mono font-bold text-white">
                {stats?.total_iocs?.toLocaleString() || 0}
              </p>
            </div>
            <Shield className="h-8 w-8 text-neon-green" />
          </div>
        </div>

        {/* Last 7 Days */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-mono text-blackhat-400">Last 7 Days</p>
              <p className="text-2xl font-mono font-bold text-white">
                {stats?.last_7d_iocs?.toLocaleString() || 0}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-neon-blue" />
          </div>
        </div>

        {/* High Risk */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-mono text-blackhat-400">High Risk</p>
              <p className="text-2xl font-mono font-bold text-neon-red">
                {(stats?.risk_bands?.['High'] || 0) + (stats?.risk_bands?.['Critical'] || 0)}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-neon-red" />
          </div>
        </div>

        {/* Providers */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-mono text-blackhat-400">Active Providers</p>
              <p className="text-2xl font-mono font-bold text-white">
                {Object.keys(stats?.providers || {}).length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-neon-green" />
          </div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-mono font-bold text-neon-green mb-4">
            Risk Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(stats?.risk_bands || {}).map(([band, count]) => (
              <div key={band} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${riskBandColors[band as keyof typeof riskBandColors] || 'bg-blackhat-600'}`}></div>
                  <span className="font-mono text-sm">{band}</span>
                </div>
                <span className="font-mono font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-mono font-bold text-neon-green mb-4">
            IOC Types
          </h3>
          <div className="space-y-3">
            {Object.entries(stats?.ioc_types || {}).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="font-mono text-sm capitalize">{type}</span>
                <span className="font-mono font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Provider Status */}
      <div className="card">
        <h3 className="text-lg font-mono font-bold text-neon-green mb-4">
          Provider Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(stats?.providers || {}).map(([provider, count]) => (
            <div key={provider} className="text-center">
              <div className="w-12 h-12 bg-neon-green/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Shield className="h-6 w-6 text-neon-green" />
              </div>
              <p className="font-mono text-sm text-blackhat-400 capitalize">{provider}</p>
              <p className="font-mono font-bold text-neon-green">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
