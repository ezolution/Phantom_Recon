import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Play, Shield, Terminal } from 'lucide-react'
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Shield className="h-6 w-6 text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">
            Upload CSV File
          </h1>
          <p className="text-slate-400">
            Upload CSV files containing IOCs for enrichment
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <div className="card">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragActive
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-slate-600 hover:border-emerald-500/50 hover:bg-emerald-500/5'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
          {isDragActive ? (
            <p className="text-emerald-400">Drop the CSV file here...</p>
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

      {/* Campaign Settings */}
      <div className="card">
        <h3 className="text-lg font-mono font-bold text-neon-green mb-4">
          Campaign Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-mono text-neon-green mb-2">
              Campaign ID
            </label>
            <input
              type="text"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="input-field w-full"
              placeholder="Optional campaign identifier"
            />
          </div>
          <div>
            <label className="block text-sm font-mono text-neon-green mb-2">
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
          </div>
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-mono font-bold text-neon-green">
              CSV Preview (First 50 rows)
            </h3>
            <div className="flex items-center space-x-4 text-sm font-mono">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-neon-green" />
                <span className="text-neon-green">{validRows} valid</span>
              </div>
              <div className="flex items-center space-x-2">
                <XCircle className="h-4 w-4 text-neon-red" />
                <span className="text-neon-red">{invalidRows} invalid</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-blackhat-700">
                  <th className="text-left py-2 text-neon-green">Status</th>
                  <th className="text-left py-2 text-neon-green">IOC Value</th>
                  <th className="text-left py-2 text-neon-green">Type</th>
                  <th className="text-left py-2 text-neon-green">Classification</th>
                  <th className="text-left py-2 text-neon-green">Source</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, _index) => {
                  const validation = validateRow(row, _index)
                  return (
                    <tr key={_index} className="border-b border-blackhat-800">
                      <td className="py-2">
                        {validation.isValid ? (
                          <CheckCircle className="h-4 w-4 text-neon-green" />
                        ) : (
                          <XCircle className="h-4 w-4 text-neon-red" />
                        )}
                      </td>
                      <td className="py-2 text-white truncate max-w-xs">
                        {row.ioc_value}
                      </td>
                      <td className="py-2 text-white">{row.ioc_type}</td>
                      <td className="py-2 text-white">{row.classification}</td>
                      <td className="py-2 text-white">{row.source_platform}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {preview.length > 10 && (
              <p className="text-center text-blackhat-400 font-mono mt-4">
                ... and {preview.length - 10} more rows
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {file && (
        <div className="flex justify-between items-center">
          <div className="text-sm font-mono text-blackhat-400">
            {validRows} valid rows ready for processing
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleSubmit}
              disabled={uploadMutation.isPending || invalidRows > 0}
              className="btn-primary"
            >
              {uploadMutation.isPending ? (
                <div className="flex items-center">
                  <Terminal className="h-4 w-4 mr-2 text-emerald-400" />
                  <span>Enriching IOCs</span>
                </div>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Enrichment
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {invalidRows > 0 && (
        <div className="card border-neon-red/30 bg-neon-red/5">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-neon-red" />
            <h3 className="font-mono font-bold text-neon-red">
              Validation Errors
            </h3>
          </div>
          <p className="text-sm font-mono text-blackhat-300">
            Please fix the validation errors before uploading. Required fields: ioc_value, ioc_type, email_id, source_platform, classification.
          </p>
        </div>
      )}
    </div>
  )
}
