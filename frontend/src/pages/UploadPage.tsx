import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Play, Terminal, Settings } from 'lucide-react'
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
    <div className="h-full flex flex-col bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Upload CSV File
          </h1>
          <p className="text-slate-600 text-sm">
            Process and enrich IOC data from CSV files
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 bg-slate-100">
        <div className="w-full space-y-6">
          
          {/* 1. Upload CSV File Section */}
          <div className="w-full bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
                isDragActive
                  ? 'border-red-500 bg-red-50'
                  : 'border-slate-300 hover:border-red-400 hover:bg-slate-50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-16 w-16 text-slate-400 mx-auto mb-6" />
              {isDragActive ? (
                <p className="text-xl text-slate-700">Drop the CSV file here...</p>
              ) : (
                <div>
                  <p className="text-xl text-slate-700 mb-3">
                    Drag & drop a CSV file here, or click to select
                  </p>
                  <p className="text-slate-500">
                    Supports .csv files up to 10MB
                  </p>
                </div>
              )}
            </div>

            {file && (
              <div className="mt-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-4">
                  <FileText className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="text-lg font-mono text-slate-900">{file.name}</p>
                    <p className="text-slate-600 font-mono">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Process Enrichment Section */}
          {file && (
            <div className="w-full bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
              <div className="flex items-center space-x-4 mb-8">
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-xl">
                  <Play className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">Process Enrichment</h2>
                  <p className="text-slate-600">Configure settings and start IOC processing</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div>
                  <label className="block text-lg font-medium text-slate-700 mb-3">
                    Campaign ID
                  </label>
                  <input
                    type="text"
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Optional campaign identifier"
                  />
                  <p className="text-sm text-slate-500 mt-2">Used to group related IOC uploads</p>
                </div>
                <div>
                  <label className="block text-lg font-medium text-slate-700 mb-3">
                    Default Classification
                  </label>
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="malicious">Malicious</option>
                    <option value="suspicious">Suspicious</option>
                    <option value="benign">Benign</option>
                  </select>
                  <p className="text-sm text-slate-500 mt-2">Default classification for unclassified IOCs</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-lg text-slate-600">
                  <span className="font-bold text-slate-900">{validRows}</span> valid rows ready for processing
                  {invalidRows > 0 && (
                    <span className="text-red-600 ml-2">({invalidRows} errors need fixing)</span>
                  )}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={uploadMutation.isPending || invalidRows > 0}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-200 ${
                    uploadMutation.isPending || invalidRows > 0
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 text-white hover:shadow-lg'
                  }`}
                >
                  {uploadMutation.isPending ? (
                    <div className="flex items-center">
                      <Terminal className="h-5 w-5 mr-3" />
                      <span>Processing IOCs...</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Play className="h-5 w-5 mr-3" />
                      <span>Start Processing</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Divider between Process Enrichment and Results */}
          {file && preview.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
              <div className="px-6 py-2 bg-white border border-slate-300 rounded-full shadow-sm">
                <span className="text-slate-600 text-sm font-medium">Processing Complete</span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
            </div>
          )}

          {/* 3. Results Section */}
          {preview.length > 0 && (
            <div className="w-full bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
              <div className="flex items-center space-x-4 mb-8">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-slate-900">Upload Results</h2>
                  <p className="text-slate-600">Preview and validation results of your uploaded CSV</p>
                </div>
                <div className="flex items-center space-x-8 text-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <span className="text-green-600 font-bold">{validRows} valid</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <XCircle className="h-6 w-6 text-red-600" />
                    <span className="text-red-600 font-bold">{invalidRows} invalid</span>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-lg font-mono">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-4 text-slate-700">Status</th>
                      <th className="text-left py-4 text-slate-700">IOC Value</th>
                      <th className="text-left py-4 text-slate-700">Type</th>
                      <th className="text-left py-4 text-slate-700">Classification</th>
                      <th className="text-left py-4 text-slate-700">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((row, _index) => {
                      const validation = validateRow(row, _index)
                      return (
                        <tr key={_index} className="border-b border-slate-100">
                          <td className="py-4">
                            {validation.isValid ? (
                              <CheckCircle className="h-6 w-6 text-green-600" />
                            ) : (
                              <XCircle className="h-6 w-6 text-red-600" />
                            )}
                          </td>
                          <td className="py-4 text-slate-900 truncate max-w-xs">
                            {row.ioc_value}
                          </td>
                          <td className="py-4 text-slate-900">{row.ioc_type}</td>
                          <td className="py-4 text-slate-900">{row.classification}</td>
                          <td className="py-4 text-slate-900">{row.source_platform}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <p className="text-center text-slate-500 font-mono mt-6 text-lg">
                    ... and {preview.length - 10} more rows
                  </p>
                )}
              </div>

              {/* Validation Errors - Show within Results section if there are errors */}
              {invalidRows > 0 && (
                <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center space-x-3 mb-4">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <h3 className="text-lg font-bold text-red-600">Validation Errors</h3>
                  </div>
                  <p className="text-red-700">
                    Required fields: <span className="font-mono">ioc_value</span>, <span className="font-mono">ioc_type</span>, <span className="font-mono">email_id</span>, <span className="font-mono">source_platform</span>, <span className="font-mono">classification</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
