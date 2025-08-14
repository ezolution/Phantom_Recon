// Phantom Recon - OSINT IOC Analyzer with Supabase persistent tracking (custom CSV schema, NO mock verdict, NO demo data)

const SUPABASE_URL = "https://hpjnvtfzpesmmofgmcnz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwam52dGZ6cGVzbW1vZmdtY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NjM1MzUsImV4cCI6MjA3MDUzOTUzNX0.6Vg3Z00xJRgxSvQRw3CpB6SVK06sXo09nzIP1bq2C-k";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Utility to generate custom ID: DDMMYYYY_IOC_Value_CampaignKey
function generateIocId(iocValue, campaignKey, dateObj) {
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}${mm}${yyyy}_${iocValue}_${campaignKey}`;
}

// Parse CSV with expected header row
function parseCSVText(csvText) {
  const rows = csvText.split(/\r?\n/).filter(Boolean);
  const header = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
  // Expected: IOC_Type,IOC_Value,Source,Hits,FirstSeen,LastSeen,CampaignKey
  return rows.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    // Map header to value
    const obj = {};
    header.forEach((h, idx) => obj[h] = cols[idx] || "");
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

function showReport(rows, readOnly = false) {
  reportSection.style.display = '';
  resultsTable.innerHTML = '';
  if (!rows.length) {
    reportStats.textContent = "No results to show.";
    return;
  }
  // Table header from CSV
  const header = `<tr>
    <th>IOC_Type</th>
    <th>IOC_Value</th>
    <th>Source</th>
    <th>Hits</th>
    <th>FirstSeen</th>
    <th>LastSeen</th>
    <th>CampaignKey</th>
  </tr>`;
  const body = rows.map(r =>
    `<tr>
      <td>${r.IOC_Type}</td>
      <td>${r.IOC_Value}</td>
      <td>${r.Source}</td>
      <td>${r.Hits}</td>
      <td>${r.FirstSeen}</td>
      <td>${r.LastSeen}</td>
      <td>${r.CampaignKey}</td>
    </tr>`
  ).join('');
  resultsTable.innerHTML = header + body;

  reportStats.textContent = `Total: ${rows.length}`;
  downloadBtn.style.display = readOnly ? 'none' : '';
  clearBtn.style.display = readOnly ? 'none' : '';
}

// --- Supabase IOC functions ---

// Upsert a single IOC row
async function upsertIocRow(iocObj, uploadDate) {
  const id = generateIocId(iocObj.IOC_Value, iocObj.CampaignKey, uploadDate);
  console.log('Upserting:', { id, ...iocObj }); // <-- Add this line
  const { error } = await supabase
    .from('iocs')
    .upsert([{
      id,
      IOC_Type: iocObj.IOC_Type,
      IOC_Value: iocObj.IOC_Value,
      Source: iocObj.Source,
      Hits: parseInt(iocObj.Hits || "1", 10),
      FirstSeen: iocObj.FirstSeen || uploadDate.toISOString().substring(0, 10),
      LastSeen: iocObj.LastSeen || uploadDate.toISOString().substring(0, 10),
      CampaignKey: iocObj.CampaignKey
    }], { onConflict: ['id'] });
  if (error) console.error('Supabase upsert error:', error);
}

// Bulk upsert all analyzed rows
async function trackAllRows(rows) {
  const uploadDate = new Date();
  for (const iocObj of rows) {
    await upsertIocRow(iocObj, uploadDate);
  }
}

// Fetch and render persistent IOC table
async function fetchSupabaseIocs() {
  supabaseIocTable.innerHTML = "<tr><td>Loading...</td></tr>";
  const { data, error } = await supabase
    .from('iocs')
    .select('*')
    .order('LastSeen', { ascending: false });
  if (error) {
    supabaseIocTable.innerHTML = `<tr><td colspan="8">Error loading IOCs.</td></tr>`;
    return;
  }
  if (!data.length) {
    supabaseIocTable.innerHTML = "<tr><td>No IOCs tracked yet.</td></tr>";
    return;
  }
  supabaseIocTable.innerHTML = `<tr>
    <th>ID</th>
    <th>IOC_Type</th>
    <th>IOC_Value</th>
    <th>Source</th>
    <th>Hits</th>
    <th>FirstSeen</th>
    <th>LastSeen</th>
    <th>CampaignKey</th>
  </tr>` + data.map(row =>
    `<tr>
      <td>${row.id}</td>
      <td>${row.IOC_Type}</td>
      <td>${row.IOC_Value}</td>
      <td>${row.Source}</td>
      <td>${row.Hits}</td>
      <td>${row.FirstSeen}</td>
      <td>${row.LastSeen}</td>
      <td>${row.CampaignKey}</td>
    </tr>`
  ).join('');
}

// --- CSV/analysis workflow ---

function analyzeRows() {
  reportRows = parsedRows;
  showReport(reportRows);
  trackAllRows(parsedRows).then(fetchSupabaseIocs);
}

function downloadCSVReport() {
  if (!reportRows.length) return;
  const rows = [
    ['IOC_Type', 'IOC_Value', 'Source', 'Hits', 'FirstSeen', 'LastSeen', 'CampaignKey'],
    ...reportRows.map(r => [
      r.IOC_Type, r.IOC_Value, r.Source, r.Hits, r.FirstSeen, r.LastSeen, r.CampaignKey
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

analyzeBtn.addEventListener('click', analyzeRows);
downloadBtn.addEventListener('click', downloadCSVReport);
clearBtn.addEventListener('click', clearReport);

refreshIocBtn && refreshIocBtn.addEventListener('click', fetchSupabaseIocs);

// On load, show persistent IOC table
fetchSupabaseIocs();