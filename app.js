// Phantom Recon - OSINT IOC Analyzer (Supabase persistent version)

// -- Supabase setup --
const SUPABASE_URL = "https://hpjnvtfzpesmmofgmcnz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwam52dGZ6cGVzbW1vZmdtY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NjM1MzUsImV4cCI6MjA3MDUzOTUzNX0.6Vg3Z00xJRgxSvQRw3CpB6SVK06sXo09nzIP1bq2C-k";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const csvInput = document.getElementById('csvInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const reportSection = document.getElementById('report');
const reportStats = document.getElementById('reportStats');
const resultsTable = document.getElementById('resultsTable');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const demoBtn = document.getElementById('demoBtn');
const supabaseIocTable = document.getElementById('supabaseIocTable');
const refreshIocBtn = document.getElementById('refreshIocBtn');

let parsedIOCs = [];
let reportRows = [];

function parseCSVText(csvText) {
  return csvText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line)
    .map(line => {
      if (line.includes(',')) {
        return line.split(',')[0].replace(/"/g, '').trim();
      }
      return line.replace(/"/g, '').trim();
    });
}

function detectIOCType(ioc) {
  if (/^[0-9a-f]{32,64}$/i.test(ioc)) return "Hash";
  if (/^([a-z0-9\-\.]+\.)+[a-z]{2,}$/i.test(ioc)) return "Domain";
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ioc)) return "IPv4";
  if (/^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i.test(ioc)) return "IPv6";
  return "Unknown";
}

function mockVendorLookup(ioc, type) {
  const vendors = ["VirusTotal", "AbuseIPDB", "AlienVault OTX", "ThreatFox", "MISP"];
  const result = { ioc, type, vendors: {}, verdict: "Unknown" };
  vendors.forEach(vendor => {
    let status = "Clean";
    if (Math.random() < 0.18) status = "Malicious";
    else if (Math.random() < 0.13) status = "Suspicious";
    result.vendors[vendor] = status;
  });
  if (Object.values(result.vendors).includes("Malicious")) result.verdict = "Malicious";
  else if (Object.values(result.vendors).includes("Suspicious")) result.verdict = "Suspicious";
  else result.verdict = "Clean";
  return result;
}

function showReport(rows, readOnly=false) {
  reportSection.style.display = '';
  resultsTable.innerHTML = '';
  if (!rows.length) {
    reportStats.textContent = "No results to show.";
    return;
  }
  const vendors = Object.keys(rows[0].vendors);
  const header = `<tr>
    <th>IOC</th>
    <th>Type</th>
    ${vendors.map(v=>`<th>${v}</th>`).join('')}
    <th>Final Verdict</th>
  </tr>`;
  const body = rows.map(r => 
    `<tr>
      <td>${r.ioc}</td>
      <td>${r.type}</td>
      ${vendors.map(v=>`<td>${r.vendors[v]}</td>`).join('')}
      <td style="font-weight:bold; color:${
        r.verdict==='Malicious'?'#ff5387':(r.verdict==='Suspicious'?'#f1c40f':'#29fc9e')
      }">${r.verdict}</td>
    </tr>`
  ).join('');
  resultsTable.innerHTML = header + body;

  const verdicts = rows.map(r=>r.verdict);
  const stats = [
    `Total: ${rows.length}`,
    `Clean: ${verdicts.filter(v=>v==='Clean').length}`,
    `Suspicious: ${verdicts.filter(v=>v==='Suspicious').length}`,
    `Malicious: ${verdicts.filter(v=>v==='Malicious').length}`,
  ];
  reportStats.textContent = stats.join(' | ');

  downloadBtn.style.display = readOnly ? 'none' : '';
  clearBtn.style.display = readOnly ? 'none' : '';
}

// --- Supabase IOC functions ---

// Upsert a single IOC (create/update first_seen, last_seen, hit_count)
async function upsertIOC(ioc, type) {
  const now = new Date().toISOString();
  // Check if IOC already exists
  const { data, error } = await supabase
    .from('iocs')
    .select('*')
    .eq('ioc', ioc)
    .maybeSingle();

  if (error) {
    console.error('Supabase select error:', error);
    return;
  }
  if (data) {
    // Update last_seen, increment hit_count
    const { error: updateError } = await supabase
      .from('iocs')
      .update({
        last_seen: now,
        hit_count: (data.hit_count || 1) + 1
      })
      .eq('ioc', ioc);
    if (updateError) console.error('Supabase update error:', updateError);
  } else {
    // Insert new
    const { error: insertError } = await supabase
      .from('iocs')
      .insert([{
        ioc,
        type,
        first_seen: now,
        last_seen: now,
        hit_count: 1
      }]);
    if (insertError) console.error('Supabase insert error:', insertError);
  }
}

// Bulk upsert all analyzed IOCs
async function trackAllIOCs(iocList) {
  for (const ioc of iocList) {
    await upsertIOC(ioc, detectIOCType(ioc));
  }
}

// Fetch and render persistent IOC table
async function fetchSupabaseIocs() {
  supabaseIocTable.innerHTML = "<tr><td>Loading...</td></tr>";
  const { data, error } = await supabase
    .from('iocs')
    .select('*')
    .order('last_seen', { ascending: false });
  if (error) {
    supabaseIocTable.innerHTML = `<tr><td colspan="5">Error loading IOCs.</td></tr>`;
    return;
  }
  if (!data.length) {
    supabaseIocTable.innerHTML = "<tr><td>No IOCs tracked yet.</td></tr>";
    return;
  }
  supabaseIocTable.innerHTML = `<tr>
    <th>IOC</th>
    <th>Type</th>
    <th>First Seen</th>
    <th>Last Seen</th>
    <th>Hit Count</th>
  </tr>` + data.map(row =>
    `<tr>
      <td>${row.ioc}</td>
      <td>${row.type}</td>
      <td>${row.first_seen ? new Date(row.first_seen).toLocaleString() : ""}</td>
      <td>${row.last_seen ? new Date(row.last_seen).toLocaleString() : ""}</td>
      <td>${row.hit_count || 1}</td>
    </tr>`
  ).join('');
}

// --- CSV/analysis workflow ---

function analyzeIOCs() {
  reportRows = parsedIOCs.map(ioc => {
    const type = detectIOCType(ioc);
    return mockVendorLookup(ioc, type);
  });
  showReport(reportRows);
  trackAllIOCs(parsedIOCs).then(fetchSupabaseIocs);
}

function downloadCSVReport() {
  if (!reportRows.length) return;
  const vendors = Object.keys(reportRows[0].vendors);
  const rows = [
    ['IOC', 'Type', ...vendors, 'Final Verdict'],
    ...reportRows.map(r => [
      r.ioc, r.type, ...vendors.map(v=>r.vendors[v]), r.verdict
    ])
  ];
  const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'phantom-recon-report.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

function clearReport() {
  resultsTable.innerHTML = '';
  reportStats.textContent = '';
  reportSection.style.display = 'none';
  reportRows = [];
  parsedIOCs = [];
  csvInput.value = '';
  analyzeBtn.disabled = true;
}

csvInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    parsedIOCs = parseCSVText(evt.target.result);
    analyzeBtn.disabled = !parsedIOCs.length;
  };
  reader.readAsText(file);
});

analyzeBtn.addEventListener('click', analyzeIOCs);
downloadBtn.addEventListener('click', downloadCSVReport);
clearBtn.addEventListener('click', clearReport);

demoBtn.addEventListener('click', () => {
  parsedIOCs = [
    '8.8.8.8',
    'www.evil.com',
    '44d88612fea8a8f36de82e1278abb02f',
    '2607:f8b0:4005:805::200e',
    'google.com',
    'bad-domain.biz',
    'e99a18c428cb38d5f260853678922e03'
  ];
  analyzeBtn.disabled = false;
  csvInput.value = '';
});

refreshIocBtn.addEventListener('click', fetchSupabaseIocs);

// On load, show persistent IOC table
fetchSupabaseIocs();