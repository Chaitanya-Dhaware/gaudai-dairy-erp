/**
 * ReportCard — Renders formatted reports inline in chat messages.
 * Parses markdown-style tables from AI responses.
 */
export default function ReportCard({ content }) {
  if (!content) return null;

  // Parse the report content into sections
  const sections = parseReportContent(content);

  return (
    <div className="gaudai-report">
      {sections.map((section, i) => {
        if (section.type === 'heading') {
          return (
            <h4 key={i} style={{
              margin: '0 0 8px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#0F6E56',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {section.text}
            </h4>
          );
        }

        if (section.type === 'table') {
          return (
            <table key={i}>
              <thead>
                <tr>
                  {section.headers.map((h, j) => (
                    <th key={j}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, j) => (
                  <tr key={j} className={row.isTotal ? 'total-row' : ''}>
                    {row.cells.map((cell, k) => (
                      <td key={k}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }

        if (section.type === 'summary') {
          return (
            <p key={i} style={{
              margin: '10px 0 0',
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151',
              padding: '8px 10px',
              background: '#F0FDF9',
              borderRadius: '8px',
              borderLeft: '3px solid #0F6E56'
            }}>
              {section.text}
            </p>
          );
        }

        // Plain text
        return (
          <p key={i} style={{ fontSize: '12px', color: '#4B5563', margin: '4px 0' }}>
            {section.text}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parse markdown-like report content into renderable sections.
 */
function parseReportContent(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentTable = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      if (currentTable) {
        sections.push(currentTable);
        currentTable = null;
      }
      continue;
    }

    // Heading (** bold ** or starts with 📊)
    if (trimmed.startsWith('📊') || (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.includes('|'))) {
      if (currentTable) {
        sections.push(currentTable);
        currentTable = null;
      }
      sections.push({ type: 'heading', text: trimmed.replace(/\*\*/g, '').trim() });
      continue;
    }

    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').filter(c => c.trim()).map(c => c.trim());

      // Skip separator rows (|---|---|)
      if (cells.every(c => /^[-:]+$/.test(c))) continue;

      if (!currentTable) {
        currentTable = { type: 'table', headers: cells, rows: [] };
      } else {
        currentTable.rows.push({
          cells,
          isTotal: cells.some(c => c.startsWith('**') || c.toLowerCase().includes('total'))
        });
      }
      continue;
    }

    // Summary line (starts with **Totals:** or **Total)
    if (trimmed.startsWith('**Total') || trimmed.startsWith('**Totals')) {
      if (currentTable) {
        sections.push(currentTable);
        currentTable = null;
      }
      sections.push({ type: 'summary', text: trimmed.replace(/\*\*/g, '') });
      continue;
    }

    // Plain text
    if (currentTable) {
      sections.push(currentTable);
      currentTable = null;
    }
    sections.push({ type: 'text', text: trimmed.replace(/\*\*/g, '') });
  }

  if (currentTable) {
    sections.push(currentTable);
  }

  return sections;
}
