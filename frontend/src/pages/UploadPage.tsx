import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Play, Shield, Terminal, Settings } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface CSVRow {
  ioc_value: string
  ioc_type: string
  email_id: string
  source_platform: string
  classification: string
  campaign_id?: string
  user_reported?: string
  first_seen?: string
  last_seen?: string
  notes?: string
}

interface UploadResponse {
  upload: {
    id: number
    filename: string
    rows_ok: number
    rows_failed: number
    total_rows: number
  }
  job_id: number
  message: string
}

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CSVRow[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [classification, setClassification] = useState('unknown')
  const queryClient = useQueryClient()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setFile(file)
      parseCSV(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    multiple: false,
  })

  const parseCSV = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      
      const rows: CSVRow[] = lines.slice(1, 51).map(line => { // Preview first 50 rows
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        const row: any = {}
        headers.forEach((header, _index) => {
          row[header] = values[_index] || ''
        })
        return row as CSVRow
      })
      
      setPreview(rows)
    }
    reader.readAsText(file)
  }

  const validateRow = (row: CSVRow, _index: number) => {
    const errors: string[] = []
    
    if (!row.ioc_value) errors.push('Missing IOC value')
    if (!row.ioc_type) errors.push('Missing IOC type')
    if (!row.email_id) errors.push('Missing email ID')
    if (!row.source_platform) errors.push('Missing source platform')
    if (!row.classification) errors.push('Missing classification')
    
    const validTypes = ['url', 'domain', 'ipv4', 'sha256', 'md5', 'email', 'subject_keyword']
    if (row.ioc_type && !validTypes.includes(row.ioc_type)) {
      errors.push('Invalid IOC type')
    }
    
    const validClassifications = ['malicious', 'suspicious', 'benign', 'unknown']
    if (row.classification && !validClassifications.includes(row.classification)) {
      errors.push('Invalid classification')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await api.post<UploadResponse>('/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    },
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      // Reset form
      setFile(null)
      setPreview([])
      setCampaignId('')
      setClassification('unknown')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Upload failed')
    },
  })

  const handleSubmit = () => {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    if (campaignId) formData.append('campaign_id', campaignId)

    uploadMutation.mutate(formData)
  }

  const validRows = preview.filter((row, index) => validateRow(row, index).isValid).length
  const invalidRows = preview.length - validRows

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-emerald-500/20 rounded-lg">
            <Shield className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Upload CSV File
            </h1>
            <p className="text-slate-400 text-sm">
              Process and enrich IOC data from CSV files
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Upload Section */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 bg-emerald-500/20 rounded-lg">
                <Upload className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">File Upload</h2>
                <p className="text-slate-400 text-sm">Select your CSV file for IOC processing</p>
              </div>
            </div>
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragActive
                  ? 'border-emerald-400 bg-emerald-500/10'
                  : 'border-slate-600 hover:border-emerald-400 hover:bg-emerald-500/5'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              {isDragActive ? (
                <p className="text-slate-300">Drop the CSV file here...</p>
              ) : (
                <div>
                  <p className="text-slate-300 mb-2">
                    Drag & drop a CSV file here, or click to select
                  </p>
                  <p className="text-sm text-slate-500">
                    Supports .csv files up to 10MB
                  </p>
                </div>
              )}
            </div>

            {file && (
              <div className="mt-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="font-mono text-white">{file.name}</p>
                    <p className="text-sm text-slate-400 font-mono">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Campaign Settings Section */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-500/20 rounded-lg">
                <Settings className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Campaign Settings</h2>
                <p className="text-slate-400 text-sm">Configure processing parameters for this upload</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Campaign ID
                </label>
                <input
                  type="text"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="input-field w-full"
                  placeholder="Optional campaign identifier"
                />
                <p className="text-xs text-slate-500 mt-1">Used to group related IOC uploads</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Default Classification
                </label>
                <select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="unknown">Unknown</option>
                  <option value="malicious">Malicious</option>
                  <option value="suspicious">Suspicious</option>
                  <option value="benign">Benign</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Default classification for unclassified IOCs</p>
              </div>
            </div>
          </div>

          {/* CSV Preview Section */}
          {preview.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 bg-purple-500/20 rounded-lg">
                  <FileText className="h-5 w-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">CSV Preview</h2>
                  <p className="text-slate-400 text-sm">First 10 rows of your uploaded file</p>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-green-400 font-medium">{validRows} valid</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <span className="text-red-400 font-medium">{invalidRows} invalid</span>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 text-slate-300">Status</th>
                      <th className="text-left py-3 text-slate-300">IOC Value</th>
                      <th className="text-left py-3 text-slate-300">Type</th>
                      <th className="text-left py-3 text-slate-300">Classification</th>
                      <th className="text-left py-3 text-slate-300">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((row, _index) => {
                      const validation = validateRow(row, _index)
                      return (
                        <tr key={_index} className="border-b border-slate-800">
                          <td className="py-3">
                            {validation.isValid ? (
                              <CheckCircle className="h-4 w-4 text-green-400" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400" />
                            )}
                          </td>
                          <td className="py-3 text-white truncate max-w-xs">
                            {row.ioc_value}
                          </td>
                          <td className="py-3 text-white">{row.ioc_type}</td>
                          <td className="py-3 text-white">{row.classification}</td>
                          <td className="py-3 text-white">{row.source_platform}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <p className="text-center text-slate-400 font-mono mt-4">
                    ... and {preview.length - 10} more rows
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Section */}
          {file && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 bg-orange-500/20 rounded-lg">
                  <Play className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Process Upload</h2>
                  <p className="text-slate-400 text-sm">Start IOC enrichment and processing</p>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-400">
                  <span className="font-medium text-white">{validRows}</span> valid rows ready for processing
                  {invalidRows > 0 && (
                    <span className="text-red-400 ml-2">({invalidRows} errors need fixing)</span>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleSubmit}
                    disabled={uploadMutation.isPending || invalidRows > 0}
                    className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                      uploadMutation.isPending || invalidRows > 0
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-lg'
                    }`}
                  >
                    {uploadMutation.isPending ? (
                      <div className="flex items-center">
                        <Terminal className="h-4 w-4 mr-2" />
                        <span>Enriching IOCs...</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Play className="h-4 w-4 mr-2" />
                        <span>Start Enrichment</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Validation Errors Section */}
          {invalidRows > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-red-400">Validation Errors</h2>
                  <p className="text-red-300 text-sm">Please fix these issues before processing</p>
                </div>
              </div>
              <p className="text-sm text-red-200">
                Required fields: <span className="font-mono">ioc_value</span>, <span className="font-mono">ioc_type</span>, <span className="font-mono">email_id</span>, <span className="font-mono">source_platform</span>, <span className="font-mono">classification</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
