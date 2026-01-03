import React from 'react';

// Regex patterns
const KPI_REGEX = /input\.kpis\s*=\s*(\[[\s\S]*?\]);?/;
const CITATIONS_REGEX = /input\.citations\s*=\s*(\{[\s\S]*?\});?/;
const URL_REGEX = /(https?:\/\/[^\s<>"'()]+)/g;
const BOLD_REGEX = /\*\*(.*?)\*\*/g;

// Helper to clean JS object string to valid JSON
const cleanJsToJSON = (str: string) => {
  try {
    // 1. Quote unquoted keys: { key: 'val' } -> { "key": 'val' }
    let cleaned = str.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    // 2. Convert single quotes to double quotes (simplistic)
    cleaned = cleaned.replace(/'/g, '"');
    // 3. Remove trailing commas
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("Failed to parse JS object:", e);
    return null;
  }
};

interface KpiItem {
  label: string;
  value: string;
  note?: string;
}

interface CitationItem {
  label: string;
  url: string;
  tooltip?: string;
}

// -----------------------------------------------------------------------------
// Render Components
// -----------------------------------------------------------------------------

const KpiTable = ({ kpis }: { kpis: KpiItem[] }) => (
  <div className="my-2 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg text-xs">
    <table className="w-full text-left border-collapse">
      <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
        <tr>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">Label</th>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">Value</th>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">Note</th>
        </tr>
      </thead>
      <tbody>
        {kpis.map((kpi, i) => (
          <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/5">
            <td className="p-2 font-mono text-blue-600 dark:text-blue-400">{kpi.label}</td>
            <td className="p-2 font-mono text-green-600 dark:text-green-400">{kpi.value}</td>
            <td className="p-2 italic text-gray-400 dark:text-gray-500">{kpi.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const CitationTable = ({ citations }: { citations: Record<string, CitationItem> }) => (
  <div className="my-2 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg text-xs">
    <table className="w-full text-left border-collapse">
      <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
        <tr>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700 w-10">ID</th>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">Label</th>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">URL</th>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">Tooltip</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(citations).map(([id, item], i) => (
          <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/5">
            <td className="p-2 font-mono text-yellow-600 dark:text-yellow-500 text-right">{id}</td>
            <td className="p-2 font-mono text-blue-600 dark:text-blue-400">{item.label}</td>
            <td className="p-2">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                {item.url.length > 40 ? item.url.substring(0, 37) + '...' : item.url}
                <span className="opacity-50">🔗</span>
              </a>
            </td>
            <td className="p-2 text-gray-400 dark:text-gray-500">{item.tooltip}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const JsonBlock = ({ data }: { data: any }) => (
  <div className="my-2 p-3 bg-gray-50 dark:bg-[#1e1e1e] rounded-lg border border-gray-200 dark:border-gray-700 font-mono text-xs overflow-x-auto">
    <pre className="text-gray-700 dark:text-gray-300">
      {JSON.stringify(data, null, 2)}
    </pre>
  </div>
);

// -----------------------------------------------------------------------------
// Parser & Renderer
// -----------------------------------------------------------------------------

export function formatLogMessage(message: string): React.ReactNode {
  if (!message) return null;

  // 1. Detect KPIs
  const kpiMatch = message.match(KPI_REGEX);
  if (kpiMatch) {
    const kpiData = cleanJsToJSON(kpiMatch[1]);
    if (kpiData && Array.isArray(kpiData)) {
      return (
        <div>
          <div className="text-gray-400 mb-1">Detected KPIs data:</div>
          <KpiTable kpis={kpiData} />
        </div>
      );
    }
  }

  // 2. Detect Citations
  const citMatch = message.match(CITATIONS_REGEX);
  if (citMatch) {
    const citData = cleanJsToJSON(citMatch[1]);
    if (citData && typeof citData === 'object') {
      return (
        <div>
          <div className="text-gray-400 mb-1">Detected Citations data:</div>
          <CitationTable citations={citData} />
        </div>
      );
    }
  }

  // 3. Detect pure JSON
  const trimmed = message.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const json = JSON.parse(trimmed);
      return <JsonBlock data={json} />;
    } catch {
      // Not valid JSON, continue to text formatting
    }
  }

  // 4. Rich Text Formatting (Bold, Links)
  // Split by bold markers first
  const parts = message.split(BOLD_REGEX);
  
  return (
    <span>
      {parts.map((part, i) => {
        // Even indices are regular text, odd are bold matches (captured group)
        if (i % 2 === 1) {
          return <strong key={i} className="font-bold text-gray-900 dark:text-white">{part}</strong>;
        }
        
        // Process links in regular text
        const subParts = part.split(URL_REGEX);
        return (
          <span key={i}>
            {subParts.map((sub, j) => {
              if (sub.match(URL_REGEX)) {
                return (
                  <a key={j} href={sub} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline decoration-blue-400/30">
                    {sub} 🔗
                  </a>
                );
              }
              return sub;
            })}
          </span>
        );
      })}
    </span>
  );
}
