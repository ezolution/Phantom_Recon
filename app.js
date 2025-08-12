// Phantom Recon - OSINT IOC Analyzer (static version)
// IOC = Indicator of Compromise (IP/domain/hash)

const csvInput = document.getElementById('csvInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const reportSection = document.getElementById('report');
const reportStats = document.getElementById('reportStats');
const resultsTable = document.getElementById('resultsTable');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const historyList = document.getElementById('historyList');
const demoBtn = document.getElementById('demoBtn');

let parsedIOCs = [];
let reportRows = [];

function parseCSVText(csvText) {
  // Accept both column (with/without header) and single-column CSVs
  // Simple CSV parser, not RFC-complete
  return csvText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line)
    .map(line => {
      // If comma, only take first column
      if (line.includes(',')) {
        return line.split(',')[0].replace(/"/g, '').trim();
      }
      return line.replace(/"/g, '').trim();
    });
}

function detectIOCType(ioc) {
  // Very basic detection (enhance as needed)
  if (/^[0-9a-f]{32,64}$/i.test(ioc)) return "Hash";
  if (/^([a-z0-9\-\.]+\.)+[a-z]{2,}$/i.test(ioc)) return "Domain";
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ioc)) return "IPv4";
  if (/^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i.test(ioc)) return "IPv6";
  return "Unknown";
}

function mockVendorLookup(ioc, type) {
  // Simulate querying a threat intel vendor (replace with real API calls)
  // Returns a mock result object
  const vendors = [
    "VirusTotal", "AbuseIPDB", "AlienVault OTX", "ThreatFox", "MISP"
  ];
  const result = {
    ioc,
    type,
    vendors: {},
    verdict: "Unknown"
  };

  vendors.forEach(vendor => {
    // Random mock verdicts
    let status = "Clean";
    if (Math.random() < 0.18) status = "Malicious";
    else if (Math.random() < 0.13) status = "Suspicious";
    result.vendors[vendor] = status;
  });

  // Final verdict logic (any Malicious = Malicious, else Suspicious, else Clean)
  if (Object.values(result.vendors).includes("Malicious")) result.verdict = "Malicious";
  else if (Object.values(result.vendors).includes("Suspicious")) result.verdict = "Suspicious";
  else result.verdict = "Clean";

  return result;
}

function updateHistory(iocs, reportRows) {
  const now = new Date();
  const history = JSON.parse(localStorage.getItem('phantomReconHistory') || "[]");
  history.unshift({
    timestamp: now.toISOString(),
    iocs: iocs,
    report: reportRows,
  });
  localStorage.setItem('phantomReconHistory', JSON.stringify(history.slice(0,10)));
  showHistory();
}

function showHistory() {
  const history = JSON.parse(localStorage.getItem('phantomReconHistory') || "[]");
  historyList.innerHTML = '';
  if (!history.length) {
    historyList.innerHTML = '<li>No past analyses yet.</li>';
    return;
  }
  history.forEach(item => {
    const li = document.createElement('li');
    const dt = new Date(item.timestamp);
    li.textContent = `Ran on ${dt.toLocaleString()} (${item.iocs.length} IOCs)`;
    li.style.cursor = 'pointer';
    li.onclick = () => showReport(item.report, true);
    historyList.appendChild(li);
  });
}

function showReport(rows, readOnly=false) {
  reportSection.style.display = '';
  resultsTable.innerHTML = '';
  if (!rows.length) {
    reportStats.textContent = "No results to show.";
    return;
  }
  // Table header
  const vendors = Object.keys(rows[0].vendors);
  const header = `<tr>
    <th>IOC</th>
    <th>Type</th>
    ${vendors.map(v=>`<th>${v}</th>`).join('')}
    <th>Final Verdict</th>
  </tr>`;
  // Table body
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

  // Stats
  const verdicts = rows.map(r=>r.verdict);
  const stats = [
    `Total: ${rows.length}`,
    `Clean: ${verdicts.filter(v=>v==='Clean').length}`,
    `Suspicious: ${verdicts.filter(v=>v==='Suspicious').length}`,
    `Malicious: ${verdicts.filter(v=>v==='Malicious').length}`,
  ];
  reportStats.textContent = stats.join(' | ');

  // Download button
  downloadBtn.style.display = readOnly ? 'none' : '';
  clearBtn.style.display = readOnly ? 'none' : '';
}

function analyzeIOCs() {
  reportRows = parsedIOCs.map(ioc => {
    const type = detectIOCType(ioc);
    return mockVendorLookup(ioc, type);
  });
  showReport(reportRows);
  updateHistory(parsedIOCs, reportRows);
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
  // Example demo IOCs
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

showHistory();