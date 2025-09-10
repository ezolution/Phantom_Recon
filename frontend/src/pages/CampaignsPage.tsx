import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { FolderKanban, BarChart2, RefreshCw, Eye } from 'lucide-react'

type Campaign = {
  campaign_id: string
  ioc_count: number
  last_seen?: string | null
}

type CampaignListResponse = {
  campaigns: Campaign[]
}

type IOC = {
  id: number
  value: string
  type: string
  classification: string
  source_platform: string
  first_seen?: string
  last_seen?: string
}

type CampaignDetailsResponse = {
  campaign_id: string
  ioc_count: number
  timeline: { date: string; count: number }[]
  iocs: IOC[]
}

export function CampaignsPage() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')

  const { data: list, isLoading: loadingList } = useQuery<CampaignListResponse>({
    queryKey: ['campaigns', 'list'],
    queryFn: async () => (await api.get('/iocs/campaigns')).data,
    refetchInterval: 10000,
  })

  const { data: details, isLoading: loadingDetails } = useQuery<CampaignDetailsResponse>({
    queryKey: ['campaigns', 'details', selectedCampaign],
    queryFn: async () => (await api.get(`/iocs/campaigns/${encodeURIComponent(selectedCampaign)}`)).data,
    enabled: !!selectedCampaign,
    refetchInterval: 10000,
  })

  const maxCount = Math.max(1, ...((details?.timeline || []).map(t => t.count || 0)))

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-emerald-500/20 rounded-lg">
            <FolderKanban className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
            <p className="text-gray-600 text-sm">IOC aggregation and timeline by campaign</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 bg-gray-100">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Campaign list */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-mono text-gray-500">Campaigns</p>
              <BarChart2 className="h-5 w-5 text-gray-400" />
            </div>
            {loadingList && <div className="text-sm text-gray-500 font-mono">Loading…</div>}
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {list?.campaigns?.map(c => (
                <button
                  key={c.campaign_id}
                  onClick={()=>setSelectedCampaign(c.campaign_id)}
                  className={`w-full text-left px-3 py-2 rounded border transition-colors ${selectedCampaign === c.campaign_id ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}
                  title={c.campaign_id}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-gray-800 truncate max-w-[75%]">{c.campaign_id}</span>
                    <span className="font-mono text-xs bg-gray-100 text-gray-900 px-2 py-0.5 rounded w-10 text-center">{c.ioc_count}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono mt-1">Last: {c.last_seen ? new Date(c.last_seen).toLocaleString() : '-'}</div>
                </button>
              ))}
              {(!list || (list.campaigns?.length || 0) === 0) && (
                <div className="text-sm text-gray-500 font-mono">No campaigns</div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            {!selectedCampaign ? (
              <div className="text-sm text-gray-500 font-mono">Select a campaign to view details</div>
            ) : loadingDetails ? (
              <div className="text-sm text-gray-500 font-mono">Loading…</div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-mono font-semibold text-gray-900">{details?.campaign_id}</h3>
                    <p className="text-xs text-gray-500 font-mono">{details?.ioc_count} IOCs</p>
                  </div>
                  <button
                    onClick={()=>window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                    className="px-3 py-1.5 bg-gray-800 text-white rounded-md text-xs flex items-center space-x-1 hover:bg-black"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Jump to IOCs</span>
                  </button>
                </div>

                {/* Timeline */}
                <div>
                  <p className="text-sm font-mono text-gray-500 mb-2">Timeline</p>
                  <div className="flex items-end space-x-2 h-32">
                    {details?.timeline?.map(t => {
                      const pct = Math.round(((t.count || 0) / maxCount) * 100)
                      const barPct = Math.max(5, pct)
                      return (
                        <div key={t.date} className="text-center">
                          <div className="h-24 flex items-end justify-center">
                            <div className="bg-emerald-500/70 rounded" style={{ height: `${(t.count||0) === 0 ? 2 : barPct}%`, width: '14px' }} />
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1 font-mono">{String(t.date).slice(5)}</div>
                        </div>
                      )
                    })}
                    {(!details || (details.timeline?.length || 0) === 0) && (
                      <div className="text-gray-400 font-mono">No data</div>
                    )}
                  </div>
                </div>

                {/* IOCs table */}
                <div>
                  <p className="text-sm font-mono text-gray-500 mb-2">IOCs</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-mono table-fixed">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 text-gray-500 w-64">IOC</th>
                          <th className="text-left py-2 text-gray-500 w-20">Type</th>
                          <th className="text-left py-2 text-gray-500 w-40">Source</th>
                          <th className="text-left py-2 text-gray-500 w-40">First Seen</th>
                          <th className="text-left py-2 text-gray-500 w-40">Last Seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details?.iocs?.map(i => (
                          <tr key={i.id} className="border-b border-gray-200">
                            <td className="py-2 text-gray-900 truncate max-w-[240px] break-all">{i.value}</td>
                            <td className="py-2 text-gray-900 capitalize whitespace-nowrap">{i.type}</td>
                            <td className="py-2 text-gray-900 truncate whitespace-nowrap max-w-[200px]">{i.source_platform}</td>
                            <td className="py-2 text-gray-900 whitespace-nowrap">{i.first_seen ? new Date(i.first_seen).toLocaleString() : '-'}</td>
                            <td className="py-2 text-gray-900 whitespace-nowrap">{i.last_seen ? new Date(i.last_seen).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                        {(!details || (details.iocs?.length || 0) === 0) && (
                          <tr><td className="py-4 text-gray-500" colSpan={5}>No IOCs</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


