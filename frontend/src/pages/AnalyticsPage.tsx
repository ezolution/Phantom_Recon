import { useQuery } from '@tanstack/react-query'
import { Activity, BarChart2, PieChart, LineChart, Target, Users, Shield } from 'lucide-react'
import { api } from '../lib/api'

type AnalyticsData = {
  trend_7d: { date: string; count: number }[]
  risk_bands: Record<string, number>
  pending_iocs: number
  sources: { source: string; count: number }[]
  targeting_signal?: number
  unique_actors_48h?: number
  clusters_recent?: {
    by_campaign_72h: { campaign_id: string; count: number }[]
    by_source_72h: { source: string; count: number }[]
  }
  top_actors_7d?: { name: string; count: number }[]
  top_families_7d?: { name: string; count: number }[]
}

export function AnalyticsPage() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['stats', 'analytics'],
    queryFn: async () => {
      const res = await api.get('/stats/analytics')
      return res.data
    },
    refetchInterval: 5000,
  })

  const maxTrend = Math.max(
    1,
    ...((data?.trend_7d || []).map(d => (d?.count ?? 0)))
  )

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-emerald-500/20 rounded-lg">
            <Activity className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 text-sm">Trends and distributions</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 bg-gray-100">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Pending IOCs</p>
                <BarChart2 className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-3xl font-mono font-bold text-gray-900">{data?.pending_iocs ?? 0}</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Targeting Signal</p>
                <Target className="h-5 w-5 text-gray-400" />
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1 h-3 bg-gray-200 rounded">
                  <div className="h-3 bg-red-500 rounded" style={{ width: `${Math.min(100, data?.targeting_signal ?? 0)}%` }} />
                </div>
                <div className="w-16 text-right font-mono font-bold text-gray-900">{Math.min(100, data?.targeting_signal ?? 0)}%</div>
              </div>
              <div className="text-xs text-gray-500 mt-2 font-mono">Higher means unusual activity clusters, recent actors, and campaign surges</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Unique Actors (48h)</p>
                <Users className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-3xl font-mono font-bold text-gray-900">{data?.unique_actors_48h ?? 0}</p>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm md:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">IOC Trend (7 days)</p>
                <LineChart className="h-5 w-5 text-gray-400" />
              </div>
              <div className="flex items-end space-x-3 h-32">
                {data?.trend_7d?.map((d) => {
                  const pct = Math.round(((d.count || 0) / maxTrend) * 100)
                  const barPct = Math.max(5, pct) // ensure visible bar when count>0
                  return (
                    <div key={d.date} className="flex-1 text-center">
                      <div className="h-24 flex items-end justify-center">
                        <div className="bg-emerald-500/70 rounded" style={{ height: `${(d.count||0) === 0 ? 2 : barPct}%`, width: '16px' }} />
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1 font-mono">{d.date.slice(5)}</div>
                    </div>
                  )
                })}
                {(!data || (data.trend_7d?.length || 0) === 0) && (
                  <div className="text-gray-400 font-mono">No data</div>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Recent Clusters (72h)</p>
                <Shield className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="text-xs font-mono text-gray-500 mb-2">By Campaign</p>
                <div className="space-y-2 mb-4">
                  {data?.clusters_recent?.by_campaign_72h?.map((c) => (
                    <div key={c.campaign_id} className="flex items-center justify-between">
                      <span className="font-mono text-sm text-gray-700">{c.campaign_id}</span>
                      <span className="font-mono font-bold text-gray-900">{c.count}</span>
                    </div>
                  ))}
                  {(!data || (data?.clusters_recent?.by_campaign_72h?.length || 0) === 0) && (
                    <div className="text-gray-400 font-mono">No data</div>
                  )}
                </div>
                <p className="text-xs font-mono text-gray-500 mb-2">By Source</p>
                <div className="space-y-2">
                  {data?.clusters_recent?.by_source_72h?.map((s) => (
                    <div key={s.source} className="flex items-center justify-between">
                      <span className="font-mono text-sm text-gray-700">{s.source || '-'}</span>
                      <span className="font-mono font-bold text-gray-900">{s.count}</span>
                    </div>
                  ))}
                  {(!data || (data?.clusters_recent?.by_source_72h?.length || 0) === 0) && (
                    <div className="text-gray-400 font-mono">No data</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Risk Band Distribution</p>
                <PieChart className="h-5 w-5 text-gray-400" />
              </div>
              <div className="space-y-2">
                {Object.entries(data?.risk_bands || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="font-mono text-sm capitalize text-gray-700">{k}</span>
                    <span className="font-mono font-bold text-gray-900">{v}</span>
                  </div>
                ))}
                {(!data || Object.keys(data?.risk_bands || {}).length === 0) && (
                  <div className="text-gray-400 font-mono">No data</div>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Top Sources</p>
                <BarChart2 className="h-5 w-5 text-gray-400" />
              </div>
              <div className="space-y-2">
                {data?.sources?.map((s) => (
                  <div key={s.source} className="flex items-center justify-between">
                    <span className="font-mono text-sm text-gray-700">{s.source || '-'}</span>
                    <span className="font-mono font-bold text-gray-900">{s.count}</span>
                  </div>
                ))}
                {(!data || data.sources?.length === 0) && (
                  <div className="text-gray-400 font-mono">No data</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Top Actors (7d)</p>
                <Users className="h-5 w-5 text-gray-400" />
              </div>
              <div className="space-y-2">
                {data?.top_actors_7d?.map((a) => (
                  <div key={a.name} className="flex items-center justify-between">
                    <span className="font-mono text-sm text-gray-700">{a.name}</span>
                    <span className="font-mono font-bold text-gray-900">{a.count}</span>
                  </div>
                ))}
                {(!data || (data.top_actors_7d?.length || 0) === 0) && (
                  <div className="text-gray-400 font-mono">No data</div>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Top Families (7d)</p>
                <Shield className="h-5 w-5 text-gray-400" />
              </div>
              <div className="space-y-2">
                {data?.top_families_7d?.map((a) => (
                  <div key={a.name} className="flex items-center justify-between">
                    <span className="font-mono text-sm text-gray-700">{a.name}</span>
                    <span className="font-mono font-bold text-gray-900">{a.count}</span>
                  </div>
                ))}
                {(!data || (data.top_families_7d?.length || 0) === 0) && (
                  <div className="text-gray-400 font-mono">No data</div>
                )}
              </div>
            </div>
          </div>
        </div>
        {isLoading && (
          <div className="fixed bottom-4 right-4 text-xs text-gray-500 font-mono">Refreshing…</div>
        )}
      </div>
    </div>
  )
}


