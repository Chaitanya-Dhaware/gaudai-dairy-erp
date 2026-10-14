import { useState, useMemo } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useAppStore } from '../../store/appStore';
import { exportToExcel } from '../../utils/gaudaiAI';
import {
  FileSpreadsheet,
  Check,
  AlertTriangle,
  Download,
  Sparkles,
  Database,
  X,
  ChevronDown,
  Layers,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

// ERP Module Target Field Definitions
const ERP_MODULES = {
  COLLECTION: {
    label: '🥛 Milk Collection',
    fields: [
      { key: 'name', label: 'Farmer Name', required: true, auto: ['farmer', 'name', 'farmer name', 'शेतकरी'] },
      { key: 'quantity', label: 'Milk Qty (L)', required: true, type: 'number', auto: ['quantity', 'qty', 'litres', 'liters', 'milk', 'दूध'] },
      { key: 'fat', label: 'Fat %', required: false, type: 'number', auto: ['fat', 'fat %', 'फॅट'] },
      { key: 'snf', label: 'SNF', required: false, type: 'number', auto: ['snf', 'एसएनएफ'] },
      { key: 'milk_type', label: 'Milk Type (Cow/Buffalo)', required: false, auto: ['type', 'milk type', 'गाय/म्हैस'] },
      { key: 'date', label: 'Collection Date', required: false, auto: ['date', 'collection date', 'दिनांक', 'तारीख'] }
    ]
  },
  FARMERS: {
    label: '👨‍🌾 Farmer Directory',
    fields: [
      { key: 'name', label: 'Farmer Name', required: true, auto: ['farmer', 'name', 'farmer name', 'शेतकरी'] },
      { key: 'mobile', label: 'Mobile Number', required: false, auto: ['mobile', 'phone', 'contact', 'मोबाईल'] },
      { key: 'address', label: 'Village / Address', required: false, auto: ['address', 'village', 'गाव', 'पत्ता'] },
      { key: 'milk_type', label: 'Milk Type', required: false, auto: ['milk type', 'type'] }
    ]
  },
  CUSTOMERS: {
    label: '🏪 Customer Directory',
    fields: [
      { key: 'shop_name', label: 'Shop / Dairy Name', required: true, auto: ['shop', 'dairy', 'customer', 'ग्राहक', 'दुकान'] },
      { key: 'owner_name', label: 'Owner Name', required: false, auto: ['owner', 'proprietor', 'नाव'] },
      { key: 'mobile', label: 'Mobile Number', required: false, auto: ['mobile', 'phone', 'मोबाईल'] },
      { key: 'address', label: 'Address / Route', required: false, auto: ['address', 'area', 'route', 'पत्ता'] }
    ]
  },
  SALES: {
    label: '🛒 Sales & Invoices',
    fields: [
      { key: 'name', label: 'Customer Name', required: true, auto: ['customer', 'shop', 'buyer', 'नाव'] },
      { key: 'product', label: 'Product Name', required: false, auto: ['product', 'item', 'माल'] },
      { key: 'quantity', label: 'Quantity', required: false, type: 'number', auto: ['quantity', 'qty', 'नग'] },
      { key: 'price', label: 'Unit Price (₹)', required: false, type: 'number', auto: ['rate', 'price', 'दर'] },
      { key: 'total', label: 'Total Amount (₹)', required: true, type: 'number', auto: ['total', 'amount', 'एकूण'] },
      { key: 'date', label: 'Sale Date', required: false, auto: ['date', 'दिनांक'] }
    ]
  },
  EXPENSES: {
    label: '💰 Expenses',
    fields: [
      { key: 'reason', label: 'Expense Reason / Item', required: true, auto: ['reason', 'description', 'item', 'खर्च'] },
      { key: 'amount', label: 'Amount (₹)', required: true, type: 'number', auto: ['amount', 'cost', 'रक्कम'] },
      { key: 'category', label: 'Category', required: false, auto: ['category', 'type', 'प्रकार'] },
      { key: 'date', label: 'Expense Date', required: false, auto: ['date', 'दिनांक'] }
    ]
  }
};

/**
 * SpreadsheetPreviewCard
 * Provides spreadsheet inspection, sheet selection, column mapping,
 * data cleaning checks, and batch ERP importing with role authorization.
 */
export default function SpreadsheetPreviewCard({ previewData, onDismiss }) {
  const { fileName, fileSize, sheetsMap } = previewData;
  const sheetNames = Object.keys(sheetsMap || {});
  const [currentSheet, setCurrentSheet] = useState(sheetNames[0] || '');
  const [selectedModule, setSelectedModule] = useState('COLLECTION');
  const [isImporting, setIsImporting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [excludedRowIndices, setExcludedRowIndices] = useState(new Set());

  const { sendMessage, addAssistantMessage } = useChatStore();
  const { user, farmers = [], customers = [], settings = {} } = useAppStore();

  const currentRows = useMemo(() => {
    return sheetsMap?.[currentSheet] || [];
  }, [sheetsMap, currentSheet]);

  const rawColumns = useMemo(() => {
    if (!currentRows || currentRows.length === 0) return [];
    return Object.keys(currentRows[0]);
  }, [currentRows]);

  // Initial auto-mapping based on column name heuristics
  const [columnMapping, setColumnMapping] = useState(() => {
    const initial = {};
    const moduleFields = ERP_MODULES.COLLECTION.fields;
    rawColumns.forEach(col => {
      const lower = col.toLowerCase().trim();
      const matched = moduleFields.find(f => f.auto.some(pattern => lower.includes(pattern)));
      if (matched) {
        initial[matched.key] = col;
      }
    });
    return initial;
  });

  // Re-run auto mapping if target module changes
  const handleModuleChange = (newModuleKey) => {
    setSelectedModule(newModuleKey);
    const newMapping = {};
    const targetFields = ERP_MODULES[newModuleKey]?.fields || [];
    targetFields.forEach(f => {
      const matchedCol = rawColumns.find(col => {
        const lower = col.toLowerCase().trim();
        return f.auto.some(pattern => lower.includes(pattern));
      });
      if (matchedCol) {
        newMapping[f.key] = matchedCol;
      }
    });
    setColumnMapping(newMapping);
  };

  // Inspect data quality
  const healthCheck = useMemo(() => {
    let missingCount = 0;
    const seenNames = new Set();
    let duplicateCount = 0;
    const nameCol = columnMapping['name'] || columnMapping['shop_name'] || columnMapping['reason'];

    currentRows.forEach((row) => {
      // Check required fields
      const modFields = ERP_MODULES[selectedModule]?.fields || [];
      const hasMissingRequired = modFields.some(f => {
        if (!f.required) return false;
        const col = columnMapping[f.key];
        return !col || row[col] === undefined || row[col] === null || String(row[col]).trim() === '';
      });
      if (hasMissingRequired) missingCount++;

      // Check duplicates
      if (nameCol && row[nameCol]) {
        const val = String(row[nameCol]).trim().toLowerCase();
        if (seenNames.has(val)) {
          duplicateCount++;
        } else {
          seenNames.add(val);
        }
      }
    });

    return {
      total: currentRows.length,
      missing: missingCount,
      duplicates: duplicateCount,
      clean: Math.max(0, currentRows.length - missingCount)
    };
  }, [currentRows, columnMapping, selectedModule]);

  // Toggle row inclusion/exclusion
  const toggleRow = (index) => {
    setExcludedRowIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Ask AI for natural-language analysis
  const handleAnalyzeWithAI = () => {
    const summaryPrompt = `Please analyze the uploaded spreadsheet "${fileName}" (Sheet: "${currentSheet}").
Summarize the contents, calculate the key totals and averages, highlight the top contributors, identify any anomalies or duplicate entries, and format the output in a clean table with insights.`;
    sendMessage(summaryPrompt);
    if (onDismiss) onDismiss();
  };

  // Export cleaned rows
  const handleExportCleaned = () => {
    const rowsToExport = currentRows.filter((_, idx) => !excludedRowIndices.has(idx));
    if (rowsToExport.length === 0) {
      toast.error('No rows selected to export');
      return;
    }
    exportToExcel(rowsToExport, `${fileName.replace(/\.[^/.]+$/, '')}_cleaned`);
    toast.success(`Exported ${rowsToExport.length} rows to Excel`);
  };

  // Commit Import into ERP
  const handleCommitImport = async () => {
    // 1. Authorization check
    const isAuthorized = user && ['superadmin', 'admin', 'staff', 'accountant'].includes(user.role);
    if (!isAuthorized) {
      toast.error('Unauthorized: You need admin or staff privileges to import records into the ERP.');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errorDetails = [];

    const activeRows = currentRows.filter((_, idx) => !excludedRowIndices.has(idx));

    try {
      const appState = useAppStore.getState();
      const baseRate = settings.baseRate || 8.5;

      for (let i = 0; i < activeRows.length; i++) {
        const row = activeRows[i];

        if (selectedModule === 'COLLECTION') {
          const rawName = String(row[columnMapping['name']] || '').trim();
          const rawQty = parseFloat(row[columnMapping['quantity']]) || 0;
          const rawFat = parseFloat(row[columnMapping['fat']]) || 4.0;
          const rawSnf = parseFloat(row[columnMapping['snf']]) || 8.5;
          const rawDate = row[columnMapping['date']] || new Date().toISOString().split('T')[0];
          const rawType = row[columnMapping['milk_type']] || 'Cow';

          if (!rawName || rawQty <= 0) {
            skippedCount++;
            continue;
          }

          // Match or find farmer
          const matchedFarmer = farmers.find(f =>
            f.name.toLowerCase() === rawName.toLowerCase() ||
            f.farmer_id.toLowerCase() === rawName.toLowerCase()
          );

          let farmerId = matchedFarmer?.farmer_id;

          // If farmer not found, auto-register them
          if (!farmerId) {
            const regSuccess = await appState.registerFarmer({
              name: rawName,
              mobile: '',
              address: 'Imported via Spreadsheet',
              milk_type: rawType
            });
            if (regSuccess) {
              const updatedFarmers = useAppStore.getState().farmers;
              const newlyAdded = updatedFarmers.find(f => f.name.toLowerCase() === rawName.toLowerCase());
              farmerId = newlyAdded?.farmer_id;
            }
          }

          if (!farmerId) {
            failedCount++;
            errorDetails.push(`Row ${i + 1}: Could not find or register farmer "${rawName}"`);
            continue;
          }

          const rate = rawFat * baseRate;
          const totalAmount = rate * rawQty;

          const saved = await appState.addMilkCollection({
            farmer_id: farmerId,
            date: String(rawDate).slice(0, 10),
            milk_type: rawType,
            quantity: rawQty,
            fat: rawFat,
            snf: rawSnf,
            calculated_rate: rate,
            total_amount: totalAmount,
            paid_amount: 0,
            due_amount: totalAmount
          });

          if (saved) successCount++;
          else {
            failedCount++;
            errorDetails.push(`Row ${i + 1}: Failed to save collection record`);
          }
        } else if (selectedModule === 'FARMERS') {
          const name = String(row[columnMapping['name']] || '').trim();
          const mobile = String(row[columnMapping['mobile']] || '').trim();
          const address = String(row[columnMapping['address']] || '').trim();
          const milkType = String(row[columnMapping['milk_type']] || 'Cow').trim();

          if (!name) {
            skippedCount++;
            continue;
          }

          // Check if farmer already exists
          const existing = farmers.find(f => f.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            skippedCount++;
            continue;
          }

          const res = await appState.registerFarmer({ name, mobile, address, milk_type: milkType });
          if (res) successCount++;
          else failedCount++;
        } else if (selectedModule === 'CUSTOMERS') {
          const shopName = String(row[columnMapping['shop_name']] || '').trim();
          const ownerName = String(row[columnMapping['owner_name']] || shopName).trim();
          const mobile = String(row[columnMapping['mobile']] || '').trim();
          const address = String(row[columnMapping['address']] || '').trim();

          if (!shopName) {
            skippedCount++;
            continue;
          }

          // Check duplicate
          const existing = customers.find(c => c.shop_name.toLowerCase() === shopName.toLowerCase());
          if (existing) {
            skippedCount++;
            continue;
          }

          const res = await appState.addCustomer({ shop_name: shopName, owner_name: ownerName, mobile, address });
          if (res) successCount++;
          else failedCount++;
        } else if (selectedModule === 'EXPENSES') {
          const reason = String(row[columnMapping['reason']] || 'Expense').trim();
          const amount = parseFloat(row[columnMapping['amount']]) || 0;
          const category = String(row[columnMapping['category']] || 'Operations').trim();
          const date = String(row[columnMapping['date']] || new Date().toISOString().split('T')[0]).slice(0, 10);

          if (amount <= 0) {
            skippedCount++;
            continue;
          }

          const res = await appState.addExpense({
            date,
            reason,
            amount,
            category,
            payment_method: 'Cash',
            notes: `Imported from ${fileName}`
          });
          if (res) successCount++;
          else failedCount++;
        }
      }

      // Add summary message into conversation
      const summaryMsg = `✅ **Spreadsheet Import Complete**
- **File:** ${fileName} (Sheet: ${currentSheet})
- **Module:** ${ERP_MODULES[selectedModule]?.label}
- **Successfully Imported:** ${successCount} records
- **Skipped / Duplicate:** ${skippedCount} records
${failedCount > 0 ? `- **Failed:** ${failedCount} records\n${errorDetails.slice(0, 5).join('\n')}` : ''}`;

      addAssistantMessage(summaryMsg, 'success');
      toast.success(`Import complete: ${successCount} records saved!`);
      if (onDismiss) onDismiss();
    } catch (err) {
      console.error('Import error:', err);
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
      setShowConfirmModal(false);
    }
  };

  const targetFields = ERP_MODULES[selectedModule]?.fields || [];

  return (
    <div className="gaudai-spreadsheet-card">
      {/* ─── Header ───────────────────────────────────────────── */}
      <div className="gaudai-spreadsheet-header">
        <div className="gaudai-spreadsheet-title">
          <FileSpreadsheet size={20} color="#0F6E56" />
          <div>
            <h4>{fileName}</h4>
            <span style={{ fontSize: 10, color: '#6B7280' }}>
              {fileSize < 1024 * 1024 ? (fileSize / 1024).toFixed(1) + ' KB' : (fileSize / (1024 * 1024)).toFixed(1) + ' MB'} · {sheetNames.length} sheet{sheetNames.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ─── Sheet Selector (if multi-sheet) ─────────────────── */}
      {sheetNames.length > 1 && (
        <div className="gaudai-spreadsheet-sheet-tabs">
          <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', alignSelf: 'center', marginRight: 4 }}>
            <Layers size={12} style={{ display: 'inline', marginRight: 2 }} /> Sheets:
          </span>
          {sheetNames.map(name => (
            <button
              key={name}
              className={`gaudai-sheet-tab ${currentSheet === name ? 'active' : ''}`}
              onClick={() => setCurrentSheet(name)}
            >
              {name} ({sheetsMap[name]?.length || 0})
            </button>
          ))}
        </div>
      )}

      {/* ─── Health / Quality Stats ──────────────────────────── */}
      <div className="gaudai-spreadsheet-stats">
        <span className="gaudai-stat-badge rows">
          <strong>{healthCheck.total}</strong> rows in {currentSheet}
        </span>
        <span className="gaudai-stat-badge success">
          <strong>{healthCheck.clean}</strong> valid
        </span>
        {healthCheck.missing > 0 && (
          <span className="gaudai-stat-badge warning">
            <AlertTriangle size={12} /> {healthCheck.missing} missing values
          </span>
        )}
        {healthCheck.duplicates > 0 && (
          <span className="gaudai-stat-badge warning">
            <Info size={12} /> {healthCheck.duplicates} duplicates
          </span>
        )}
      </div>

      {/* ─── Target Module & Column Mapping ──────────────────── */}
      <div className="gaudai-mapping-section">
        <div className="gaudai-mapping-title">
          <span>Target ERP Module</span>
          <select
            value={selectedModule}
            onChange={(e) => handleModuleChange(e.target.value)}
            className="gaudai-mapping-select"
            style={{ fontWeight: 600, color: '#0F6E56', borderColor: '#0F6E56' }}
          >
            {Object.entries(ERP_MODULES).map(([key, mod]) => (
              <option key={key} value={key}>{mod.label}</option>
            ))}
          </select>
        </div>

        <div className="gaudai-mapping-grid">
          {targetFields.map(field => (
            <div key={field.key} className="gaudai-mapping-item">
              <label>
                {field.label} {field.required && <span style={{ color: '#EF4444' }}>*</span>}
              </label>
              <select
                value={columnMapping[field.key] || ''}
                onChange={(e) => {
                  setColumnMapping(prev => ({
                    ...prev,
                    [field.key]: e.target.value
                  }));
                }}
                className="gaudai-mapping-select"
              >
                <option value="">— Select Column —</option>
                {rawColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Row Preview Table ───────────────────────────────── */}
      <div className="gaudai-spreadsheet-preview-table-container">
        <table className="gaudai-action-table">
          <thead>
            <tr>
              <th style={{ width: 28, textAlign: 'center' }}>#</th>
              {targetFields.map(f => (
                <th key={f.key}>{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.slice(0, 10).map((row, idx) => {
              const isExcluded = excludedRowIndices.has(idx);
              return (
                <tr key={idx} style={{ opacity: isExcluded ? 0.4 : 1, background: isExcluded ? '#F3F4F6' : undefined }}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      onChange={() => toggleRow(idx)}
                      title={isExcluded ? 'Include row' : 'Exclude row'}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  {targetFields.map(f => {
                    const colName = columnMapping[f.key];
                    const val = colName ? row[colName] : '';
                    const isMissing = f.required && (val === undefined || val === null || val === '');
                    return (
                      <td key={f.key} style={{ color: isMissing ? '#EF4444' : undefined, fontWeight: isMissing ? 600 : undefined }}>
                        {isMissing ? '⚠️ Missing' : String(val ?? '')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {currentRows.length > 10 && (
          <div style={{ textAlign: 'center', padding: '4px', fontSize: 10, color: '#6B7280', background: '#F9FAFB' }}>
            Showing first 10 of {currentRows.length} rows
          </div>
        )}
      </div>

      {/* ─── Card Action Buttons ──────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleAnalyzeWithAI}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', fontSize: 11, fontWeight: 600,
              borderRadius: 6, border: '1px solid #D1D5DB', background: '#F9FAFB',
              color: '#374151', cursor: 'pointer'
            }}
          >
            <Sparkles size={13} color="#0F6E56" /> Analyze with AI
          </button>
          <button
            onClick={handleExportCleaned}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', fontSize: 11, fontWeight: 600,
              borderRadius: 6, border: '1px solid #D1D5DB', background: '#F9FAFB',
              color: '#374151', cursor: 'pointer'
            }}
          >
            <Download size={13} /> Export Cleaned
          </button>
        </div>

        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={isImporting || healthCheck.clean === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', fontSize: 11, fontWeight: 600,
            borderRadius: 6, border: 'none',
            background: isImporting ? '#9CA3AF' : 'linear-gradient(135deg, #0F6E56, #148C6E)',
            color: 'white', cursor: isImporting ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 4px rgba(15, 110, 86, 0.2)'
          }}
        >
          <Database size={13} />
          {isImporting ? 'Importing...' : `Import ${healthCheck.clean - excludedRowIndices.size} Records`}
        </button>
      </div>

      {/* ─── Confirmation Modal ───────────────────────────────── */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 18, maxWidth: 360, width: '100%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Confirm Import into {ERP_MODULES[selectedModule]?.label}
            </h4>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#4B5563', lineHeight: 1.4 }}>
              You are about to import <strong>{healthCheck.clean - excludedRowIndices.size}</strong> records from sheet <em>"{currentSheet}"</em> into the live database.
            </p>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '8px 10px', marginBottom: 14, fontSize: 11, color: '#166534' }}>
              ✓ Duplicate checks will prevent overwriting<br />
              ✓ Original uploaded file remains untouched
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isImporting}
                style={{
                  padding: '6px 12px', fontSize: 12, borderRadius: 6,
                  border: '1px solid #D1D5DB', background: 'white', color: '#374151', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCommitImport}
                disabled={isImporting}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                  border: 'none', background: '#0F6E56', color: 'white', cursor: 'pointer'
                }}
              >
                {isImporting ? 'Importing...' : 'Yes, Import Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
