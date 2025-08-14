const VT_API_KEY = 'e16673f5eb60ddc40e31a7739c16be7f1af8c6e7f9b48c04136630110508a590';
const VT_BASE_URL = 'https://www.virustotal.com/api/v3';

function vtUrlEncode(url) {
  let encoded = btoa(url)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return encoded;
}

export async function virustotalSearch({ type, value }) {
  let endpoint = '';
  switch (type.toLowerCase()) {
    case 'file':
    case 'hash':
      endpoint = `/files/${value}`;
      break;
    case 'url':
      endpoint = `/urls/${vtUrlEncode(value)}`;
      break;
    case 'domain':
      endpoint = `/domains/${value}`;
      break;
    case 'ip':
    case 'ip_address':
      endpoint = `/ip_addresses/${value}`;
      break;
    default:
      throw new Error('Unsupported IOC type for VT search');
  }

  const resp = await fetch(`${VT_BASE_URL}${endpoint}`, {
    headers: { 'x-apikey': VT_API_KEY }
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    return {
      error: true,
      status: resp.status,
      message: err.error?.message || resp.statusText || 'VT API error'
    };
  }

  const json = await resp.json();
  // Extract useful data
  const attr = json.data?.attributes || {};
  return {
    error: false,
    verdict: attr.last_analysis_stats || {},
    popular_threat_label: attr.popular_threat_label || '',
    popular_threat_category: attr.popular_threat_category || '',
    popular_threat_family: attr.popular_threat_family || '',
    threat_names: attr.tags || [],
    full: attr
  };
}

export async function virustotalBatchSearch(iocArr) {
  const results = [];
  for (const ioc of iocArr) {
    try {
      const res = await virustotalSearch(ioc);
      results.push({ ...ioc, vt: res });
    } catch (e) {
      results.push({ ...ioc, vt: { error: true, message: e.message } });
    }
  }
  return results;
}