import { useChatStore } from '../../store/chatStore';
import { Check, X, AlertTriangle } from 'lucide-react';

/**
 * DataPreviewCard — Shows extracted data for user confirmation before saving.
 * Handles both single-action and batch OCR imports.
 */
export default function DataPreviewCard({ action }) {
  const { confirmAction, rejectAction, isProcessing } = useChatStore();

  if (!action) return null;

  const { type, data, summary } = action;

  // Single action card (from NLP)
  if (type !== 'OCR_CONFIRM') {
    return (
      <div className="gaudai-action-card">
        <div className="gaudai-action-card-header">
          <span className={`badge ${getBadgeClass(type)}`}>
            {getTypeIcon(type)} {getTypeLabel(type)}
          </span>
        </div>

        {summary && (
          <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 8px', lineHeight: 1.5 }}>
            {summary}
          </p>
        )}

        <table className="gaudai-action-table">
          <tbody>
            {renderDataFields(type, data)}
          </tbody>
        </table>

        <div className="gaudai-action-buttons">
          <button
            className="gaudai-btn cancel"
            onClick={rejectAction}
            disabled={isProcessing}
          >
            <X size={14} /> Cancel
          </button>
          <button
            className="gaudai-btn confirm"
            onClick={confirmAction}
            disabled={isProcessing}
          >
            <Check size={14} /> {isProcessing ? 'Saving...' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    );
  }

  // Batch OCR card
  const entries = data?.entries || [];
  const validEntries = entries.filter(e => e.validation?.valid);
  const invalidEntries = entries.filter(e => !e.validation?.valid);

  return (
    <div className="gaudai-action-card">
      <div className="gaudai-action-card-header">
        <span className={`badge ${getBadgeClass(data?.document_type)}`}>
          {getDocTypeIcon(data?.document_type)} {data?.document_type || 'DOCUMENT'} SCAN
        </span>
        <span style={{ fontSize: '11px', color: '#6B7280', marginLeft: 'auto' }}>
          {validEntries.length}/{entries.length} matched
        </span>
      </div>

      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        <table className="gaudai-action-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              {data?.document_type === 'COLLECTION' && (
                <>
                  <th>Qty</th>
                  <th>Fat</th>
                  <th>Total</th>
                </>
              )}
              {data?.document_type === 'EXPENSE' && (
                <>
                  <th>Amount</th>
                  <th>Category</th>
                </>
              )}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i} className={entry.validation?.valid ? '' : 'invalid'}>
                <td>{i + 1}</td>
                <td>{entry.matched_name || entry.name}</td>
                {data?.document_type === 'COLLECTION' && (
                  <>
                    <td>{entry.fields?.quantity || '—'}</td>
                    <td>{entry.fields?.fat || '—'}</td>
                    <td>₹{entry.calculated?.total?.toFixed(0) || '—'}</td>
                  </>
                )}
                {data?.document_type === 'EXPENSE' && (
                  <>
                    <td>₹{entry.fields?.amount || '—'}</td>
                    <td>{entry.fields?.category || 'Other'}</td>
                  </>
                )}
                <td>
                  {entry.validation?.valid ? (
                    <Check size={14} style={{ color: '#16A34A' }} />
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <AlertTriangle size={12} style={{ color: '#DC2626' }} />
                      <span className="warning-cell">
                        {entry.validation?.warnings?.[0] || 'Invalid'}
                      </span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invalidEntries.length > 0 && (
        <p style={{ fontSize: '11px', color: '#DC2626', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={12} />
          {invalidEntries.length} entries could not be matched and will be skipped.
        </p>
      )}

      <div className="gaudai-action-buttons">
        <button
          className="gaudai-btn cancel"
          onClick={rejectAction}
          disabled={isProcessing}
        >
          <X size={14} /> Cancel
        </button>
        <button
          className="gaudai-btn confirm"
          onClick={confirmAction}
          disabled={isProcessing || validEntries.length === 0}
        >
          <Check size={14} />
          {isProcessing ? 'Saving...' : `Save ${validEntries.length} Entries`}
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function renderDataFields(type, data) {
  if (!data) return null;

  const fields = [];

  switch (type) {
    case 'ADD_COLLECTION':
      fields.push(
        ['Farmer', data.farmer_name || data.farmer_id],
        ['Milk Type', data.milk_type],
        ['Quantity', `${data.quantity} L`],
        ['Fat', data.fat],
        ['SNF', data.snf],
        ['Date', data.date]
      );
      break;
    case 'ADD_EXPENSE':
      fields.push(
        ['Reason', data.reason],
        ['Amount', `₹${parseFloat(data.amount || 0).toLocaleString('en-IN')}`],
        ['Category', data.category],
        ['Payment', data.payment_method || 'Cash'],
        ['Date', data.date]
      );
      break;
    case 'ADD_SALE':
      fields.push(
        ['Customer', data.customer_name || data.customer_id],
        ['Total', `₹${parseFloat(data.total_amount || 0).toLocaleString('en-IN')}`],
        ['Paid', `₹${parseFloat(data.paid_amount || 0).toLocaleString('en-IN')}`],
        ['Due', `₹${parseFloat(data.due_amount || 0).toLocaleString('en-IN')}`],
        ['Date', data.date]
      );
      break;
    case 'RECORD_PAYMENT':
      fields.push(
        ['Customer', data.customer_name || data.customer_id],
        ['Amount', `₹${parseFloat(data.amount || 0).toLocaleString('en-IN')}`]
      );
      break;
    case 'MARK_FARMER_PAID':
      fields.push(
        ['Entry', data.entry_id],
        ['Amount', `₹${parseFloat(data.amount || 0).toLocaleString('en-IN')}`]
      );
      break;
    case 'REGISTER_FARMER':
      fields.push(
        ['Name', data.name],
        ['Mobile', data.mobile || '—'],
        ['Milk Type', data.milk_type || 'Cow'],
        ['Address', data.address || '—']
      );
      break;
    case 'ADD_CUSTOMER':
      fields.push(
        ['Shop Name', data.shop_name],
        ['Owner', data.owner_name],
        ['Mobile', data.mobile || '—'],
        ['Address', data.address || '—']
      );
      break;
    default:
      Object.entries(data).forEach(([k, v]) => {
        if (typeof v !== 'object') fields.push([k, String(v)]);
      });
  }

  return fields.map(([label, value], i) => (
    <tr key={i}>
      <td style={{ fontWeight: 500, color: '#6B7280', width: '35%' }}>{label}</td>
      <td style={{ color: '#1A1A1A' }}>{value || '—'}</td>
    </tr>
  ));
}

function getTypeLabel(type) {
  const labels = {
    ADD_COLLECTION: 'Collection',
    ADD_EXPENSE: 'Expense',
    ADD_SALE: 'Sale',
    RECORD_PAYMENT: 'Payment',
    MARK_FARMER_PAID: 'Payment',
    REGISTER_FARMER: 'New Farmer',
    ADD_CUSTOMER: 'New Customer'
  };
  return labels[type] || type;
}

function getTypeIcon(type) {
  const icons = {
    ADD_COLLECTION: '🥛',
    ADD_EXPENSE: '💰',
    ADD_SALE: '🛒',
    RECORD_PAYMENT: '💳',
    MARK_FARMER_PAID: '💳',
    REGISTER_FARMER: '👨‍🌾',
    ADD_CUSTOMER: '🏪'
  };
  return icons[type] || '📋';
}

function getBadgeClass(type) {
  if (type === 'ADD_COLLECTION' || type === 'COLLECTION') return 'collection';
  if (type === 'ADD_SALE' || type === 'SALES') return 'sales';
  if (type === 'ADD_EXPENSE' || type === 'EXPENSE') return 'expense';
  return 'payment';
}

function getDocTypeIcon(docType) {
  const icons = { COLLECTION: '🥛', SALES: '🛒', EXPENSE: '💰', PAYMENT: '💳' };
  return icons[docType] || '📄';
}
