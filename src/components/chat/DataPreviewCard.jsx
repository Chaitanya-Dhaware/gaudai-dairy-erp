import { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useAppStore } from '../../store/appStore';
import { Check, X, AlertTriangle, Trash2, Plus } from 'lucide-react';

/**
 * DataPreviewCard — Shows extracted data for user confirmation before saving.
 * Handles both single-action and batch OCR imports with interactive editing.
 */
export default function DataPreviewCard({ action }) {
  const { confirmAction, rejectAction, isProcessing, updatePendingActionData } = useChatStore();
  const { farmers = [], customers = [], settings = {} } = useAppStore();
  const baseRate = settings.baseRate || 8.5;

  const [prevAction, setPrevAction] = useState(action);
  const [localEntries, setLocalEntries] = useState(action?.data?.entries || []);

  if (action !== prevAction) {
    setPrevAction(action);
    setLocalEntries(action?.data?.entries || []);
  }


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

  // Helper to re-run validation on an entry
  const runValidation = (entry) => {
    const docType = data?.document_type;
    const warnings = [];

    if (docType === 'COLLECTION') {
      const qty = parseFloat(entry.fields?.quantity);
      const fat = parseFloat(entry.fields?.fat);
      if (!entry.matched_id) {
        warnings.push("Farmer not found in records");
      }
      if (isNaN(qty) || qty <= 0) {
        warnings.push("Qty must be > 0");
      }
      if (isNaN(fat) || fat <= 0) {
        warnings.push("Fat must be > 0");
      }
    } else if (docType === 'SALES') {
      const qty = parseFloat(entry.fields?.quantity);
      const total = parseFloat(entry.fields?.total || entry.fields?.amount);
      if (!entry.matched_id) {
        warnings.push("Customer not found in records");
      }
      if (!entry.fields?.product) {
        warnings.push("Product is required");
      }
      if (isNaN(qty) || qty <= 0) {
        warnings.push("Qty must be > 0");
      }
      if (isNaN(total) || total <= 0) {
        warnings.push("Total must be > 0");
      }
    } else if (docType === 'EXPENSE') {
      const amt = parseFloat(entry.fields?.amount);
      const reason = entry.fields?.reason || entry.name;
      if (!reason) {
        warnings.push("Reason is required");
      }
      if (isNaN(amt) || amt <= 0) {
        warnings.push("Amount must be > 0");
      }
    } else if (docType === 'PAYMENT') {
      const amt = parseFloat(entry.fields?.amount);
      if (!entry.matched_id) {
        warnings.push("Person not found in records");
      }
      if (isNaN(amt) || amt <= 0) {
        warnings.push("Amount must be > 0");
      }
    } else if (docType === 'CUSTOMER_LIST' || docType === 'CUSTOMERS') {
      const shopName = entry.fields?.shop_name || entry.name;
      const ownerName = entry.fields?.owner_name;
      if (!shopName && !ownerName) {
        warnings.push("Shop name or Owner name is required");
      }
    } else if (docType === 'FARMER_LIST' || docType === 'FARMERS') {
      const name = entry.fields?.name || entry.name;
      if (!name) {
        warnings.push("Name is required");
      }
    }

    entry.validation = {
      valid: warnings.length === 0,
      warnings
    };
  };

  // Handler for entry input changes
  const handleEntryChange = (index, fieldPath, val) => {
    const updatedEntries = [...localEntries];
    const current = { ...updatedEntries[index] };
    
    if (fieldPath.length === 1) {
      current[fieldPath[0]] = val;
    } else if (fieldPath.length === 2) {
      current[fieldPath[0]] = {
        ...(current[fieldPath[0]] || {}),
        [fieldPath[1]]: val
      };
    }

    const docType = data?.document_type;
    
    if (docType === 'COLLECTION') {
      const qty = parseFloat(current.fields?.quantity) || 0;
      const fat = parseFloat(current.fields?.fat) || 0;
      const rate = fat * baseRate;
      const total = rate * qty;
      current.calculated = {
        rate: Math.round(rate * 100) / 100,
        total: Math.round(total * 100) / 100
      };

      if (fieldPath[0] === 'matched_id') {
        const selectedFarmer = farmers.find(f => f.farmer_id === val);
        if (selectedFarmer) {
          current.matched_name = selectedFarmer.name;
          current.name = selectedFarmer.name;
        } else {
          current.matched_name = '';
        }
      }
    }

    if (docType === 'PAYMENT' && fieldPath[0] === 'matched_id') {
      const selectedFarmer = farmers.find(f => f.farmer_id === val);
      const selectedCustomer = customers.find(c => c.customer_id === val);
      if (selectedFarmer) {
        current.matched_name = selectedFarmer.name;
        current.name = selectedFarmer.name;
      } else if (selectedCustomer) {
        current.matched_name = selectedCustomer.shop_name;
        current.name = selectedCustomer.shop_name;
      } else {
        current.matched_name = '';
      }
    }

    if (docType === 'SALES' && fieldPath[0] === 'matched_id') {
      const selectedCustomer = customers.find(c => c.customer_id === val);
      if (selectedCustomer) {
        current.matched_name = selectedCustomer.shop_name;
        current.name = selectedCustomer.shop_name;
      } else {
        current.matched_name = '';
      }
    }

    runValidation(current);

    updatedEntries[index] = current;
    setLocalEntries(updatedEntries);
    updatePendingActionData({ entries: updatedEntries });
  };

  // Handler for adding a new empty entry
  const handleAddEntry = () => {
    const docType = data?.document_type;
    const newEntry = {
      name: '',
      matched_id: '',
      matched_name: '',
      date: data?.extracted_date || new Date().toISOString().split('T')[0],
      fields: {},
      validation: { valid: false, warnings: ['Empty entry'] }
    };

    if (docType === 'COLLECTION') {
      newEntry.fields = { quantity: '', fat: '', snf: '8.5', milk_type: 'Cow' };
      newEntry.calculated = { rate: 0, total: 0 };
    } else if (docType === 'SALES') {
      newEntry.fields = { product: 'Milk', quantity: '', total: '' };
    } else if (docType === 'EXPENSE') {
      newEntry.fields = { reason: '', amount: '', category: 'Other' };
    } else if (docType === 'PAYMENT') {
      newEntry.fields = { amount: '' };
    } else if (docType === 'CUSTOMER_LIST' || docType === 'CUSTOMERS') {
      newEntry.fields = { shop_name: '', owner_name: '', mobile: '', address: '' };
    } else if (docType === 'FARMER_LIST' || docType === 'FARMERS') {
      newEntry.fields = { name: '', mobile: '', address: '', milk_type: 'Cow' };
    }

    const updatedEntries = [...localEntries, newEntry];
    setLocalEntries(updatedEntries);
    updatePendingActionData({ entries: updatedEntries });
  };

  // Handler for removing an entry
  const handleRemoveEntry = (index) => {
    const updatedEntries = localEntries.filter((_, i) => i !== index);
    setLocalEntries(updatedEntries);
    updatePendingActionData({ entries: updatedEntries });
  };

  // Batch OCR card calculations
  const entries = localEntries;
  const validEntries = entries.filter(e => e.validation?.valid);
  const invalidEntries = entries.filter(e => !e.validation?.valid);

  return (
    <div className="gaudai-action-card">
      <div className="gaudai-action-card-header">
        <span className={`badge ${getBadgeClass(data?.document_type)}`}>
          {getDocTypeIcon(data?.document_type)} {data?.document_type || 'DOCUMENT'} SCAN
        </span>
        <span style={{ fontSize: '11px', color: '#6B7280', marginLeft: 'auto' }}>
          {validEntries.length}/{entries.length} {(data?.document_type === 'CUSTOMER_LIST' || data?.document_type === 'CUSTOMERS' || data?.document_type === 'FARMER_LIST' || data?.document_type === 'FARMERS') ? 'valid' : 'matched'}
        </span>
      </div>

      <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
        <table className="gaudai-action-table">
          <thead>
            <tr>
              <th style={{ width: '24px' }}>#</th>
              <th>Name</th>
              {data?.document_type === 'COLLECTION' && (
                <>
                  <th style={{ width: '60px' }}>Qty</th>
                  <th style={{ width: '50px' }}>Fat</th>
                  <th style={{ width: '60px' }}>Total</th>
                </>
              )}
              {data?.document_type === 'EXPENSE' && (
                <>
                  <th style={{ width: '70px' }}>Amount</th>
                  <th style={{ width: '90px' }}>Category</th>
                </>
              )}
              {data?.document_type === 'SALES' && (
                <>
                  <th>Product</th>
                  <th style={{ width: '55px' }}>Qty</th>
                  <th style={{ width: '70px' }}>Total</th>
                </>
              )}
              {data?.document_type === 'PAYMENT' && (
                <>
                  <th style={{ width: '80px' }}>Amount</th>
                </>
              )}
              {(data?.document_type === 'CUSTOMER_LIST' || data?.document_type === 'CUSTOMERS') && (
                <>
                  <th>Owner</th>
                  <th>Mobile</th>
                  <th>Address</th>
                </>
              )}
              {(data?.document_type === 'FARMER_LIST' || data?.document_type === 'FARMERS') && (
                <>
                  <th>Mobile</th>
                  <th>Milk Type</th>
                  <th>Address</th>
                </>
              )}
              <th style={{ width: '85px', textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i} className={entry.validation?.valid ? '' : 'invalid-row'} style={{ opacity: entry.validation?.valid ? 1 : 0.85 }}>
                <td>{i + 1}</td>
                
                {/* Name Column */}
                <td>
                  {data?.document_type === 'COLLECTION' && (
                    <select
                      className="gaudai-table-select"
                      value={entry.matched_id || ''}
                      onChange={(e) => handleEntryChange(i, ['matched_id'], e.target.value)}
                    >
                      <option value="">Select Farmer...</option>
                      {farmers.map(f => (
                        <option key={f.farmer_id} value={f.farmer_id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {data?.document_type === 'SALES' && (
                    <select
                      className="gaudai-table-select"
                      value={entry.matched_id || ''}
                      onChange={(e) => handleEntryChange(i, ['matched_id'], e.target.value)}
                    >
                      <option value="">Select Customer...</option>
                      {customers.map(c => (
                        <option key={c.customer_id} value={c.customer_id}>
                          {c.shop_name} ({c.owner_name})
                        </option>
                      ))}
                    </select>
                  )}

                  {data?.document_type === 'PAYMENT' && (
                    <select
                      className="gaudai-table-select"
                      value={entry.matched_id || ''}
                      onChange={(e) => handleEntryChange(i, ['matched_id'], e.target.value)}
                    >
                      <option value="">Select Person...</option>
                      <optgroup label="Customers">
                        {customers.map(c => (
                          <option key={c.customer_id} value={c.customer_id}>
                            {c.shop_name} (Customer)
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Farmers">
                        {farmers.map(f => (
                          <option key={f.farmer_id} value={f.farmer_id}>
                            {f.name} (Farmer)
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  )}

                  {data?.document_type === 'EXPENSE' && (
                    <input
                      type="text"
                      className="gaudai-table-input"
                      value={entry.fields?.reason || entry.name || ''}
                      onChange={(e) => handleEntryChange(i, ['fields', 'reason'], e.target.value)}
                      placeholder="Reason"
                    />
                  )}

                  {(data?.document_type === 'CUSTOMER_LIST' || data?.document_type === 'CUSTOMERS') && (
                    <input
                      type="text"
                      className="gaudai-table-input"
                      value={entry.fields?.shop_name || entry.name || ''}
                      onChange={(e) => handleEntryChange(i, ['fields', 'shop_name'], e.target.value)}
                      placeholder="Shop Name"
                    />
                  )}

                  {(data?.document_type === 'FARMER_LIST' || data?.document_type === 'FARMERS') && (
                    <input
                      type="text"
                      className="gaudai-table-input"
                      value={entry.fields?.name || entry.name || ''}
                      onChange={(e) => handleEntryChange(i, ['fields', 'name'], e.target.value)}
                      placeholder="Farmer Name"
                    />
                  )}
                </td>

                {/* Additional Columns based on Document Type */}
                {data?.document_type === 'COLLECTION' && (
                  <>
                    <td>
                      <input
                        type="number"
                        className="gaudai-table-input"
                        value={entry.fields?.quantity || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'quantity'], e.target.value)}
                        placeholder="Liters"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        className="gaudai-table-input"
                        value={entry.fields?.fat || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'fat'], e.target.value)}
                        placeholder="Fat"
                      />
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      ₹{entry.calculated?.total?.toFixed(0) || '0'}
                    </td>
                  </>
                )}

                {data?.document_type === 'EXPENSE' && (
                  <>
                    <td>
                      <input
                        type="number"
                        className="gaudai-table-input"
                        value={entry.fields?.amount || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'amount'], e.target.value)}
                        placeholder="Amount"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="gaudai-table-input"
                        value={entry.fields?.category || 'Other'}
                        onChange={(e) => handleEntryChange(i, ['fields', 'category'], e.target.value)}
                        placeholder="Category"
                      />
                    </td>
                  </>
                )}

                {data?.document_type === 'SALES' && (
                  <>
                    <td>
                      <input
                        type="text"
                        className="gaudai-table-input"
                        value={entry.fields?.product || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'product'], e.target.value)}
                        placeholder="Product"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="gaudai-table-input"
                        value={entry.fields?.quantity || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'quantity'], e.target.value)}
                        placeholder="Qty"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="gaudai-table-input"
                        value={entry.fields?.total || entry.fields?.amount || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'total'], e.target.value)}
                        placeholder="Total"
                      />
                    </td>
                  </>
                )}

                {data?.document_type === 'PAYMENT' && (
                  <>
                    <td>
                      <input
                        type="number"
                        className="gaudai-table-input"
                        value={entry.fields?.amount || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'amount'], e.target.value)}
                        placeholder="Amount"
                      />
                    </td>
                  </>
                )}

                {(data?.document_type === 'CUSTOMER_LIST' || data?.document_type === 'CUSTOMERS') && (
                  <>
                    <td>
                      <input
                        type="text"
                        className="gaudai-table-input"
                        value={entry.fields?.owner_name || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'owner_name'], e.target.value)}
                        placeholder="Owner Name"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="gaudai-table-input"
                        value={entry.fields?.mobile || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'mobile'], e.target.value)}
                        placeholder="Mobile"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="gaudai-table-input"
                        value={entry.fields?.address || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'address'], e.target.value)}
                        placeholder="Address"
                      />
                    </td>
                  </>
                )}

                {(data?.document_type === 'FARMER_LIST' || data?.document_type === 'FARMERS') && (
                  <>
                    <td>
                      <input
                        type="text"
                        className="gaudai-table-input"
                        value={entry.fields?.mobile || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'mobile'], e.target.value)}
                        placeholder="Mobile"
                      />
                    </td>
                    <td>
                      <select
                        className="gaudai-table-select"
                        value={entry.fields?.milk_type || 'Cow'}
                        onChange={(e) => handleEntryChange(i, ['fields', 'milk_type'], e.target.value)}
                      >
                        <option value="Cow">Cow</option>
                        <option value="Buffalo">Buffalo</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="gaudai-table-input"
                        value={entry.fields?.address || ''}
                        onChange={(e) => handleEntryChange(i, ['fields', 'address'], e.target.value)}
                        placeholder="Address"
                      />
                    </td>
                  </>
                )}

                {/* Validation Status & Delete Button */}
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    {entry.validation?.valid ? (
                      <Check size={14} style={{ color: '#16A34A', flexShrink: 0 }} />
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} title={entry.validation?.warnings?.join(', ')}>
                        <AlertTriangle size={12} style={{ color: '#DC2626', flexShrink: 0 }} />
                        <span className="warning-cell" style={{ display: 'inline-block', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.validation?.warnings?.[0] || 'Invalid'}
                        </span>
                      </span>
                    )}
                    <button
                      type="button"
                      className="gaudai-delete-btn"
                      onClick={() => handleRemoveEntry(i)}
                      title="Remove row"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          className="gaudai-add-row-btn"
          onClick={handleAddEntry}
        >
          <Plus size={14} /> Add Entry Row
        </button>
      </div>

      {invalidEntries.length > 0 && (
        <p style={{ fontSize: '11px', color: '#DC2626', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={12} />
          {invalidEntries.length} entries have validation warnings and will be skipped unless corrected.
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
  if (type === 'CUSTOMER_LIST' || type === 'CUSTOMERS' || type === 'FARMER_LIST' || type === 'FARMERS') return 'collection';
  return 'payment';
}

function getDocTypeIcon(docType) {
  const icons = {
    COLLECTION: '🥛',
    SALES: '🛒',
    EXPENSE: '💰',
    PAYMENT: '💳',
    CUSTOMER_LIST: '🏪',
    CUSTOMERS: '🏪',
    FARMER_LIST: '👨‍🌾',
    FARMERS: '👨‍🌾'
  };
  return icons[docType] || '📄';
}
