import { useQuery } from '@tanstack/react-query'
import { Shield, TrendingUp, AlertTriangle, CheckCircle, Fingerprint, Activity, Clock } from 'lucide-react'
import { api } from '../lib/api'

interface StatsData {
  total_iocs: number
  risk_bands: Record<string, number>
  ioc_types: Record<string, number>
  last_7d_iocs: number
  providers: Record<string, number>
  providers_configured?: string[]
  providers_configured_count?: number
  providers_successful_count?: number
  attribution_by_provider?: Record<string, { actors: number; families: number }>
  unique_actors_7d?: string[]
  unique_actors_7d_count?: number
  attribution_samples?: {
    actors: Record<string, { name: string; count: number }[]>
    families: Record<string, { name: string; count: number }[]>
  }
}

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ['stats', 'overview'],
    queryFn: async () => {
      const response = await api.get('/stats/overview')
      return response.data
    },
  })

  type JobSummary = {
    job: {
      id: number
      status: 'queued' | 'running' | 'done' | 'error'
      processed_iocs: number
      total_iocs: number
      error_message?: string | null
    }
    progress_percentage: number
  }

  const { data: latestJob } = useQuery<JobSummary>({
    queryKey: ['jobs', 'latest'],
    queryFn: async () => {
      const res = await api.get('/jobs/latest')
      return res.data
    },
    refetchInterval: 2000, // live refresh
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-600 border-t-emerald-400 rounded-full mx-auto mb-4"></div>
          <p className="text-slate-300 font-mono">Loading threat intelligence...</p>
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
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-emerald-500/20 rounded-lg">
            <Fingerprint className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Dashboard
            </h1>
            <p className="text-gray-600 text-sm">
              System overview and threat intelligence metrics
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 bg-gray-100">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total IOCs */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-gray-500">Total IOCs</p>
                  <p className="text-2xl font-mono font-bold text-gray-900">
                    {stats?.total_iocs?.toLocaleString() || 0}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-gray-400" />
              </div>
            </div>

            {/* Last 7 Days */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-gray-500">Last 7 Days</p>
                  <p className="text-2xl font-mono font-bold text-gray-900">
                    {stats?.last_7d_iocs?.toLocaleString() || 0}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-gray-400" />
              </div>
            </div>

            {/* High Risk */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-gray-500">High Risk</p>
                  <p className="text-2xl font-mono font-bold text-red-600">
                    {(stats?.risk_bands?.['High'] || 0) + (stats?.risk_bands?.['Critical'] || 0)}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>

            {/* Providers */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-gray-500">Active Providers</p>
                  <p className="text-2xl font-mono font-bold text-gray-900">
                    {stats?.providers_configured_count ?? 0}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Job Status */}
          {latestJob && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-gray-500">Latest Enrichment Job</p>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="font-mono text-gray-900">Job #{latestJob.job.id}</span>
                    <span className={`px-2 py-0.5 text-xs font-mono rounded capitalize ${latestJob.job.status === 'running' ? 'bg-amber-100 text-amber-800' : latestJob.job.status === 'done' ? 'bg-emerald-100 text-emerald-800' : latestJob.job.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                      {latestJob.job.status}
                    </span>
                  </div>
                  <div className="mt-3 w-full bg-gray-100 h-2 rounded">
                    <div className="h-2 bg-emerald-500 rounded" style={{ width: `${Math.min(100, latestJob.progress_percentage || 0)}%` }} />
                  </div>
                  <p className="text-xs font-mono text-gray-600 mt-1">
                    {latestJob.job.processed_iocs}/{latestJob.job.total_iocs} processed
                    {latestJob.job.error_message ? ` · ${latestJob.job.error_message}` : ''}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-gray-400" />
              </div>
            </div>
          )}

          {/* Risk Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-mono font-bold text-gray-900 mb-4">
                Risk Distribution
              </h3>
              <div className="space-y-3">
                {Object.entries(stats?.risk_bands || {}).map(([band, count]) => (
                  <div key={band} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${riskBandColors[band as keyof typeof riskBandColors] || 'bg-gray-400'}`}></div>
                      <span className="font-mono text-sm text-gray-700">{band}</span>
                    </div>
                    <span className="font-mono font-bold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-mono font-bold text-gray-900 mb-4">
                IOC Types
              </h3>
              <div className="space-y-3">
                {Object.entries(stats?.ioc_types || {}).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="font-mono text-sm capitalize text-gray-700">{type}</span>
                    <span className="font-mono font-bold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Attribution Insights */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-mono font-bold text-gray-900 mb-4">
              Attribution Insights
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(stats?.attribution_by_provider || {}).map(([provider, vals]) => (
                <div key={provider} className="text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Shield className="h-6 w-6 text-gray-600" />
                  </div>
                  <p className="font-mono text-sm text-gray-600 capitalize">{provider}</p>
                  <p className="font-mono text-xs text-gray-500">Actors</p>
                  <p className="font-mono font-bold text-gray-900">{vals.actors}</p>
                  <p className="font-mono text-xs text-gray-500 mt-1">Families</p>
                  <p className="font-mono font-bold text-gray-900">{vals.families}</p>
                  {(() => {
                    const list = stats?.attribution_samples?.actors?.[provider] ?? []
                    return list.length > 0 ? (
                      <div className="mt-2 text-xs text-gray-500">
                        <span className="font-mono">Top actors: </span>
                        <span className="font-mono">
                          {list.slice(0,3).map(a => a.name).join(', ')}
                          {list.length > 3 ? ', …' : ''}
                        </span>
                      </div>
                    ) : null
                  })()}
                  {(() => {
                    const list = stats?.attribution_samples?.families?.[provider] ?? []
                    return list.length > 0 ? (
                      <div className="mt-1 text-xs text-gray-500">
                        <span className="font-mono">Top families: </span>
                        <span className="font-mono">
                          {list.slice(0,3).map(f => f.name).join(', ')}
                          {list.length > 3 ? ', …' : ''}
                        </span>
                      </div>
                    ) : null
                  })()}
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="font-mono text-sm text-gray-700">
                Unique actors last 7 days: <span className="font-bold text-gray-900">{stats?.unique_actors_7d_count ?? 0}</span>
              </p>
              {stats?.unique_actors_7d && stats.unique_actors_7d.length > 0 && (
                <p className="mt-2 text-xs font-mono text-gray-500 truncate">
                  {stats.unique_actors_7d.slice(0, 10).join(', ')}{(stats.unique_actors_7d.length > 10) ? ', …' : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}