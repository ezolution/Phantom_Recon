import { useQuery } from '@tanstack/react-query'
import { Activity, BarChart2, PieChart, LineChart } from 'lucide-react'
import { api } from '../lib/api'

type AnalyticsData = {
  trend_7d: { date: string; count: number }[]
  verdicts: Record<string, number>
  pending_iocs: number
  sources: { source: string; count: number }[]
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

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm md:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">IOC Trend (7 days)</p>
                <LineChart className="h-5 w-5 text-gray-400" />
              </div>
              <div className="flex items-end space-x-3 h-32">
                {data?.trend_7d?.map((d) => (
                  <div key={d.date} className="flex-1 text-center">
                    <div className="bg-emerald-500/70 mx-auto" style={{ height: `${Math.min(100, (d.count || 0) * 10)}%`, width: '16px' }}></div>
                    <div className="text-[10px] text-gray-500 mt-1 font-mono">{d.date.slice(5)}</div>
                  </div>
                ))}
                {(!data || data.trend_7d?.length === 0) && (
                  <div className="text-gray-400 font-mono">No data</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-mono text-gray-500">Verdict Distribution</p>
                <PieChart className="h-5 w-5 text-gray-400" />
              </div>
              <div className="space-y-2">
                {Object.entries(data?.verdicts || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="font-mono text-sm capitalize text-gray-700">{k}</span>
                    <span className="font-mono font-bold text-gray-900">{v}</span>
                  </div>
                ))}
                {(!data || Object.keys(data?.verdicts || {}).length === 0) && (
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
        </div>
        {isLoading && (
          <div className="fixed bottom-4 right-4 text-xs text-gray-500 font-mono">Refreshing…</div>
        )}
      </div>
    </div>
  )
}


