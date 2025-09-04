import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Copy,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle
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
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedClassification, setSelectedClassification] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIOC, setSelectedIOC] = useState<IOC | null>(null)

  const { data: iocs, isLoading } = useQuery<IOC[]>({
    queryKey: ['iocs', searchQuery, selectedType, selectedRisk, selectedProvider, selectedClassification, selectedSource, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchQuery) params.append('q', searchQuery)
      if (selectedType) params.append('type', selectedType)
      if (selectedRisk) params.append('risk_band', selectedRisk)
      if (selectedProvider) params.append('provider', selectedProvider)
      if (selectedClassification) params.append('classification', selectedClassification)
      if (selectedSource) params.append('source_platform', selectedSource)
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

  const getRiskColor = (riskBand: string) => {
    switch (riskBand) {
      case 'Low': return 'risk-low'
      case 'Medium': return 'risk-medium'
      case 'High': return 'risk-high'
      case 'Critical': return 'risk-critical'
      default: return 'text-blackhat-400'
    }
  }

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'malicious': return <XCircle className="h-4 w-4 text-neon-red" />
      case 'suspicious': return <AlertTriangle className="h-4 w-4 text-neon-yellow" />
      case 'benign': return <CheckCircle className="h-4 w-4 text-neon-green" />
      default: return <Shield className="h-4 w-4 text-blackhat-400" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-mono font-bold text-neon-green glow-text">
          Search & History
        </h1>
        <p className="text-blackhat-400 font-mono mt-1">
          Search and analyze enriched IOCs with detailed threat intelligence
        </p>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Search */}
          <div className="xl:col-span-2">
            <label className="block text-sm font-mono text-neon-green mb-2">
              Search Query
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blackhat-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field w-full pl-10"
                placeholder="Search IOCs, emails, campaigns..."
              />
            </div>
          </div>

          {/* IOC Type */}
          <div>
            <label className="block text-sm font-mono text-neon-green mb-2">
              IOC Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="input-field w-full"
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
            <label className="block text-sm font-mono text-neon-green mb-2">
              Risk Band
            </label>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="input-field w-full"
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
            <label className="block text-sm font-mono text-neon-green mb-2">
              Classification
            </label>
            <select
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              className="input-field w-full"
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
            <label className="block text-sm font-mono text-neon-green mb-2">
              Source Platform
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="input-field w-full"
            >
              <option value="">All Sources</option>
              <option value="EOP">EOP</option>
              <option value="Abnormal">Abnormal</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-blackhat-700">
          <div className="flex items-center space-x-2 text-sm font-mono text-blackhat-400">
            <Filter className="h-4 w-4" />
            <span>Active filters: {[selectedType, selectedRisk, selectedClassification, selectedSource].filter(Boolean).length}</span>
          </div>
          <button className="btn-secondary">
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="terminal-text">Searching threat intelligence...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-blackhat-700">
                  <th className="text-left py-3 text-neon-green">IOC</th>
                  <th className="text-left py-3 text-neon-green">Type</th>
                  <th className="text-left py-3 text-neon-green">Risk</th>
                  <th className="text-left py-3 text-neon-green">Verdicts</th>
                  <th className="text-left py-3 text-neon-green">Source</th>
                  <th className="text-left py-3 text-neon-green">Campaign</th>
                  <th className="text-left py-3 text-neon-green">Actions</th>
                </tr>
              </thead>
              <tbody>
                {iocs?.map((ioc) => (
                  <tr key={ioc.id} className="border-b border-blackhat-800 hover:bg-blackhat-800/30">
                    <td className="py-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-white truncate max-w-xs">{ioc.value}</span>
                        <button
                          onClick={() => copyToClipboard(ioc.value)}
                          className="text-blackhat-400 hover:text-neon-green transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 text-white capitalize">{ioc.type}</td>
                    <td className="py-3">
                      {ioc.latest_score && (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getRiskColor(ioc.latest_score.risk_band)}`}>
                          {ioc.latest_score.risk_band}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center space-x-1">
                        {ioc.enrichment_results?.slice(0, 3).map((result, index) => (
                          <div key={index} title={`${result.provider}: ${result.verdict}`}>
                            {getVerdictIcon(result.verdict)}
                          </div>
                        ))}
                        {ioc.enrichment_results && ioc.enrichment_results.length > 3 && (
                          <span className="text-xs text-blackhat-400">
                            +{ioc.enrichment_results.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-white">{ioc.source_platform}</td>
                    <td className="py-3 text-white">{ioc.campaign_id || '-'}</td>
                    <td className="py-3">
                      <button
                        onClick={() => setSelectedIOC(ioc)}
                        className="btn-secondary text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!iocs || iocs.length === 0) && (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-blackhat-600 mx-auto mb-4" />
                <p className="text-blackhat-400 font-mono">No IOCs found matching your criteria</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* IOC Details Drawer */}
      {selectedIOC && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-blackhat-900 border border-neon-green/30 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-mono font-bold text-neon-green">
                  IOC Details
                </h3>
                <button
                  onClick={() => setSelectedIOC(null)}
                  className="text-blackhat-400 hover:text-neon-green transition-colors"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Overview */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-mono font-bold text-neon-green mb-2">Overview</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blackhat-400">Value:</span>
                        <span className="text-white font-mono">{selectedIOC.value}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blackhat-400">Type:</span>
                        <span className="text-white capitalize">{selectedIOC.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blackhat-400">Classification:</span>
                        <span className="text-white capitalize">{selectedIOC.classification}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blackhat-400">Source:</span>
                        <span className="text-white">{selectedIOC.source_platform}</span>
                      </div>
                      {selectedIOC.campaign_id && (
                        <div className="flex justify-between">
                          <span className="text-blackhat-400">Campaign:</span>
                          <span className="text-white">{selectedIOC.campaign_id}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Risk Score */}
                  {selectedIOC.latest_score && (
                    <div>
                      <h4 className="font-mono font-bold text-neon-green mb-2">Risk Assessment</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blackhat-400">Risk Score:</span>
                          <span className="text-white font-mono">{selectedIOC.latest_score.risk_score}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blackhat-400">Attribution Score:</span>
                          <span className="text-white font-mono">{selectedIOC.latest_score.attribution_score}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blackhat-400">Risk Band:</span>
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
                  <h4 className="font-mono font-bold text-neon-green mb-2">Provider Analysis</h4>
                  <div className="space-y-3">
                    {selectedIOC.enrichment_results?.map((result, index) => (
                      <div key={index} className="bg-blackhat-800/50 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm text-neon-green capitalize">{result.provider}</span>
                          <div className="flex items-center space-x-2">
                            {getVerdictIcon(result.verdict)}
                            <span className="text-xs text-white capitalize">{result.verdict}</span>
                          </div>
                        </div>
                        {result.confidence && (
                          <div className="text-xs text-blackhat-400 mb-1">
                            Confidence: {result.confidence}%
                          </div>
                        )}
                        {result.evidence && (
                          <div className="text-xs text-blackhat-300">
                            {result.evidence}
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
                  <h4 className="font-mono font-bold text-neon-green mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIOC.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-neon-green/20 text-neon-green text-xs font-mono rounded"
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
  )
}
