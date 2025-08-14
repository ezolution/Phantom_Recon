// Phantom Recon - OSINT IOC Analyzer with Supabase persistent tracking and tab navigation

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
    fetchSupabaseIocs(); // Refresh when switching to tracker tab
  });
});

// ----- Supabase Setup -----
const SUPABASE_URL = "https://hpjnvtfzpesmmofgmcnz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwam52dGZ6cGVzbW1vZmdtY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NjM1MzUsImV4cCI6MjA3MDUzOTUzNX0.6Vg3Z00xJRgxSvQRw3CpB6SVK06sXo09nzIP1bq2C-k";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Utility to generate custom ID: DDMMYYYY_IOC_Value_CampaignKey
function generateIocId(IOC_Value, CampaignKey, dateObj) {
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}${mm}${yyyy}_${IOC_Value}_${CampaignKey}`;
}

// Parse CSV with header mapping to snake_case
function parseCSVText(csvText) {
  const rows = csvText.split(/\r?\n/).filter(Boolean);
  // Map header to lowercase and snake_case for matching Supabase columns
  const header = rows[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
  // Ensure header is snake_case
  const snakeHeader = header.map(h =>
    h.replace(/ioc[\s_-]?type/, 'IOC_Typee')
     .replace(/ioc[\s_-]?value/, 'IOC_Value')
     .replace(/Source/, 'Source')
     .replace(/Hits/, 'Hits')
     .replace(/first[\s_-]?seen/, 'FirstSeen')
     .replace(/last[\s_-]?seen/, 'LastSeen')
     .replace(/campaign[\s_-]?key/, 'CampaignKey')
  );
  return rows.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    const obj = {};
    snakeHeader.forEach((h, idx) => obj[h] = cols[idx] || "");
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
    <th>IOC Type</th>
    <th>IOC Value</th>
    <th>Source</th>
    <th>Hits</th>
    <th>FirstSeen</th>
    <th>LastSeen</th>
    <th>CampaignKey</th>
  </tr>`;
  const body = rows.map(r =>
    `<tr>
      <td>${r.IOC_Typee}</td>
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
  // Debug log
  console.log('Upserting:', { id, ...iocObj });
  const { error } = await supabase
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
    <th>IOC Type</th>
    <th>IOC Value</th>
    <th>Source</th>
    <th>Hits</th>
    <th>FirstSeen</th>
    <th>LastSeen</th>
    <th>CampaignKey</th>
  </tr>` + data.map(row =>
    `<tr>
      <td>${row.id}</td>
      <td>${row.IOC_Typee}</td>
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
    ['IOC_Typee', 'IOC_Value', 'Source', 'Hits', 'FirstSeen', 'LastSeen', 'CampaignKey'],
    ...reportRows.map(r => [
      r.IOC_Typee, r.IOC_Value, r.Source, r.Hits, r.FirstSeen, r.LastSeen, r.CampaignKey
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

// On load, show persistent IOC table (default tab is Analyzer)
fetchSupabaseIocs();