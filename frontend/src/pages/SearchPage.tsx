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
  const [page] = useState(1)
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
    <div className="h-full flex flex-col space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Browse Saved IOCs</h1>
          <p className="text-gray-400 text-lg">Search and analyze threat intelligence data</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-green-400 text-sm font-medium">System Online</span>
        </div>
      </div>

      {/* Search Controls */}
      <div className="card">
        <div className="flex items-center space-x-6">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-300 mb-2">Search Query</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full"
              placeholder="Enter IOC value, hash, or domain..."
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-semibold text-gray-300 mb-2">IOC Type</label>
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
            </select>
          </div>
          <div className="flex space-x-3">
            <button className="btn-primary">
              <Search className="h-4 w-4 mr-2" />
              Search
            </button>
            <button className="btn-secondary">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="flex-1 card">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h3 className="text-xl font-semibold text-white mb-2">Searching Threat Intelligence</h3>
              <p className="text-gray-400">Please wait while we query our databases...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto h-full">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>IOC Value</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>First Seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {iocs?.map((ioc, index) => (
                  <tr 
                    key={ioc.id} 
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedIOC?.id === ioc.id ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedIOC(ioc)}
                  >
                    <td>
                      <div className="flex items-center space-x-3">
                        <span className="text-blue-400 font-mono text-sm truncate max-w-xs">{ioc.value}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            copyToClipboard(ioc.value)
                          }}
                          className="text-gray-400 hover:text-blue-400 transition-colors p-1"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300 capitalize">
                        {ioc.type}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                        Enriched
                      </span>
                    </td>
                    <td className="text-gray-300 text-sm">
                      {new Date(ioc.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })}
                    </td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedIOC(ioc)
                        }}
                        className="btn-secondary text-xs px-3 py-1"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!iocs || iocs.length === 0) && (
              <div className="text-center py-16">
                <Shield className="h-16 w-16 text-gray-600 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-white mb-2">No IOCs Found</h3>
                <p className="text-gray-400">Try adjusting your search criteria or upload new data</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* IOC Details Panel */}
      {selectedIOC && (
        <div className="w-96 bg-gray-900 border-l border-gray-800 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">{selectedIOC.value}</h3>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300 capitalize">
                  {selectedIOC.type}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  Enriched
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedIOC(null)}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 mb-6">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">virustotal</button>
            <button className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-700">virustotal:comments</button>
            <button className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-700">virustotal:relations</button>
          </div>

          {/* Raw Details */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Raw Details</h4>
            <div className="bg-black border border-gray-800 rounded-xl p-6 font-mono text-sm overflow-auto max-h-96">
              <pre className="text-gray-300 leading-relaxed">
{`{
  "id": ${selectedIOC.id},
  "type": "${selectedIOC.type}",
  "value": "${selectedIOC.value}",
  "status": "enriched",
  "enrichments": [
    {
      "provider": "virustotal",
      "score": 2,
      "summary": "AV 2/94",
      "last_analysis_results": {
        "Acronis": {
          "method": "blacklist",
          "engine_name": "Acronis",
          "category": "harmless",
          "result": "clean"
        },
        "0xSI_f33d": {
          "method": "blacklist",
          "engine_name": "0xSI_f33d",
          "category": "harmless",
          "result": "clean"
        },
        "Abusix": {
          "method": "blacklist",
          "engine_name": "Abusix",
          "category": "harmless",
          "result": "clean"
        },
        "ADMINUSLabs": {
          "method": "blacklist",
          "engine_name": "ADMINUSLabs",
          "category": "harmless",
          "result": "clean"
        },
        "Axur": {
          "method": "blacklist",
          "engine_name": "Axur",
          "category": "harmless",
          "result": "clean"
        },
        "Criminal IP": {
          "method": "blacklist",
          "engine_name": "Criminal IP",
          "category": "harmless",
          "result": "clean"
        },
        "AILabs": {
          "method": "blacklist",
          "engine_name": "AILabs",
          "category": "harmless",
          "result": "clean"
        },
        "AlienVault": {
          "method": "blacklist",
          "engine_name": "AlienVault",
          "category": "harmless",
          "result": "clean"
        },
        "alphaMountain.ai": {
          "method": "blacklist",
          "engine_name": "alphaMountain.ai",
          "category": "harmless",
          "result": "clean"
        }
      }
    }
  ]
}`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
