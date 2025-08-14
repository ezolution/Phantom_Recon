import { virustotalBatchSearch } from './virustotal.js';

// ----- Tab Navigation Logic -----
document.addEventListener('DOMContentLoaded', function () {
  const mainTabBtn = document.getElementById('mainTabBtn');
  const trackerTabBtn = document.getElementById('trackerTabBtn');
  const mainTab = document.getElementById('mainTab');
  const trackerTab = document.getElementById('trackerTab');

  mainTabBtn.addEventListener('click', function () {
    mainTabBtn.classList.add('active');
    trackerTabBtn.classList.remove('active');
    mainTab.classList.add('active');
    trackerTab.classList.remove('active');
  });
  trackerTabBtn.addEventListener('click', function () {
    trackerTabBtn.classList.add('active');
    mainTabBtn.classList.remove('active');
    trackerTab.classList.add('active');
    mainTab.classList.remove('active');
    fetchSupabaseIocs();
  });
});

// ----- Supabase Setup -----
const SUPABASE_URL = "https://hpjnvtfzpesmmofgmcnz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwam52dGZ6cGVzbW1vZmdtY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NjM1MzUsImV4cCI6MjA3MDUzOTUzNX0.6Vg3Z00xJRgxSvQRw3CpB6SVK06sXo09nzIP1bq2C-k";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Utility for custom ID
function generateIocId(IOC_Value, CampaignKey, dateObj) {
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}${mm}${yyyy}_${IOC_Value}_${CampaignKey}`;
}

// Parse CSV
function parseCSVText(csvText) {
  const rows = csvText.split(/\r?\n/).filter(Boolean);
  const header = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const fixedHeader = header.map(h =>
    h.replace(/ioc[\s_-]?type/i, 'IOC_Typee')
     .replace(/ioc[\s_-]?value/i, 'IOC_Value')
     .replace(/source/i, 'Source')
     .replace(/hits/i, 'Hits')
     .replace(/first[\s_-]?seen/i, 'FirstSeen')
     .replace(/last[\s_-]?seen/i, 'LastSeen')
     .replace(/campaign[\s_-]?key/i, 'CampaignKey')
  );
  return rows.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    const obj = {};
    fixedHeader.forEach((h, idx) => obj[h] = cols[idx] || "");
    return obj;
  });
}

const csvInput = document.getElementById('csvInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const reportSection = document.getElementById('report');
const reportStats = document.getElementById('reportStats');
const resultsTable = document.getElementById('resultsTable');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const supabaseIocTable = document.getElementById('supabaseIocTable');
const refreshIocBtn = document.getElementById('refreshIocBtn');

let parsedRows = [];
let reportRows = [];
let vtResults = [];

function showReport(rows, readOnly = false, vtMode = true) {
  reportSection.style.display = '';
  resultsTable.innerHTML = '';
  if (!rows.length) {
    reportStats.textContent = "No results to show.";
    return;
  }
  let header = `<tr>
    <th>IOC Type</th>
    <th>IOC Value</th>
    <th>Source</th>
    <th>Hits</th>
    <th>FirstSeen</th>
    <th>LastSeen</th>
    <th>CampaignKey</th>
    <th>VT Verdict</th>
    <th>VT Threat Label</th>
    <th>VT Category</th>
    <th>VT Family</th>
    <th>VT Tags</th>
  </tr>`;
  const body = rows.map(r => {
    let vt = r.vt || {};
    let verdictClass = vt.verdict?.malicious > 0 ? 'malicious' :
      vt.verdict?.harmless > 0 ? 'benign' :
      vt.verdict?.suspicious > 0 ? 'suspicious' : '';
    let verdictText = vt.verdict?.malicious > 0 ? 'Malicious' :
      vt.verdict?.harmless > 0 ? 'Benign' :
      vt.verdict?.suspicious > 0 ? 'Suspicious' : '';
    let tags = (vt.threat_names || []).join(', ');
    return `<tr class="${verdictClass}">
      <td>${r.IOC_Typee}</td>
      <td>${r.IOC_Value}</td>
      <td>${r.Source}</td>
      <td>${r.Hits}</td>
      <td>${r.FirstSeen}</td>
      <td>${r.LastSeen}</td>
      <td>${r.CampaignKey}</td>
      <td><span class="verdict ${verdictClass}">${verdictText}</span></td>
      <td>${vt.popular_threat_label || ''}</td>
      <td>${vt.popular_threat_category || ''}</td>
      <td>${vt.popular_threat_family || ''}</td>
      <td>${tags}</td>
    </tr>`;
  }).join('');
  resultsTable.innerHTML = header + body;
  reportStats.textContent = `Total: ${rows.length}`;
  downloadBtn.style.display = readOnly ? 'none' : '';
  clearBtn.style.display = readOnly ? 'none' : '';
}

// Supabase IOC functions ---

async function upsertIocRow(iocObj, uploadDate) {
  const id = generateIocId(iocObj.IOC_Value, iocObj.CampaignKey, uploadDate);
  // Upsert IOC base
  await supabase
    .from('iocs')
    .upsert([{
      id,
      IOC_Typee: iocObj.IOC_Typee,
      IOC_Value: iocObj.IOC_Value,
      Source: iocObj.Source,
      Hits: parseInt(iocObj.Hits || "1", 10),
      FirstSeen: iocObj.FirstSeen || uploadDate.toISOString().substring(0, 10),
      LastSeen: iocObj.LastSeen || uploadDate.toISOString().substring(0, 10),
      CampaignKey: iocObj.CampaignKey
    }], { onConflict: ['id'] });
  // Upsert enrichment
  await supabase
    .from('ioc_enrichments')
    .upsert([{
      ioc_id: id,
      provider: 'VirusTotal',
      enrichment: iocObj.vt,
      enriched_at: uploadDate.toISOString()
    }], { onConflict: ['ioc_id', 'provider'] });
}

async function trackAllRows(rows) {
  const uploadDate = new Date();
  for (const iocObj of rows) {
    await upsertIocRow(iocObj, uploadDate);
  }
}

async function fetchSupabaseIocs() {
  supabaseIocTable.innerHTML = "<tr><td>Loading...</td></tr>";
  // Join iocs + enrichments (VirusTotal only shown here)
  const { data: baseIocs, error: baseError } = await supabase
    .from('iocs')
    .select('*')
    .order('LastSeen', { ascending: false });
  if (baseError || !baseIocs.length) {
    supabaseIocTable.innerHTML = `<tr><td colspan="13">No IOCs tracked yet.</td></tr>`;
    return;
  }
  // Get enrichments
  const ids = baseIocs.map(i => i.id);
  const { data: enrichments } = await supabase
    .from('ioc_enrichments')
    .select('*')
    .in('ioc_id', ids);
  // Map enrichments by ioc_id and provider
  const enrichMap = {};
  enrichments?.forEach(e => {
    enrichMap[`${e.ioc_id}_${e.provider}`] = e.enrichment;
  });
  // Table UI
  supabaseIocTable.innerHTML = `<tr>
    <th>ID</th>
    <th>IOC Type</th>
    <th>IOC Value</th>
    <th>Source</th>
    <th>Hits</th>
    <th>FirstSeen</th>
    <th>LastSeen</th>
    <th>CampaignKey</th>
    <th>VT Verdict</th>
    <th>VT Threat Label</th>
    <th>VT Category</th>
    <th>VT Family</th>
    <th>VT Tags</th>
  </tr>` + baseIocs.map(row => {
    const vt = enrichMap[`${row.id}_VirusTotal`] || {};
    let verdictClass = vt.verdict?.malicious > 0 ? 'malicious' :
      vt.verdict?.harmless > 0 ? 'benign' :
      vt.verdict?.suspicious > 0 ? 'suspicious' : '';
    let verdictText = vt.verdict?.malicious > 0 ? 'Malicious' :
      vt.verdict?.harmless > 0 ? 'Benign' :
      vt.verdict?.suspicious > 0 ? 'Suspicious' : '';
    let tags = (vt.threat_names || []).join(', ');
    return `<tr class="${verdictClass}">
      <td>${row.id}</td>
      <td>${row.IOC_Typee}</td>
      <td>${row.IOC_Value}</td>
      <td>${row.Source}</td>
      <td>${row.Hits}</td>
      <td>${row.FirstSeen}</td>
      <td>${row.LastSeen}</td>
      <td>${row.CampaignKey}</td>
      <td><span class="verdict ${verdictClass}">${verdictText}</span></td>
      <td>${vt.popular_threat_label || ''}</td>
      <td>${vt.popular_threat_category || ''}</td>
      <td>${vt.popular_threat_family || ''}</td>
      <td>${tags}</td>
    </tr>`;
  }).join('');
}

// --- CSV/analysis workflow ---

function getVTType(iocType, value) {
  const type = iocType.trim().toLowerCase();
  if (type.includes('file') || type === 'hash' || /^[a-fA-F0-9]{32,64}$/.test(value)) return 'file';
  if (type.includes('url') || /^https?:\/\//.test(value)) return 'url';
  if (type.includes('domain') || /^[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}$/.test(value)) return 'domain';
  if (type.includes('ip') || /^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return 'ip';
  return null;
}

async function analyzeRows() {
  reportStats.textContent = "Analyzing, please wait...";
  analyzeBtn.disabled = true;
  // Prepare VT batch
  const iocArr = parsedRows.map(r => ({
    type: getVTType(r.IOC_Typee, r.IOC_Value),
    value: r.IOC_Value,
    ...r
  })).filter(ioc => !!ioc.type);
  vtResults = await virustotalBatchSearch(iocArr);
  reportRows = vtResults.map(r => ({
    IOC_Typee: r.IOC_Typee,
    IOC_Value: r.IOC_Value,
    Source: r.Source,
    Hits: r.Hits,
    FirstSeen: r.FirstSeen,
    LastSeen: r.LastSeen,
    CampaignKey: r.CampaignKey,
    vt: r.vt
  }));
  showReport(reportRows, false, true);
  // Store all rows with enrichment in Supabase
  await trackAllRows(reportRows);
  fetchSupabaseIocs();
  analyzeBtn.disabled = false;
  reportStats.textContent = `Total: ${reportRows.length}`;
}

function downloadCSVReport() {
  if (!reportRows.length) return;
  const rows = [
    ['IOC_Typee', 'IOC_Value', 'Source', 'Hits', 'FirstSeen', 'LastSeen', 'CampaignKey', 'VT_Verdict', 'VT_Threat_Label', 'VT_Threat_Category', 'VT_Family_Label', 'VT_Threat_Tags'],
    ...reportRows.map(r => [
      r.IOC_Typee, r.IOC_Value, r.Source, r.Hits, r.FirstSeen, r.LastSeen, r.CampaignKey,
      r.vt ? JSON.stringify(r.vt.verdict) : '',
      r.vt ? r.vt.popular_threat_label : '',
      r.vt ? r.vt.popular_threat_category : '',
      r.vt ? r.vt.popular_threat_family : '',
      r.vt ? (r.vt.threat_names || []).join(';') : ''
    ])
  ];
  const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'phantom-recon-report.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function clearReport() {
  resultsTable.innerHTML = '';
  reportStats.textContent = '';
  reportSection.style.display = 'none';
  reportRows = [];
  parsedRows = [];
  vtResults = [];
  csvInput.value = '';
  analyzeBtn.disabled = true;
}

csvInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    parsedRows = parseCSVText(evt.target.result);
    analyzeBtn.disabled = !parsedRows.length;
  };
  reader.readAsText(file);
});

analyzeBtn.addEventListener('click', () => {
  analyzeRows();
});
downloadBtn.addEventListener('click', downloadCSVReport);
clearBtn.addEventListener('click', clearReport);

refreshIocBtn && refreshIocBtn.addEventListener('click', fetchSupabaseIocs);

fetchSupabaseIocs();