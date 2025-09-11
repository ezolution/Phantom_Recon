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

type HeatmapData = {
  dates: string[]
  actors: string[]
  sources: string[]
  entries: { date: string; actor: string; source: string; count: number }[]
  window_days: number
}

type TrendingData = {
  dates: string[]
  actor_series: { name: string; data: number[] }[]
  campaign_series: { name: string; data: number[] }[]
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

  const { data: heatmap } = useQuery<HeatmapData>({
    queryKey: ['stats', 'heatmap'],
    queryFn: async () => (await api.get('/stats/heatmap?days=14&top_actors=10&top_sources=5')).data,
    refetchInterval: 10000,
  })

  const { data: trending } = useQuery<TrendingData>({
    queryKey: ['stats', 'trending'],
    queryFn: async () => (await api.get('/stats/trending?days=30&top_actors=5&top_campaigns=5')).data,
    refetchInterval: 10000,
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
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                <p className="text-xs font-mono text-gray-500 mb-2">By Campaign</p>
                <div className="space-y-2 mb-4">
                  {data?.clusters_recent?.by_campaign_72h?.map((c) => (
                    <div key={c.campaign_id} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm text-gray-700 truncate max-w-[85%]" title={c.campaign_id}>{c.campaign_id}</span>
                      <span className="font-mono text-xs bg-gray-100 text-gray-900 px-2 py-0.5 rounded w-8 text-center shrink-0">{c.count}</span>
                    </div>
                  ))}
                  {(!data || (data?.clusters_recent?.by_campaign_72h?.length || 0) === 0) && (
                    <div className="text-gray-400 font-mono">No data</div>
                  )}
                </div>
                <p className="text-xs font-mono text-gray-500 mb-2">By Source</p>
                <div className="space-y-2">
                  {data?.clusters_recent?.by_source_72h?.map((s) => (
                    <div key={s.source} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm text-gray-700 truncate max-w-[85%]" title={s.source}>{s.source || '-'}</span>
                      <span className="font-mono text-xs bg-gray-100 text-gray-900 px-2 py-0.5 rounded w-8 text-center shrink-0">{s.count}</span>
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
            {/* Trending (30d) */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Actor Trending (30d)</p>
                <LineChart className="h-5 w-5 text-gray-400" />
              </div>
              {!trending || trending.actor_series.length === 0 ? (
                <div className="text-gray-400 font-mono">No data</div>
              ) : (
                <div className="space-y-2">
                  {trending.actor_series.map((s, idx) => (
                    <div key={idx}>
                      <div className="text-xs text-gray-700 font-mono mb-1 truncate" title={s.name}>{s.name}</div>
                      <div className="flex items-end h-16 space-x-1">
                        {s.data.map((v, i) => {
                          const pct = trending.dates.length ? Math.min(100, Math.round((v / Math.max(1, Math.max(...s.data))) * 100)) : 0
                          return <div key={i} className="bg-emerald-500/70" style={{ width: '4px', height: `${Math.max(2, pct)}%` }} />
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Campaign Trending (30d)</p>
                <LineChart className="h-5 w-5 text-gray-400" />
              </div>
              {!trending || trending.campaign_series.length === 0 ? (
                <div className="text-gray-400 font-mono">No data</div>
              ) : (
                <div className="space-y-2">
                  {trending.campaign_series.map((s, idx) => (
                    <div key={idx}>
                      <div className="text-xs text-gray-700 font-mono mb-1 truncate" title={s.name}>{s.name}</div>
                      <div className="flex items-end h-16 space-x-1">
                        {s.data.map((v, i) => {
                          const pct = trending.dates.length ? Math.min(100, Math.round((v / Math.max(1, Math.max(...s.data))) * 100)) : 0
                          return <div key={i} className="bg-sky-500/70" style={{ width: '4px', height: `${Math.max(2, pct)}%` }} />
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Actor x Source x Time Heatmap */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Actor x Source Heatmap (14d)</p>
                <BarChart2 className="h-5 w-5 text-gray-400" />
              </div>
              {!heatmap || heatmap.actors.length === 0 ? (
                <div className="text-gray-400 font-mono">No data</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr>
                        <th className="text-left py-1 pr-2 text-gray-500">Actor \ Source</th>
                        {heatmap.sources.map((s) => (
                          <th key={s} className="text-left py-1 px-2 text-gray-700">{s}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.actors.map((a) => (
                        <tr key={a} className="border-t border-gray-100">
                          <td className="py-1 pr-2 text-gray-800 truncate max-w-[200px]" title={a}>{a}</td>
                          {heatmap.sources.map((s) => {
                            // sum counts for this actor+source over dates
                            const total = (heatmap.entries || []).filter(e => e.actor===a && e.source===s).reduce((acc, e)=>acc+e.count, 0)
                            const intensity = Math.min(100, total * 10) // simple scale
                            return (
                              <td key={s} className="py-1 px-2">
                                <div className="w-8 h-4 rounded" style={{ backgroundColor: `rgba(16,185,129,${0.15 + Math.min(0.85, intensity/100)})` }} title={`${total} hits`} />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

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


