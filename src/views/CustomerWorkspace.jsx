import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { Search, UserPlus, ShoppingCart, Trash2, CheckCircle2, Send, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function CustomerWorkspace() {
  const { t, i18n } = useTranslation();
  const isMarathi = i18n.language === 'mr';
  const {
    customers,
    products,
    sales,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addProduct,
    updateProduct,
    deleteProduct,
    addSale,
    recordCustomerPayment,
    loading
  } = useAppStore();

  const [activeTab, setActiveTab] = useState('new-bill'); // new-bill, register, products, dues, history
  const [billModal, setBillModal] = useState(null); // invoice preview modal

  const formatCurrency = (val) => {
    return new Intl.NumberFormat(isMarathi ? 'mr-IN' : 'en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (dateStr) => {
    const localDate = new Date(String(dateStr).replace(/-/g, '/'));
    return new Intl.DateTimeFormat(isMarathi ? 'mr-IN' : 'en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(localDate);
  };

  return (
    <div className="space-y-6 font-body">
      {/* Tab select */}
      <div className="flex border-b border-black/[0.08] overflow-x-auto whitespace-nowrap scrollbar-none gap-2">
        <button
          onClick={() => setActiveTab('new-bill')}
          className={`py-2.5 px-2.5 sm:py-3 sm:px-4 text-[10.5px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'new-bill' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('customer.newBill')}
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`py-2.5 px-2.5 sm:py-3 sm:px-4 text-[10.5px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'register' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('customer.register')}
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`py-2.5 px-2.5 sm:py-3 sm:px-4 text-[10.5px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'products' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('customer.products')}
        </button>
        <button
          onClick={() => setActiveTab('dues')}
          className={`py-2.5 px-2.5 sm:py-3 sm:px-4 text-[10.5px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'dues' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('customer.dues')}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-2.5 px-2.5 sm:py-3 sm:px-4 text-[10.5px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('customer.history')}
        </button>
      </div>

      {/* Render sub view */}
      <div>
        {activeTab === 'new-bill' && (
          <NewBillingTerminal
            customers={customers}
            products={products}
            addSale={addSale}
            loading={loading}
            t={t}
            isMarathi={isMarathi}
            formatCurrency={formatCurrency}
            setBillModal={setBillModal}
          />
        )}
        {activeTab === 'register' && (
          <CustomerRegistration
            customers={customers}
            addCustomer={addCustomer}
            updateCustomer={updateCustomer}
            deleteCustomer={deleteCustomer}
            loading={loading}
            t={t}
            isMarathi={isMarathi}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'products' && (
          <ProductManagement
            products={products}
            addProduct={addProduct}
            updateProduct={updateProduct}
            deleteProduct={deleteProduct}
            t={t}
            isMarathi={isMarathi}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'dues' && (
          <DuesAndPayments
            customers={customers}
            recordCustomerPayment={recordCustomerPayment}
            t={t}
            isMarathi={isMarathi}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'history' && (
          <SalesHistory
            sales={sales}
            customers={customers}
            t={t}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
          />
        )}
      </div>

      {/* Bill Preview Modal with Print & Close option */}
      {billModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-black/[0.08] shadow-2xl p-6 sm:p-8 max-w-md w-full space-y-6">
            
            {/* Header */}
            <div className="flex items-center space-x-3 text-primary border-b border-black/[0.04] pb-4">
              <CheckCircle2 className="w-8 h-8" />
              <div>
                <h3 className="text-base font-bold font-head text-textPrimary">
                  {isMarathi ? 'खरेदी पावती जतन झाली!' : 'Invoice Generated!'}
                </h3>
                <p className="text-[10px] text-textSecondary font-mono">Invoice ID: {billModal.billId}</p>
              </div>
            </div>

            {/* Bill summary table */}
            <div className="space-y-4 text-xs">
              <div className="flex justify-between">
                <span className="text-textSecondary">Customer Name:</span>
                <span className="font-bold text-textPrimary">{billModal.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-textSecondary">Date:</span>
                <span className="font-mono text-textPrimary">{formatDate(billModal.date)}</span>
              </div>

              {/* Items List */}
              <div className="border-t border-b border-black/[0.04] py-3 space-y-2">
                {billModal.items.map((item, i) => (
                  <div key={i} className="flex justify-between font-mono text-[11px]">
                    <span className="font-body font-semibold text-textPrimary">
                      {item.product_name} x {item.quantity}
                    </span>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 font-semibold">
                <div className="flex justify-between">
                  <span className="text-textSecondary">Total Amount:</span>
                  <span className="font-mono text-textPrimary">{formatCurrency(billModal.total_amount)}</span>
                </div>
                <div className="flex justify-between text-primary">
                  <span>Paid Amount:</span>
                  <span className="font-mono">{formatCurrency(billModal.paid_amount)}</span>
                </div>
                <div className="flex justify-between text-danger">
                  <span>Remaining Due:</span>
                  <span className="font-mono">{formatCurrency(billModal.due_amount)}</span>
                </div>
              </div>
            </div>

            {/* WhatsApp Invoice Preview */}
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-xs text-primary leading-relaxed space-y-2">
              <div className="flex items-center space-x-1 font-bold">
                <Send className="w-3.5 h-3.5" />
                <span>WhatsApp Message Dispatched:</span>
              </div>
              <p className="font-mono text-[10px] text-textSecondary italic whitespace-pre-line">
                {isMarathi 
                  ? `नमस्कार ${billModal.customerName},\nखरेदी सारांश — ${formatDate(billModal.date)}:\n${billModal.items.map(item => `${item.product_name} × ${item.quantity} = ₹${item.total}`).join('\n')}\nएकूण: ₹${billModal.total_amount}\nभरले: ₹${billModal.paid_amount}\nबाकी: ₹${billModal.due_amount}\nधन्यवाद, Gaudai डेअरी.`
                  : `Hello ${billModal.customerName},\nPurchase Summary — ${formatDate(billModal.date)}:\n${billModal.items.map(item => `${item.product_name} × ${item.quantity} = ₹${item.total}`).join('\n')}\nTotal: ₹${billModal.total_amount}\nPaid: ₹${billModal.paid_amount}\nDue: ₹${billModal.due_amount}\nThank you, Gaudai Dairy.`}
              </p>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 text-xs pt-2 border-t border-black/[0.04]">
              <button
                onClick={() => setBillModal(null)}
                className="flex-1 py-2.5 border border-black/[0.08] rounded-xl font-semibold text-textSecondary hover:bg-black/[0.02]"
              >
                Close (बंद करा)
              </button>
              <button
                onClick={() => {
                  window.print();
                  setBillModal(null);
                }}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-light transition-all"
              >
                Print Receipt
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// --- SUB-SCREEN 2A: CUSTOMER REGISTRATION ---
function CustomerRegistration({
  customers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  loading,
  t,
  isMarathi,
  formatCurrency
}) {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCustomerId, setEditingCustomerId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!shopName || !ownerName || !mobile) {
      toast.error(isMarathi ? 'कृपया आवश्यक शेतात भरा' : 'Please fill all required fields');
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      toast.error(isMarathi ? 'मोबाईल नंबर १० अंकी असावा' : 'Mobile must be 10 digits');
      return;
    }

    if (editingCustomerId) {
      const success = await updateCustomer(editingCustomerId, {
        shop_name: shopName,
        owner_name: ownerName,
        mobile,
        address
      });
      if (success) {
        handleCancelEdit();
      }
    } else {
      const success = await addCustomer({ shop_name: shopName, owner_name: ownerName, mobile, address });
      if (success) {
        setShopName('');
        setOwnerName('');
        setMobile('');
        setAddress('');
      }
    }
  };

  const handleEditClick = (c) => {
    setEditingCustomerId(c.customer_id);
    setShopName(c.shop_name);
    setOwnerName(c.owner_name);
    setMobile(c.mobile);
    setAddress(c.address || '');
  };

  const handleCancelEdit = () => {
    setEditingCustomerId(null);
    setShopName('');
    setOwnerName('');
    setMobile('');
    setAddress('');
  };

  const handleDeleteClick = async (customerId) => {
    const confirmMsg = isMarathi 
      ? 'तुम्हाला खात्री आहे की तुम्ही हा ग्राहक हटवू इच्छिता?' 
      : 'Are you sure you want to delete this customer?';
    if (window.confirm(confirmMsg)) {
      await deleteCustomer(customerId);
    }
  };

  const filteredCust = customers.filter(c => 
    c.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.owner_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle">
        <h3 className="text-lg font-bold font-head text-primary mb-4 flex items-center space-x-2">
          <UserPlus className="w-5 h-5" />
          <span>{editingCustomerId ? (isMarathi ? 'ग्राहक माहिती दुरुस्त करा' : 'Edit Customer Details') : t('customer.register')}</span>
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-2">{t('customer.shopName')} *</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Shop / Store Name"
              className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-2">{t('customer.ownerName')} *</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Owner's Name"
              className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-2">{t('label.mobile')} *</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="10-digit number"
              className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-2">{t('label.address')}</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Shop Location Address"
              className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
            />
          </div>
          <div className="md:col-span-4 flex justify-end space-x-2">
            {editingCustomerId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-5 py-2.5 border border-black/[0.08] hover:bg-black/[0.02] text-sm font-semibold rounded-xl transition-all cursor-pointer text-textSecondary"
              >
                {isMarathi ? 'रद्द करा' : 'Cancel'}
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-primary hover:bg-primary-light text-white text-sm font-semibold rounded-xl transition-all cursor-pointer"
            >
              {editingCustomerId ? (isMarathi ? 'बदल जतन करा' : 'Save Changes') : t('customer.register')}
            </button>
          </div>
        </form>
      </div>

      {/* Customer Directory */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider">
            {isMarathi ? 'नोंदणीकृत ग्राहक यादी' : 'Registered Customers Directory'}
          </h4>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-textSecondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shop or owner..."
              className="w-full pl-9 pr-3 py-1.5 border border-black/[0.08] rounded-lg text-xs bg-background focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/[0.08] bg-background">
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">ID</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('customer.shopName')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('customer.ownerName')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('label.mobile')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('customer.currentDue')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase text-center">{isMarathi ? 'कृती' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filteredCust.map((c) => {
                const hasAmberDue = c.current_due > 500 && c.current_due <= 2000;
                const hasRedDue = c.current_due > 2000;
                return (
                  <tr key={c.customer_id} className={`hover:bg-black/[0.01] ${
                    hasRedDue ? 'bg-danger/5 text-danger-dark font-medium' : (hasAmberDue ? 'bg-accent/5 text-accent-dark font-medium' : '')
                  }`}>
                    <td className="py-3 px-4 font-mono">{c.customer_id}</td>
                    <td className="py-3 px-4 font-bold">{c.shop_name}</td>
                    <td className="py-3 px-4">{c.owner_name}</td>
                    <td className="py-3 px-4 font-mono">{c.mobile}</td>
                    <td className={`py-3 px-4 font-mono font-bold ${
                      hasRedDue ? 'text-danger' : (hasAmberDue ? 'text-accent' : 'text-textSecondary')
                    }`}>
                      {formatCurrency(c.current_due)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center space-x-3">
                        <button
                          onClick={() => handleEditClick(c)}
                          className="text-primary hover:underline font-semibold cursor-pointer"
                        >
                          {isMarathi ? 'दुरुस्त करा' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleDeleteClick(c.customer_id)}
                          className="text-danger hover:underline font-semibold cursor-pointer"
                        >
                          {isMarathi ? 'हटवा' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- SUB-SCREEN 2B: PRODUCT MANAGEMENT (Admin only) ---
// --- SUB-SCREEN 2B: PRODUCT MANAGEMENT (Admin only) ---
function ProductManagement({
  products,
  addProduct,
  updateProduct,
  deleteProduct,
  t,
  isMarathi,
  formatCurrency
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Milk');
  const [price, setPrice] = useState('');
  const [productIdInput, setProductIdInput] = useState('');
  const [status, setStatus] = useState('Active');
  const [editingProductId, setEditingProductId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !price) {
      toast.error(isMarathi ? 'कृपया आवश्यक शेतात भरा' : 'Please fill all required fields');
      return;
    }
    const unitPriceNum = parseFloat(price);
    if (isNaN(unitPriceNum) || unitPriceNum <= 0) {
      toast.error(isMarathi ? 'कृपया वैध किंमत प्रविष्ट करा' : 'Please enter a valid price');
      return;
    }

    if (editingProductId) {
      // Edit mode
      const success = await updateProduct(
        editingProductId, 
        { product_name: name, category, unit_price: unitPriceNum, status }, 
        productIdInput.trim() || editingProductId
      );
      if (success) {
        handleCancel();
      }
    } else {
      // Add mode
      const success = await addProduct({ 
        product_id: productIdInput.trim() || undefined, 
        product_name: name, 
        category, 
        unit_price: unitPriceNum 
      });
      if (success) {
        handleCancel();
      }
    }
  };

  const handleEditClick = (p) => {
    setEditingProductId(p.product_id);
    setProductIdInput(p.product_id);
    setName(p.product_name);
    setCategory(p.category || 'Milk');
    setPrice(String(p.unit_price));
    setStatus(p.status || 'Active');
  };

  const handleCancel = () => {
    setEditingProductId(null);
    setProductIdInput('');
    setName('');
    setCategory('Milk');
    setPrice('');
    setStatus('Active');
  };

  const handleDeleteClick = async (p) => {
    const confirmMsg = isMarathi 
      ? `तुम्हाला खात्री आहे की तुम्ही '${p.product_name}' हे उत्पादन हटवू इच्छिता?` 
      : `Are you sure you want to delete product '${p.product_name}'?`;
    if (window.confirm(confirmMsg)) {
      await deleteProduct(p.product_id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle">
        <h3 className="text-lg font-bold font-head text-primary mb-4 flex items-center space-x-2">
          <Edit className="w-5 h-5" />
          <span>{editingProductId ? (isMarathi ? 'उत्पादन तपशील दुरुस्त करा' : 'Edit Product Details') : (isMarathi ? 'नवीन उत्पादन जोडा' : 'Add New Product')}</span>
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">
                {isMarathi ? 'उत्पादन आयडी (Product ID)' : 'Product ID'} {!editingProductId && (isMarathi ? '(ऐच्छिक)' : '(Optional)')}
              </label>
              <input
                type="text"
                value={productIdInput}
                onChange={(e) => setProductIdInput(e.target.value)}
                placeholder={editingProductId ? "Product ID" : "Auto-generated"}
                className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">{isMarathi ? 'उत्पादनाचे नाव' : 'Product Name'} *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product SKU Name"
                className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">{isMarathi ? 'श्रेणी' : 'Category'}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
              >
                <option value="Milk">Milk</option>
                <option value="Curd">Curd</option>
                <option value="Lassi">Lassi</option>
                <option value="Shrikhand">Shrikhand</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">{t('customer.unitPrice')} (₹) *</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Unit price (₹)"
                className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-mono"
                required
              />
            </div>
            {editingProductId && (
              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-2">{isMarathi ? 'स्थिती' : 'Status'}</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            {editingProductId && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2.5 border border-black/[0.08] hover:bg-black/[0.02] text-sm font-semibold rounded-xl text-textSecondary cursor-pointer"
              >
                {isMarathi ? 'रद्द करा' : 'Cancel'}
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-primary hover:bg-primary-light text-white text-sm font-semibold rounded-xl cursor-pointer"
            >
              {editingProductId ? (isMarathi ? 'बदल जतन करा' : 'Save Changes') : (isMarathi ? 'उत्पादन जोडा' : 'Add Product')}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/[0.08] bg-background">
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">SKU ID</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">Name</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">Category</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">Price</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">Status</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {products.map((p) => (
                <tr key={p.product_id} className="hover:bg-black/[0.01]">
                  <td className="py-3.5 px-4 font-mono">{p.product_id}</td>
                  <td className="py-3.5 px-4 font-bold text-textPrimary">{p.product_name}</td>
                  <td className="py-3.5 px-4">{p.category}</td>
                  <td className="py-3.5 px-4 font-mono font-semibold">
                    {formatCurrency(p.unit_price)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                      p.status === 'Inactive' 
                        ? 'bg-danger/5 text-danger border-danger/10' 
                        : 'bg-primary/5 text-primary border-primary/10'
                    }`}>
                      {p.status || 'Active'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex justify-center space-x-3">
                      <button
                        onClick={() => handleEditClick(p)}
                        className="text-primary hover:underline font-semibold cursor-pointer flex items-center"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        <span>{isMarathi ? 'दुरुस्त करा' : 'Edit'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(p)}
                        className="text-danger hover:underline font-semibold cursor-pointer flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        <span>{isMarathi ? 'हटवा' : 'Delete'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const generateBillId = () => `B${Math.floor(Math.random() * 900) + 100}`;

// --- SUB-SCREEN 2C: NEW BILL (Staff Billing Terminal) ---
function NewBillingTerminal({
  customers,
  products,
  addSale,
  loading,
  t,
  isMarathi,
  formatCurrency,
  setBillModal
}) {
  const [selectedCustId, setSelectedCustId] = useState('');
  const [cart, setCart] = useState([]);
  
  // Add item form
  const [selProductId, setSelProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [paidAmount, setPaidAmount] = useState('');

  const customer = customers.find(c => c.customer_id === selectedCustId);
  const activeProducts = products.filter(p => p.status === 'Active');

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!selProductId || !quantity || parseFloat(quantity) <= 0) return;
    const product = products.find(p => p.product_id === selProductId);
    if (!product) return;

    // Check if already in cart
    const existingIdx = cart.findIndex(item => item.product_id === selProductId);
    if (existingIdx !== -1) {
      const newCart = [...cart];
      newCart[existingIdx].quantity += parseFloat(quantity);
      newCart[existingIdx].total = newCart[existingIdx].quantity * newCart[existingIdx].unit_price;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          product_id: product.product_id,
          product_name: product.product_name,
          quantity: parseFloat(quantity),
          unit_price: product.unit_price,
          total: parseFloat(quantity) * product.unit_price
        }
      ]);
    }
    setQuantity('');
    setSelProductId('');
  };

  const handleRemoveItem = (id) => {
    setCart(cart.filter(item => item.product_id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const paidVal = parseFloat(paidAmount) || 0;
  const dueVal = Math.max(0, subtotal - paidVal);

  const handleSaveBill = async () => {
    if (!selectedCustId) {
      toast.error(isMarathi ? 'कृपया ग्राहक निवडा' : 'Please select customer');
      return;
    }
    if (cart.length === 0) {
      toast.error(isMarathi ? 'कृपया बिलमध्ये वस्तू जोडा' : 'Cart is empty');
      return;
    }

    const billData = {
      customer_id: selectedCustId,
      items: cart,
      total_amount: subtotal,
      paid_amount: paidVal,
      due_amount: dueVal,
      date: new Date().toISOString().split('T')[0]
    };

    const success = await addSale(billData);
    if (success) {
      // Open Invoice Preview Modal
      setBillModal({
        ...billData,
        customerName: customer.shop_name,
        billId: generateBillId()
      });

      // Reset
      setCart([]);
      setPaidAmount('');
      setSelectedCustId('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Cart items list / builder */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-6">
          <h3 className="text-lg font-bold font-head text-primary border-b border-black/[0.04] pb-4 flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5" />
            <span>{t('customer.newBill')}</span>
          </h3>

          {/* Step 1: Customer Select */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider">{t('customer.customerId')} *</label>
              <select
                value={selectedCustId}
                onChange={(e) => setSelectedCustId(e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-semibold font-mono"
                required
              >
                <option value="">-- {isMarathi ? 'निवडा' : 'Select ID'} --</option>
                {customers.map(c => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.customer_id}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider">{t('customer.customerName')} *</label>
              <select
                value={selectedCustId}
                onChange={(e) => setSelectedCustId(e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-semibold"
                required
              >
                <option value="">-- {isMarathi ? 'नाव निवडा' : 'Select Name'} --</option>
                {customers.map(c => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.shop_name} ({c.owner_name})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {customer && (
            <div className="text-xs font-semibold mt-1">
              <span className="text-textSecondary">{t('customer.currentDue')}: </span>
              <span className={customer.current_due > 0 ? 'text-accent' : 'text-primary'}>
                {formatCurrency(customer.current_due)}
              </span>
            </div>
          )}

          {/* Step 2: Add Product line */}
          <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-background p-4 rounded-xl border border-black/[0.04]">
            <div className="sm:col-span-2 space-y-2">
              <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider">{t('customer.selectProduct')}</label>
              <select
                value={selProductId}
                onChange={(e) => setSelProductId(e.target.value)}
                className="w-full px-3 py-2 border border-black/[0.08] rounded-lg text-sm bg-white"
                required
              >
                <option value="">-- {isMarathi ? 'उत्पादन निवडा' : 'Select Product'} --</option>
                {activeProducts.map(p => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name} - {formatCurrency(p.unit_price)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider">{t('customer.quantity')}</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Qty"
                  className="w-full px-3 py-1.5 border border-black/[0.08] rounded-lg text-sm bg-white font-mono"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-light transition-all cursor-pointer self-end"
              >
                {t('customer.addItem')}
              </button>
            </div>
          </form>

          {/* Running Cart Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/[0.08] bg-background">
                  <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Product</th>
                  <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Qty</th>
                  <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Price</th>
                  <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Amount</th>
                  <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {cart.map((item) => (
                  <tr key={item.product_id} className="hover:bg-black/[0.01]">
                    <td className="py-3 px-4 font-bold text-textPrimary">{item.product_name}</td>
                    <td className="py-3 px-4 font-mono">{item.quantity}</td>
                    <td className="py-3 px-4 font-mono">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 px-4 font-mono font-bold">{formatCurrency(item.total)}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.product_id)}
                        className="p-1 text-danger hover:bg-danger/5 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-textSecondary">
                      {isMarathi ? 'बिलमध्ये वस्तू जोडलेली नाही' : 'Cart is empty. Add products above.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Calculations / Subtotal Panel */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-6">
          <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider border-b border-black/[0.04] pb-3">
            {t('customer.billSummary')}
          </h4>

          <div className="space-y-3 font-semibold text-sm">
            <div className="flex justify-between">
              <span className="text-textSecondary">Subtotal:</span>
              <span className="font-mono text-textPrimary">{formatCurrency(subtotal)}</span>
            </div>
            
            <div className="space-y-2 pt-2 border-t border-black/[0.04]">
              <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider">
                {t('label.paid')} (₹)
              </label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="Amount paid now (₹)"
                className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background font-mono font-bold"
              />
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-black/[0.04]">
              <span className="text-textSecondary uppercase tracking-wider text-xs font-bold">Total Bill:</span>
              <span className="text-lg font-bold font-mono text-primary">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-textSecondary uppercase tracking-wider text-xs font-bold">{t('label.due')}:</span>
              <span className={`text-lg font-bold font-mono ${dueVal > 0 ? 'text-danger' : 'text-primary'}`}>
                {formatCurrency(dueVal)}
              </span>
            </div>
          </div>

          <button
            onClick={handleSaveBill}
            disabled={loading || cart.length === 0}
            className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMarathi ? 'बिल जतन करा (Save Bill)' : 'Save & Print Invoice'}
          </button>
        </div>
      </div>

    </div>
  );
}

// --- SUB-SCREEN 2D: DUES & PAYMENTS ---
function DuesAndPayments({
  customers,
  recordCustomerPayment,
  t,
  isMarathi,
  formatCurrency
}) {
  const [selectedCustId, setSelectedCustId] = useState('');
  const [paymentAmt, setPaymentAmt] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Filter customers who have dues
  const dueCustomers = customers
    .filter(c => c.current_due > 0)
    .sort((a, b) => b.current_due - a.current_due);

  const totalDuesAmount = dueCustomers.reduce((sum, c) => sum + c.current_due, 0);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustId || !paymentAmt || parseFloat(paymentAmt) <= 0) return;
    const success = await recordCustomerPayment(selectedCustId, parseFloat(paymentAmt));
    if (success) {
      setModalOpen(false);
      setSelectedCustId('');
      setPaymentAmt('');
    }
  };

  const handleSendReminder = (custName, amt) => {
    toast.success(isMarathi ? `स्मरणपत्र पाठवले: ${custName} (₹${amt})` : `Reminder triggered for ${custName} (₹${amt})`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{t('customer.totalDue')}</p>
          <p className="text-xl font-bold font-mono text-danger mt-1">{formatCurrency(totalDuesAmount)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{t('customer.customersWithDue')}</p>
          <p className="text-xl font-bold font-mono text-textPrimary mt-1">{dueCustomers.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle flex items-center justify-between">
          <div>
            <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{isMarathi ? 'नवीन जमा नोंद' : 'Record Customer Payment'}</p>
            <p className="text-xs text-textSecondary mt-1">Receive dues payouts</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-3.5 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light cursor-pointer"
          >
            {isMarathi ? 'जमा नोंद' : 'Record Payout'}
          </button>
        </div>
      </div>

      {/* Dues List */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/[0.08] bg-background">
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">Shop Name</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">Owner</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">Outstanding Due</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('customer.daysOverdue')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {dueCustomers.map((c) => (
                <tr key={c.customer_id} className="hover:bg-black/[0.01]">
                  <td className="py-3.5 px-4 font-bold text-textPrimary">{c.shop_name}</td>
                  <td className="py-3.5 px-4 text-textSecondary">{c.owner_name}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-danger">{formatCurrency(c.current_due)}</td>
                  <td className="py-3.5 px-4 font-mono">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      c.current_due > 2000 ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'
                    }`}>
                      {c.current_due > 2000 ? '12 days' : '4 days'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedCustId(c.customer_id);
                        setModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-primary text-white text-[10px] font-bold rounded hover:bg-primary-light cursor-pointer"
                    >
                      {isMarathi ? 'जमा करा' : 'Record Payout'}
                    </button>
                    <button
                      onClick={() => handleSendReminder(c.shop_name, c.current_due)}
                      className="p-1 text-accent hover:bg-accent/5 rounded cursor-pointer"
                      title="Send WhatsApp Reminder"
                    >
                      <Send className="w-4.5 h-4.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {dueCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-textSecondary">
                    {isMarathi ? 'कोणतीही थकबाकी शिल्लक नाही' : 'No outstanding customer dues.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payout modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRecordPayment} className="bg-white rounded-2xl p-6 max-w-sm w-full border border-black/[0.08] shadow-2xl space-y-4">
            <h3 className="text-base font-bold font-head text-primary border-b border-black/[0.04] pb-3">
              {isMarathi ? 'थकबाकी जमा करा' : 'Record Dues Payout'}
            </h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-textSecondary mb-2">{t('customer.selectCustomer')}</label>
                <select
                  value={selectedCustId}
                  onChange={(e) => setSelectedCustId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-background font-semibold"
                  required
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.shop_name} (Due: {formatCurrency(c.current_due)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-textSecondary mb-2">{isMarathi ? 'जमा रक्कम (₹)' : 'Payout Amount (₹)'}</label>
                <input
                  type="number"
                  value={paymentAmt}
                  onChange={(e) => setPaymentAmt(e.target.value)}
                  placeholder="Enter ₹ amount"
                  className="w-full px-3 py-2 border rounded-xl font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div className="flex space-x-3 justify-end text-xs pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setSelectedCustId('');
                  setPaymentAmt('');
                }}
                className="px-4 py-2 border border-black/[0.08] rounded-xl font-semibold text-textSecondary hover:bg-black/[0.02]"
              >
                {t('btn.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-xl font-semibold"
              >
                {t('btn.save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// --- SUB-SCREEN 2E: SALES HISTORY ---
function SalesHistory({ sales, customers, t, formatDate, formatCurrency }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
      <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider border-b border-black/[0.04] pb-4">
        {t('customer.history')}
      </h4>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-black/[0.08] bg-background">
              <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Bill ID</th>
              <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Customer</th>
              <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Date</th>
              <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Total Bill</th>
              <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Paid</th>
              <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Due Remaining</th>
              <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {sales.map((s) => {
              const customer = customers.find(c => c.customer_id === s.customer_id);
              return (
                <tr key={s.bill_id} className="hover:bg-black/[0.01]">
                  <td className="py-3 px-4 font-mono font-medium">{s.bill_id}</td>
                  <td className="py-3 px-4 font-bold text-textPrimary">{customer?.shop_name || 'Generic Customer'}</td>
                  <td className="py-3 px-4 font-mono text-textSecondary">{formatDate(s.date)}</td>
                  <td className="py-3 px-4 font-mono font-bold">{formatCurrency(s.total_amount)}</td>
                  <td className="py-3 px-4 font-mono text-primary">{formatCurrency(s.paid_amount)}</td>
                  <td className={`py-3 px-4 font-mono font-bold ${s.due_amount > 0 ? 'text-danger' : 'text-textSecondary'}`}>
                    {formatCurrency(s.due_amount)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                      s.status === 'Paid' ? 'bg-primary/5 text-primary border-primary/20' : 
                      s.status === 'Partial' ? 'bg-accent/5 text-accent border-accent/20' : 
                      'bg-danger/5 text-danger border-danger/20'
                    }`}>
                      {t(`status.${s.status.toLowerCase()}`)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CustomerWorkspace;
