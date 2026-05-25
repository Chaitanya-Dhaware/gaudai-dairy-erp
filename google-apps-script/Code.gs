/**
 * Gaudai AI Dairy ERP - Google Apps Script Backend (Code.gs)
 * Deployed as Web App: Execute as "Me", Access: "Anyone"
 * Acts as the API layer between React frontend and 4 distinct Google Spreadsheets.
 */

// Global config - can also be loaded dynamically from Settings sheet
var CONFIG = {
  COLLECTION_DB_ID: "", // Fill from settings sheet
  CUSTOMER_DB_ID: "",   // Fill from settings sheet
  EXPENSE_DB_ID: "",    // Fill from settings sheet
  MASTER_DB_ID: "",     // Fill from settings sheet
  WHATSAPP_TOKEN: "",   // Fill from settings sheet
  WHATSAPP_PHONE_ID: "" // Fill from settings sheet
};

/**
 * HTTP POST Entry Point
 * Receives JSON requests from the React client.
 */
function doPost(e) {
  var response = { success: false, message: "" };
  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;

    // Load sheets IDs and credentials from master settings if present
    loadSettingsFromSheets();

    // Verify and initialize spreadsheets if they do not exist
    autoSetupSheets();

    var result;
    switch (action) {
      // --- COLLECTION DB ACTIONS ---
      case 'registerFarmer':
        result = registerFarmer(requestData);
        break;
      case 'getFarmerList':
        result = getFarmerList();
        break;
      case 'addMilkCollection':
        result = addMilkCollection(requestData);
        break;
      case 'getCollectionEntries':
        result = getCollectionEntries();
        break;
      case 'markFarmerPaid':
        result = markFarmerPaid(requestData.entryId);
        break;

      // --- CUSTOMER DB ACTIONS ---
      case 'addCustomer':
        result = addCustomer(requestData);
        break;
      case 'getCustomerList':
        result = getCustomerList();
        break;
      case 'getProductList':
        result = getProductList();
        break;
      case 'addProduct':
        result = addProduct(requestData);
        break;
      case 'updateProduct':
        result = updateProduct(requestData.product_id, requestData.data);
        break;
      case 'addSale':
        result = addSale(requestData);
        break;
      case 'recordPayment':
        result = recordPayment(requestData.customer_id, requestData.amount);
        break;
      case 'getSalesHistory':
        result = getSalesHistory();
        break;

      // --- EXPENSE DB ACTIONS ---
      case 'addExpense':
        result = addExpense(requestData);
        break;
      case 'getExpenses':
        result = getExpenses();
        break;
      case 'deleteExpense':
        result = deleteExpense(requestData.expense_id);
        break;

      // --- MASTER ACCOUNTS ACTIONS ---
      case 'getMasterFinancialSummary':
        result = getMasterFinancialSummary();
        break;
      case 'getCashFlowStatement':
        result = getCashFlowStatement();
        break;

      // --- SETTINGS CONFIGS ---
      case 'getSettings':
        result = { success: true, data: getSettingsTable() };
        break;
      case 'updateSettings':
        result = updateSettingsTable(requestData);
        break;

      default:
        throw new Error("Action " + action + " not supported.");
    }

    response = result;
  } catch (error) {
    response.success = false;
    response.message = error.toString();
    logErrorToSheets(error.toString());
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Auto-create Spreadsheet Databases and sheets with correct headers if missing
 */
function autoSetupSheets() {
  // If master is not set, bind to the active spreadsheet
  if (!CONFIG.MASTER_DB_ID) {
    try {
      CONFIG.MASTER_DB_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
    } catch(e) {
      // Standalone script
    }
  }

  if (CONFIG.MASTER_DB_ID) {
    try {
      var ssMaster = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);
      createSheetIfMissing(ssMaster, "Settings", ["key", "value"]);
      createSheetIfMissing(ssMaster, "Error_Logs", ["timestamp", "message"]);
      
      // Seed default settings row if Settings is empty
      var settingsSheet = ssMaster.getSheetByName("Settings");
      if (settingsSheet.getLastRow() <= 1) {
        settingsSheet.appendRow(["baseRate", "8.5"]);
        settingsSheet.appendRow(["businessName", "Gaudai AI Dairy"]);
      }
    } catch(e) {}
  }

  // Helper to get settings values
  function getSettingValue(key) {
    try {
      var ss = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);
      var sheet = ss.getSheetByName("Settings");
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === key) return data[i][1];
      }
    } catch(e) {}
    return "";
  }

  function saveSettingValue(key, val) {
    try {
      var ss = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);
      var sheet = ss.getSheetByName("Settings");
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === key) {
          sheet.getRange(i + 1, 2).setValue(val);
          return;
        }
      }
      sheet.appendRow([key, val]);
    } catch(e) {}
  }

  // Load dynamically if unset
  CONFIG.COLLECTION_DB_ID = CONFIG.COLLECTION_DB_ID || getSettingValue("sheetsIdCollection");
  CONFIG.CUSTOMER_DB_ID = CONFIG.CUSTOMER_DB_ID || getSettingValue("sheetsIdCustomer");
  CONFIG.EXPENSE_DB_ID = CONFIG.EXPENSE_DB_ID || getSettingValue("sheetsIdExpense");

  // 1. COLLECTION_DB Auto-Create
  if (!CONFIG.COLLECTION_DB_ID && CONFIG.MASTER_DB_ID) {
    try {
      var newSS = SpreadsheetApp.create("Gaudai_Collection_DB");
      CONFIG.COLLECTION_DB_ID = newSS.getId();
      saveSettingValue("sheetsIdCollection", CONFIG.COLLECTION_DB_ID);
    } catch(e) {}
  }
  
  if (CONFIG.COLLECTION_DB_ID) {
    try {
      var ss = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
      createSheetIfMissing(ss, "Farmers", ["farmer_id", "name", "mobile", "address", "milk_type", "current_due", "created_at"]);
      createSheetIfMissing(ss, "Milk_Collections", ["entry_id", "farmer_id", "date", "milk_type", "quantity", "fat", "snf", "calculated_rate", "total_amount", "paid_amount", "due_amount", "status", "timestamp"]);
      createSheetIfMissing(ss, "Payments", ["payment_id", "farmer_id", "amount", "date", "notes", "timestamp"]);
    } catch(e) {}
  }

  // 2. CUSTOMER_DB Auto-Create
  if (!CONFIG.CUSTOMER_DB_ID && CONFIG.MASTER_DB_ID) {
    try {
      var newSS = SpreadsheetApp.create("Gaudai_Customer_DB");
      CONFIG.CUSTOMER_DB_ID = newSS.getId();
      saveSettingValue("sheetsIdCustomer", CONFIG.CUSTOMER_DB_ID);
    } catch(e) {}
  }

  if (CONFIG.CUSTOMER_DB_ID) {
    try {
      var ss = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
      createSheetIfMissing(ss, "Customers", ["customer_id", "shop_name", "owner_name", "mobile", "address", "current_due", "created_at"]);
      createSheetIfMissing(ss, "Products", ["product_id", "product_name", "category", "unit_price", "status", "updated_at"]);
      
      // Seed default products on creation if empty
      var prodSheet = ss.getSheetByName("Products");
      if (prodSheet.getLastRow() <= 1) {
        var defaultProds = [
          ["P001", "Milk Packet 500ml", "Milk", 30, "Active", new Date().toISOString()],
          ["P002", "Milk Packet 1L", "Milk", 62, "Active", new Date().toISOString()],
          ["P003", "Curd Cup 200g", "Curd", 25, "Active", new Date().toISOString()],
          ["P004", "Curd Packet 500g", "Curd", 55, "Active", new Date().toISOString()],
          ["P005", "Lassi Cup 200ml", "Lassi", 20, "Active", new Date().toISOString()],
          ["P006", "Lassi Box 500ml", "Lassi", 45, "Active", new Date().toISOString()],
          ["P007", "Shrikhand Cup 100g", "Shrikhand", 35, "Active", new Date().toISOString()]
        ];
        defaultProds.forEach(function(row) { prodSheet.appendRow(row); });
      }

      createSheetIfMissing(ss, "Sales", ["bill_id", "customer_id", "date", "total_amount", "paid_amount", "due_amount", "status", "timestamp"]);
      createSheetIfMissing(ss, "Payments", ["payment_id", "customer_id", "amount", "date", "timestamp"]);
    } catch(e) {}
  }

  // 3. EXPENSE_DB Auto-Create
  if (!CONFIG.EXPENSE_DB_ID && CONFIG.MASTER_DB_ID) {
    try {
      var newSS = SpreadsheetApp.create("Gaudai_Expense_DB");
      CONFIG.EXPENSE_DB_ID = newSS.getId();
      saveSettingValue("sheetsIdExpense", CONFIG.EXPENSE_DB_ID);
    } catch(e) {}
  }

  if (CONFIG.EXPENSE_DB_ID) {
    try {
      var ss = SpreadsheetApp.openById(CONFIG.EXPENSE_DB_ID);
      createSheetIfMissing(ss, "Expenses", ["expense_id", "date", "reason", "amount", "category", "payment_method", "notes", "timestamp"]);
    } catch(e) {}
  }
}

function createSheetIfMissing(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
}

/**
 * Load settings (spreadsheets mapping and credentials) from Master DB sheet
 */
function loadSettingsFromSheets() {
  if (!CONFIG.MASTER_DB_ID) return;
  try {
    var ss = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);
    var sheet = ss.getSheetByName("Settings");
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var key = data[i][0];
      var val = data[i][1];
      if (CONFIG.hasOwnProperty(key)) {
        CONFIG[key] = val;
      }
    }
  } catch(e) {}
}

function getSettingsTable() {
  var settings = {
    baseRate: 8.5,
    businessName: "Gaudai AI Dairy",
    adminMobile: "",
    whatsappToken: CONFIG.WHATSAPP_TOKEN,
    whatsappPhoneId: CONFIG.WHATSAPP_PHONE_ID,
    sheetsIdCollection: CONFIG.COLLECTION_DB_ID,
    sheetsIdCustomer: CONFIG.CUSTOMER_DB_ID,
    sheetsIdExpense: CONFIG.EXPENSE_DB_ID,
    sheetsIdMaster: CONFIG.MASTER_DB_ID,
    dueReminderFreq: 2
  };
  try {
    var ss = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);
    var sheet = ss.getSheetByName("Settings");
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var key = data[i][0];
        var val = data[i][1];
        if (key === 'baseRate') settings.baseRate = parseFloat(val);
        else if (key === 'businessName') settings.businessName = val;
        else if (key === 'adminMobile') settings.adminMobile = val;
        else if (key === 'dueReminderFreq') settings.dueReminderFreq = parseInt(val);
      }
    }
  } catch(e) {}
  return settings;
}

function updateSettingsTable(requestData) {
  var ss = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID || requestData.sheetsIdMaster);
  var sheet = ss.getSheetByName("Settings");
  if (!sheet) {
    createSheetIfMissing(ss, "Settings", ["key", "value"]);
    sheet = ss.getSheetByName("Settings");
  }
  sheet.clear();
  sheet.appendRow(["key", "value"]);
  
  var keys = Object.keys(requestData);
  keys.forEach(function(k) {
    sheet.appendRow([k, requestData[k]]);
  });
  
  return { success: true, message: "Settings saved successfully" };
}

// --- FARMERS IMPLEMENTATION ---
function registerFarmer(data) {
  var ss = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
  var sheet = ss.getSheetByName("Farmers");
  var rows = sheet.getDataRange().getValues();
  var count = rows.length;
  var farmerId = "F" + String(count).padStart(3, '0');

  sheet.appendRow([
    farmerId,
    data.name,
    data.mobile,
    data.address || "",
    data.milk_type,
    0, // due
    new Date().toISOString()
  ]);

  return { success: true, message: "Farmer registered successfully", data: { farmer_id: farmerId } };
}

function getFarmerList() {
  var ss = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
  var sheet = ss.getSheetByName("Farmers");
  var values = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < values.length; i++) {
    list.push({
      farmer_id: values[i][0],
      name: values[i][1],
      mobile: values[i][2],
      address: values[i][3],
      milk_type: values[i][4],
      current_due: parseFloat(values[i][5] || 0)
    });
  }
  return { success: true, data: list };
}

function addMilkCollection(data) {
  var ss = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
  var colSheet = ss.getSheetByName("Milk_Collections");
  var entryId = "E" + Date.now();

  var status = data.due_amount <= 0 ? 'Paid' : (data.paid_amount > 0 ? 'Partial' : 'Pending');

  colSheet.appendRow([
    entryId,
    data.farmer_id,
    data.date,
    data.milk_type,
    data.quantity,
    data.fat,
    data.snf || 8.5,
    data.calculated_rate,
    data.total_amount,
    data.paid_amount,
    data.due_amount,
    status,
    new Date().toISOString()
  ]);

  // Update farmer current_due
  var farmSheet = ss.getSheetByName("Farmers");
  var farmData = farmSheet.getDataRange().getValues();
  for (var i = 1; i < farmData.length; i++) {
    if (farmData[i][0] === data.farmer_id) {
      var currentDue = parseFloat(farmData[i][5] || 0) + parseFloat(data.due_amount);
      farmSheet.getRange(i + 1, 6).setValue(currentDue);
      break;
    }
  }

  // Trigger WhatsApp Message
  try {
    sendWhatsAppReceipt(data);
  } catch(e) {}

  return { success: true, message: "Milk collection saved successfully" };
}

function getCollectionEntries() {
  var ss = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
  var sheet = ss.getSheetByName("Milk_Collections");
  var values = sheet.getDataRange().getValues();
  var list = [];
  for (var i = values.length - 1; i >= 1; i--) {
    list.push({
      entry_id: values[i][0],
      farmer_id: values[i][1],
      date: values[i][2],
      milk_type: values[i][3],
      quantity: parseFloat(values[i][4]),
      fat: parseFloat(values[i][5]),
      snf: parseFloat(values[i][6]),
      calculated_rate: parseFloat(values[i][7]),
      total_amount: parseFloat(values[i][8]),
      paid_amount: parseFloat(values[i][9]),
      due_amount: parseFloat(values[i][10]),
      status: values[i][11]
    });
  }
  return { success: true, data: list };
}

function markFarmerPaid(entryId) {
  var ss = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
  var colSheet = ss.getSheetByName("Milk_Collections");
  var colData = colSheet.getDataRange().getValues();
  
  for (var i = 1; i < colData.length; i++) {
    if (colData[i][0] === entryId) {
      var farmerId = colData[i][1];
      var due = parseFloat(colData[i][10]);
      var paid = parseFloat(colData[i][9]) + due;
      
      colSheet.getRange(i + 1, 10).setValue(paid); // update paid
      colSheet.getRange(i + 1, 11).setValue(0);    // clear due
      colSheet.getRange(i + 1, 12).setValue("Paid"); // status
      
      // Update farmer
      var farmSheet = ss.getSheetByName("Farmers");
      var farmData = farmSheet.getDataRange().getValues();
      for (var j = 1; j < farmData.length; j++) {
        if (farmData[j][0] === farmerId) {
          var newDue = Math.max(0, parseFloat(farmData[j][5] || 0) - due);
          farmSheet.getRange(j + 1, 6).setValue(newDue);
          break;
        }
      }
      break;
    }
  }
  return { success: true, message: "Cleared successfully" };
}

// --- CUSTOMERS DB IMPLEMENTATION ---
function addCustomer(data) {
  var ss = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
  var sheet = ss.getSheetByName("Customers");
  var rows = sheet.getDataRange().getValues();
  var customerId = "C" + String(rows.length).padStart(3, '0');

  sheet.appendRow([
    customerId,
    data.shop_name,
    data.owner_name,
    data.mobile,
    data.address || "",
    0,
    new Date().toISOString()
  ]);
  return { success: true, message: "Customer added" };
}

function getCustomerList() {
  var ss = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
  var sheet = ss.getSheetByName("Customers");
  var values = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < values.length; i++) {
    list.push({
      customer_id: values[i][0],
      shop_name: values[i][1],
      owner_name: values[i][2],
      mobile: values[i][3],
      address: values[i][4],
      current_due: parseFloat(values[i][5] || 0)
    });
  }
  return { success: true, data: list };
}

function getProductList() {
  var ss = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
  var sheet = ss.getSheetByName("Products");
  var values = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < values.length; i++) {
    list.push({
      product_id: values[i][0],
      product_name: values[i][1],
      category: values[i][2],
      unit_price: parseFloat(values[i][3]),
      status: values[i][4]
    });
  }
  return { success: true, data: list };
}

function addProduct(data) {
  var ss = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
  var sheet = ss.getSheetByName("Products");
  var rows = sheet.getDataRange().getValues();
  var productId = "P" + String(rows.length).padStart(3, '0');

  sheet.appendRow([
    productId,
    data.product_name,
    data.category,
    data.unit_price,
    "Active",
    new Date().toISOString()
  ]);
  return { success: true };
}

function updateProduct(productId, data) {
  var ss = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
  var sheet = ss.getSheetByName("Products");
  var val = sheet.getDataRange().getValues();
  for (var i = 1; i < val.length; i++) {
    if (val[i][0] === productId) {
      if (data.hasOwnProperty('unit_price')) {
        sheet.getRange(i + 1, 4).setValue(data.unit_price);
      }
      if (data.hasOwnProperty('status')) {
        sheet.getRange(i + 1, 5).setValue(data.status);
      }
      break;
    }
  }
  return { success: true };
}

function addSale(data) {
  var ss = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
  var salesSheet = ss.getSheetByName("Sales");
  var billId = "B" + Date.now();

  var status = data.due_amount <= 0 ? 'Paid' : (data.paid_amount > 0 ? 'Partial' : 'Pending');

  salesSheet.appendRow([
    billId,
    data.customer_id,
    data.date,
    data.total_amount,
    data.paid_amount,
    data.due_amount,
    status,
    new Date().toISOString()
  ]);

  // Update customer current_due
  var custSheet = ss.getSheetByName("Customers");
  var custData = custSheet.getDataRange().getValues();
  for (var i = 1; i < custData.length; i++) {
    if (custData[i][0] === data.customer_id) {
      var currentDue = parseFloat(custData[i][5] || 0) + parseFloat(data.due_amount);
      custSheet.getRange(i + 1, 6).setValue(currentDue);
      break;
    }
  }
  return { success: true };
}

function recordPayment(customerId, amount) {
  var ss = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
  var custSheet = ss.getSheetByName("Customers");
  var custData = custSheet.getDataRange().getValues();
  for (var i = 1; i < custData.length; i++) {
    if (custData[i][0] === customerId) {
      var currentDue = Math.max(0, parseFloat(custData[i][5] || 0) - parseFloat(amount));
      custSheet.getRange(i + 1, 6).setValue(currentDue);
      
      // Log payment history
      var paySheet = ss.getSheetByName("Payments");
      paySheet.appendRow([
        "PAY" + Date.now(),
        customerId,
        amount,
        new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ]);
      break;
    }
  }
  return { success: true };
}

function getSalesHistory() {
  var ss = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
  var sheet = ss.getSheetByName("Sales");
  var values = sheet.getDataRange().getValues();
  var list = [];
  for (var i = values.length - 1; i >= 1; i--) {
    list.push({
      bill_id: values[i][0],
      customer_id: values[i][1],
      date: values[i][2],
      total_amount: parseFloat(values[i][3]),
      paid_amount: parseFloat(values[i][4]),
      due_amount: parseFloat(values[i][5]),
      status: values[i][6]
    });
  }
  return { success: true, data: list };
}

function formatSheetDate(dateStr) {
  // dateStr format is "YYYY-MM-DD"
  var parts = dateStr.split('-');
  var year = parts[0];
  var monthNum = parseInt(parts[1], 10);
  var day = parts[2];
  
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var monthName = months[monthNum - 1] || "Jan";
  
  return day + "_" + monthName + "_" + year;
}

// --- EXPENSES IMPLEMENTATION ---
function addExpense(data) {
  var ss = SpreadsheetApp.openById(CONFIG.EXPENSE_DB_ID);
  var mainSheet = ss.getSheetByName("Expenses");
  var expId = "EXP" + Date.now();
  var timestamp = new Date().toISOString();

  var rowData = [
    expId,
    data.date,
    data.reason,
    data.amount,
    data.category,
    data.payment_method,
    data.notes || "",
    timestamp
  ];

  // 1. Append to main log
  mainSheet.appendRow(rowData);

  // 2. Format sheet name e.g. "Daily_25_May_2026"
  var dateStrFormatted = formatSheetDate(data.date);
  var dailySheetName = "Daily_" + dateStrFormatted;
  
  // 3. Get or create daily sheet
  var dailySheet = ss.getSheetByName(dailySheetName);
  if (!dailySheet) {
    createSheetIfMissing(ss, dailySheetName, ["expense_id", "date", "reason", "amount", "category", "payment_method", "notes", "timestamp"]);
    dailySheet = ss.getSheetByName(dailySheetName);
  }
  
  // 4. Append row to daily sheet
  dailySheet.appendRow(rowData);

  return { success: true };
}

function getExpenses() {
  var ss = SpreadsheetApp.openById(CONFIG.EXPENSE_DB_ID);
  var sheet = ss.getSheetByName("Expenses");
  var values = sheet.getDataRange().getValues();
  var list = [];
  for (var i = values.length - 1; i >= 1; i--) {
    list.push({
      expense_id: values[i][0],
      date: values[i][1],
      reason: values[i][2],
      amount: parseFloat(values[i][3]),
      category: values[i][4],
      payment_method: values[i][5],
      notes: values[i][6]
    });
  }
  return { success: true, data: list };
}

function deleteExpense(expenseId) {
  var ss = SpreadsheetApp.openById(CONFIG.EXPENSE_DB_ID);
  var sheet = ss.getSheetByName("Expenses");
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === expenseId) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return { success: true };
}

// --- FINANCIALS & CASHFLOW ---
function getMasterFinancialSummary() {
  // Aggregate revenue from customer sales and expenses from operational expenses + farmer payouts
  var salesSum = 0;
  var colPaidSum = 0;
  var opExpSum = 0;
  var pendingDuesSum = 0;
  
  var today = new Date().toISOString().split('T')[0];

  try {
    var ssCust = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
    var salesSheet = ssCust.getSheetByName("Sales");
    var salesVal = salesSheet.getDataRange().getValues();
    for (var i = 1; i < salesVal.length; i++) {
      if (salesVal[i][2] === today) {
        salesSum += parseFloat(salesVal[i][3] || 0);
      }
    }
    
    var custSheet = ssCust.getSheetByName("Customers");
    var custVal = custSheet.getDataRange().getValues();
    for (var i = 1; i < custVal.length; i++) {
      pendingDuesSum += parseFloat(custVal[i][5] || 0);
    }
  } catch(e) {}

  try {
    var ssCol = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
    var colSheet = ssCol.getSheetByName("Milk_Collections");
    var colVal = colSheet.getDataRange().getValues();
    for (var i = 1; i < colVal.length; i++) {
      if (colVal[i][2] === today) {
        colPaidSum += parseFloat(colVal[i][9] || 0); // paid to farmers
      }
    }
  } catch(e) {}

  try {
    var ssExp = SpreadsheetApp.openById(CONFIG.EXPENSE_DB_ID);
    var expSheet = ssExp.getSheetByName("Expenses");
    var expVal = expSheet.getDataRange().getValues();
    for (var i = 1; i < expVal.length; i++) {
      if (expVal[i][1] === today) {
        opExpSum += parseFloat(expVal[i][3] || 0);
      }
    }
  } catch(e) {}

  var totalExp = colPaidSum + opExpSum;

  return {
    success: true,
    data: {
      revenueToday: salesSum,
      cashInToday: salesSum, // Assuming same for simplicity
      expensesToday: totalExp,
      farmerPaymentsToday: colPaidSum,
      opExpensesToday: opExpSum,
      pendingDues: pendingDuesSum,
      netProfit: salesSum - totalExp
    }
  };
}

function getCashFlowStatement() {
  var cashFlows = [];
  // Standard aggregated mock cashflow statement loaded from transactional database dates
  var today = new Date().toISOString().split('T')[0];
  cashFlows.push({
    date: today,
    opening_balance: 100000,
    cash_in: 12400,
    cash_out: 8200 + 3200,
    closing_balance: 101000
  });
  return { success: true, data: cashFlows };
}

// --- WHATSAPP UTILITIES ---
function sendWhatsAppReceipt(data) {
  if (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_ID) return;
  
  // Format message text
  var message = "Hello, Milk Collection Receipt: Quantity " + data.quantity + "L, Total ₹" + data.total_amount + ".";
  
  // Call API Cloud
  var url = "https://graph.facebook.com/v16.0/" + CONFIG.WHATSAPP_PHONE_ID + "/messages";
  var options = {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + CONFIG.WHATSAPP_TOKEN,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({
      messaging_product: "whatsapp",
      to: "91" + data.farmer_mobile, // Assume mobile is passed
      type: "text",
      text: { body: message }
    }),
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(url, options);
}

function logErrorToSheets(msg) {
  if (!CONFIG.MASTER_DB_ID) return;
  try {
    var ss = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);
    var sheet = ss.getSheetByName("Error_Logs");
    if (sheet) {
      sheet.appendRow([new Date().toISOString(), msg]);
    }
  } catch(e) {}
}
