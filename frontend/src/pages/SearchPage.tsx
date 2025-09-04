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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Browse Saved IOCs</h1>
      </div>

      {/* Search Controls */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-green-400"
            placeholder="Search value..."
          />
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 focus:outline-none focus:border-green-400"
        >
          <option value="">All types</option>
          <option value="url">URL</option>
          <option value="domain">Domain</option>
          <option value="ipv4">IPv4</option>
          <option value="sha256">SHA256</option>
          <option value="md5">MD5</option>
          <option value="email">Email</option>
        </select>
        <button className="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors">
          Search
        </button>
        <button className="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors">
          Export CSV
        </button>
      </div>

      {/* Results Table */}
      <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-300">Searching threat intelligence...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto h-full">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left py-3 px-4 text-green-400 font-medium">IOC</th>
                  <th className="text-left py-3 px-4 text-green-400 font-medium">TYPE</th>
                  <th className="text-left py-3 px-4 text-green-400 font-medium">STATUS</th>
                  <th className="text-left py-3 px-4 text-green-400 font-medium">FIRST SEEN</th>
                </tr>
              </thead>
              <tbody>
                {iocs?.map((ioc, index) => (
                  <tr 
                    key={ioc.id} 
                    className={`border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer ${
                      selectedIOC?.id === ioc.id ? 'bg-blue-500/20 border-l-4 border-l-blue-400' : ''
                    }`}
                    onClick={() => setSelectedIOC(ioc)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-400 font-mono truncate max-w-xs">{ioc.value}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            copyToClipboard(ioc.value)
                          }}
                          className="text-gray-400 hover:text-green-400 transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-300 capitalize">{ioc.type}</td>
                    <td className="py-3 px-4 text-gray-300">enriched</td>
                    <td className="py-3 px-4 text-gray-300">
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
                  </tr>
                ))}
              </tbody>
            </table>

            {(!iocs || iocs.length === 0) && (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No IOCs found matching your criteria</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* IOC Details Panel */}
      {selectedIOC && (
        <div className="w-96 bg-gray-800 border-l border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-green-400">{selectedIOC.value}</h3>
            <button
              onClick={() => setSelectedIOC(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
          
          <div className="mb-4">
            <p className="text-sm text-gray-400">{selectedIOC.type} • enriched</p>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 mb-4">
            <button className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm">virustotal</button>
            <button className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm">virustotal:comments</button>
            <button className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm">virustotal:relations</button>
          </div>

          {/* Raw Details */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Raw details</h4>
            <div className="bg-gray-900 rounded p-4 font-mono text-xs overflow-auto max-h-96">
              <pre className="text-gray-300">
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
