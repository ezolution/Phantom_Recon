import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Copy,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bug,
  Fingerprint,
  Terminal
} from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface IOC {
  id: number
  value: string
  type: string
  classification: string
  source_platform: string
  email_id?: string
  campaign_id?: string
  user_reported: boolean
  first_seen?: string
  last_seen?: string
  notes?: string
  created_at: string
  updated_at: string
  latest_score?: {
    risk_score: number
    attribution_score: number
    risk_band: string
  }
  enrichment_results?: Array<{
    provider: string
    verdict: string
    confidence?: number
    evidence?: string
    first_seen?: string
    last_seen?: string
    raw_json?: any
  }>
  tags?: Array<{
    name: string
    kind: string
  }>
}

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedRisk, setSelectedRisk] = useState('')
  const [selectedProvider] = useState('')
  const [selectedClassification, setSelectedClassification] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [firstSeenFrom, setFirstSeenFrom] = useState('')
  const [lastSeenTo, setLastSeenTo] = useState('')
  const [page] = useState(1)
  const [selectedIOC, setSelectedIOC] = useState<IOC | null>(null)

  const { data: iocs, isLoading } = useQuery<IOC[]>({
    queryKey: ['iocs', searchQuery, selectedType, selectedRisk, selectedProvider, selectedClassification, selectedSource, firstSeenFrom, lastSeenTo, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchQuery) params.append('q', searchQuery)
      if (selectedType) params.append('type', selectedType)
      if (selectedRisk) params.append('risk_band', selectedRisk)
      if (selectedProvider) params.append('provider', selectedProvider)
      if (selectedClassification) params.append('classification', selectedClassification)
      if (selectedSource) params.append('source_platform', selectedSource)
      if (firstSeenFrom) params.append('first_seen_from', firstSeenFrom)
      if (lastSeenTo) params.append('last_seen_to', lastSeenTo)
      params.append('page', page.toString())
      params.append('page_size', '50')

      const response = await api.get(`/iocs/?${params}`)
      return response.data
    },
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const formatDateTime = (iso?: string) => {
    if (!iso) return undefined
    try {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso
      return d.toLocaleString()
    } catch {
      return iso
    }
  }

  const getRiskColor = (riskBand: string) => {
    switch (riskBand) {
      case 'Low': return 'risk-low'
      case 'Medium': return 'risk-medium'
      case 'High': return 'risk-high'
      case 'Critical': return 'risk-critical'
      default: return 'text-slate-400'
    }
  }

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'malicious': return <XCircle className="h-4 w-4 text-red-400" />
      case 'suspicious': return <AlertTriangle className="h-4 w-4 text-yellow-400" />
      case 'benign': return <CheckCircle className="h-4 w-4 text-emerald-400" />
      default: return <Shield className="h-4 w-4 text-slate-400" />
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-emerald-500/20 rounded-lg">
            <Bug className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              IOC Search
            </h1>
            <p className="text-gray-600 text-sm">
              Search and analyze enriched IOC data
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 bg-gray-100">
        <div className="max-w-7xl mx-auto space-y-6">

      {/* Search and Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Search */}
          <div className="xl:col-span-2">
            <label className="block text-sm font-mono text-gray-700 mb-2">
              Search Query
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Search IOCs, emails, campaigns..."
              />
            </div>
          </div>

          {/* IOC Type */}
          <div>
            <label className="block text-sm font-mono text-gray-700 mb-2">
              IOC Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              <option value="url">URL</option>
              <option value="domain">Domain</option>
              <option value="ipv4">IPv4</option>
              <option value="sha256">SHA256</option>
              <option value="md5">MD5</option>
              <option value="email">Email</option>
              <option value="subject_keyword">Subject Keyword</option>
            </select>
          </div>

          {/* Risk Band */}
          <div>
            <label className="block text-sm font-mono text-gray-700 mb-2">
              Risk Band
            </label>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">All Risks</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          {/* Classification */}
          <div>
            <label className="block text-sm font-mono text-gray-700 mb-2">
              Classification
            </label>
            <select
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">All Classifications</option>
              <option value="malicious">Malicious</option>
              <option value="suspicious">Suspicious</option>
              <option value="benign">Benign</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          {/* Source Platform */}
          <div>
            <label className="block text-sm font-mono text-gray-700 mb-2">
              Source Platform
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">All Sources</option>
              <option value="EOP">EOP</option>
              <option value="Abnormal">Abnormal</option>
            </select>
          </div>
          {/* First Seen From */}
          <div>
            <label className="block text-sm font-mono text-gray-700 mb-2">
              First Seen From
            </label>
            <input
              type="datetime-local"
              value={firstSeenFrom}
              onChange={(e) => setFirstSeenFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          {/* Last Seen To */}
          <div>
            <label className="block text-sm font-mono text-gray-700 mb-2">
              Last Seen To
            </label>
            <input
              type="datetime-local"
              value={lastSeenTo}
              onChange={(e) => setLastSeenTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-sm font-mono text-gray-600">
            <Filter className="h-4 w-4" />
            <span>Active filters: {[selectedType, selectedRisk, selectedClassification, selectedSource].filter(Boolean).length}</span>
          </div>
          <button className="px-4 py-2 bg-gray-700 text-gray-200 border border-gray-600 font-medium rounded-md hover:bg-gray-600 transition-colors">
            <Download className="h-4 w-4 mr-2 inline" />
            Export Results
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-slate-600 border-t-emerald-400 rounded-full mx-auto mb-4"></div>
              <p className="text-slate-300 font-mono">Searching threat intelligence...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono table-fixed">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 text-slate-300 w-64">IOC</th>
                  <th className="text-left py-3 text-slate-300 w-24">Type</th>
                  <th className="text-left py-3 text-slate-300 w-24">Risk</th>
                  <th className="text-left py-3 text-slate-300 w-28">Verdicts</th>
                  <th className="text-left py-3 text-slate-300 w-40">Source</th>
                  <th className="text-left py-3 text-slate-300 w-64">Campaign</th>
                  <th className="text-left py-3 text-slate-300 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {iocs?.map((ioc) => (
                  <tr key={ioc.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-900 truncate max-w-[220px] break-all">{ioc.value}</span>
                        <button
                          onClick={() => copyToClipboard(ioc.value)}
                          className="text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 text-gray-900 capitalize whitespace-nowrap">{ioc.type}</td>
                    <td className="py-3">
                      {ioc.latest_score ? (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getRiskColor(ioc.latest_score.risk_band)}`}>
                          {ioc.latest_score.risk_band}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-mono bg-amber-100 text-amber-800">pending</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center space-x-1">
                        {ioc.enrichment_results?.slice(0, 3).map((result, index) => (
                          <div key={index} title={`${result.provider}: ${result.verdict}`}>
                            {getVerdictIcon(result.verdict)}
                          </div>
                        ))}
                        {(!ioc.enrichment_results || ioc.enrichment_results.length === 0) && (
                          <span className="text-xs text-slate-400">no results yet</span>
                        )}
                        {ioc.enrichment_results && ioc.enrichment_results.length > 3 && (
                          <span className="text-xs text-slate-400">
                            +{ioc.enrichment_results.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-gray-900 truncate whitespace-nowrap max-w-[160px]">{ioc.source_platform}</td>
                    <td className="py-3 text-gray-900 truncate whitespace-nowrap max-w-[240px]">{ioc.campaign_id || '-'}</td>
                    <td className="py-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedIOC(ioc)}
                          className="btn-secondary text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </button>
                        <button
                          onClick={async ()=>{ await api.post(`/iocs/${ioc.id}/re-enrich`); toast.success('Re-enrichment started'); }}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                          Re-enrich
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!iocs || iocs.length === 0) && (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 font-mono">No IOCs found matching your criteria</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* IOC Details Drawer */}
      {selectedIOC && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-emerald-500/30 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-mono font-bold text-emerald-400">
                  IOC Details
                </h3>
                <button
                  onClick={() => setSelectedIOC(null)}
                  className="text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Overview */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-mono font-bold text-emerald-400 mb-2">Overview</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Value:</span>
                        <span className="text-white font-mono break-all">{selectedIOC.value}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Type:</span>
                        <span className="text-white capitalize">{selectedIOC.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Classification:</span>
                        <span className="text-white capitalize">{selectedIOC.classification}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Source:</span>
                        <span className="text-white truncate whitespace-nowrap max-w-[60%]">{selectedIOC.source_platform}</span>
                      </div>
                      {(selectedIOC.first_seen || selectedIOC.last_seen) && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">IOC First Seen:</span>
                            <span className="text-white">{formatDateTime(selectedIOC.first_seen) || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">IOC Last Seen:</span>
                            <span className="text-white">{formatDateTime(selectedIOC.last_seen) || '-'}</span>
                          </div>
                        </div>
                      )}
                      {selectedIOC.campaign_id && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Campaign:</span>
                          <span className="text-white break-words max-w-[60%] text-right">{selectedIOC.campaign_id}</span>
                        </div>
                      )}
                      {/* Forensic summary inline */}
                      {(() => {
                        const forensic = selectedIOC.enrichment_results?.find(r => r.provider === 'forensic' && r.raw_json)
                        if (!forensic || !forensic.raw_json) return null
                        const f = forensic.raw_json as any
                        const hasDomainBits = !!(f.registrar || f.registered_on || f.registrar_age_days)
                        const hasIpBits = !!(f.asn || f.org || f.country || f.city || f.rdns)
                        if (!hasDomainBits && !hasIpBits) return null
                        return (
                          <div className="mt-2 pt-2 border-t border-slate-700">
                            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Forensics</div>
                            <div className="space-y-1">
                              {f.registrar && (
                                <div className="flex justify-between"><span className="text-slate-400">Registrar:</span><span className="text-white">{f.registrar}</span></div>
                              )}
                              {f.registered_on && (
                                <div className="flex justify-between"><span className="text-slate-400">Registered:</span><span className="text-white">{formatDateTime(f.registered_on)}</span></div>
                              )}
                              {typeof f.registrar_age_days === 'number' && (
                                <div className="flex justify-between"><span className="text-slate-400">Domain Age:</span><span className="text-white">{f.registrar_age_days} days</span></div>
                              )}
                              {(f.asn || f.org) && (
                                <div className="flex justify-between"><span className="text-slate-400">ASN/Org:</span><span className="text-white">{f.asn || '-'} / {f.org || '-'}</span></div>
                              )}
                              {(f.country || f.city) && (
                                <div className="flex justify-between"><span className="text-slate-400">Geo:</span><span className="text-white">{f.country || '-'}{f.city ? ', ' + f.city : ''}</span></div>
                              )}
                              {f.rdns && (
                                <div className="flex justify-between"><span className="text-slate-400">rDNS:</span><span className="text-white break-all max-w-[60%] text-right">{f.rdns}</span></div>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Risk Score */}
                  {selectedIOC.latest_score && (
                    <div>
                      <h4 className="font-mono font-bold text-emerald-400 mb-2">Risk Assessment</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Risk Score:</span>
                          <span className="text-white font-mono">{selectedIOC.latest_score.risk_score}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Attribution Score:</span>
                          <span className="text-white font-mono">{selectedIOC.latest_score.attribution_score}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Risk Band:</span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${getRiskColor(selectedIOC.latest_score.risk_band)}`}>
                            {selectedIOC.latest_score.risk_band}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Provider Results */}
                <div>
                  <h4 className="font-mono font-bold text-emerald-400 mb-2">Provider Analysis</h4>
                  <div className="space-y-3">
                    {selectedIOC.enrichment_results?.map((result, index) => (
                      <div key={index} className="bg-slate-700/50 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm text-emerald-400 capitalize">{result.provider}</span>
                          <div className="flex items-center space-x-2">
                            {getVerdictIcon(result.verdict)}
                            <span className="text-xs text-white capitalize">{result.verdict}</span>
                          </div>
                        </div>
                        {(result.first_seen || result.last_seen) && (
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 mb-1">
                            <div>
                              <span className="text-slate-400 mr-1">First seen:</span>
                              <span>{formatDateTime(result.first_seen) || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 mr-1">Last seen:</span>
                              <span>{formatDateTime(result.last_seen) || '-'}</span>
                            </div>
                          </div>
                        )}
                        {result.confidence && (
                          <div className="text-xs text-slate-400 mb-1">
                            Confidence: {result.confidence}%
                          </div>
                        )}
                        {result.evidence && (
                          <div className="text-xs text-slate-300 break-words">
                            {result.evidence}
                          </div>
                        )}
                        {result.provider === 'forensic' && result.raw_json && (
                          <div className="mt-1 text-[11px] text-slate-300 space-y-1">
                            {result.raw_json.registrar && (
                              <div>Registrar: <span className="text-white">{result.raw_json.registrar}</span></div>
                            )}
                            {result.raw_json.registered_on && (
                              <div>Registered: <span className="text-white">{formatDateTime(result.raw_json.registered_on)}</span></div>
                            )}
                            {(result.raw_json.asn || result.raw_json.org) && (
                              <div>ASN/Org: <span className="text-white">{result.raw_json.asn || '-'} / {result.raw_json.org || '-'}</span></div>
                            )}
                            {(result.raw_json.country || result.raw_json.city) && (
                              <div>Geo: <span className="text-white">{result.raw_json.country || '-'}{result.raw_json.city ? ', ' + result.raw_json.city : ''}</span></div>
                            )}
                            {result.raw_json.rdns && (
                              <div>rDNS: <span className="text-white break-all">{result.raw_json.rdns}</span></div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tags */}
              {selectedIOC.tags && selectedIOC.tags.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-mono font-bold text-emerald-400 mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIOC.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-emerald-400/20 text-emerald-400 text-xs font-mono rounded"
                      >
                        {tag.name} ({tag.kind})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  )
}
