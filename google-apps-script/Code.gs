/**
 * Gaudai AI Dairy ERP - Google Apps Script Backend (Code.gs)
 * Deployed as Web App: Execute as "Me", Access: "Anyone"
 * Acts as the API layer between React frontend and 4 distinct Google Spreadsheets.
 *
 * FIRST-TIME SETUP (do ONE of these):
 *   Option A – Run from editor: Call setupMaster() with your spreadsheet ID.
 *              Edit line below and run it from Apps Script > Run > setupMaster
 *   Option B – Visit the web app URL in a browser (doGet will bootstrap it).
 */

// ─── FIRST-TIME: paste your Master Spreadsheet ID here, then run setupMaster() ───
var MASTER_SHEET_ID_OVERRIDE = "1UJ3bGyH--6RiBPdBtDexfhxivebnqqPk0S1FIEQwJjU";

// Global config populated at runtime via PropertiesService
var CONFIG = {
  COLLECTION_DB_ID: "",
  CUSTOMER_DB_ID: "",
  EXPENSE_DB_ID: "",
  MASTER_DB_ID: "",
  WHATSAPP_TOKEN: "",
  WHATSAPP_PHONE_ID: "",
  BASE_RATE: "8.5",
  BUSINESS_NAME: "Gaudai AI Dairy"
};

/**
 * Load CONFIG from script properties (persisted across calls).
 * Falls back to MASTER_SHEET_ID_OVERRIDE if the property is not yet set.
 */
function loadConfigFromProperties() {
  var props = PropertiesService.getScriptProperties();
  CONFIG.MASTER_DB_ID      = props.getProperty("MASTER_DB_ID")      || MASTER_SHEET_ID_OVERRIDE || "";
  CONFIG.COLLECTION_DB_ID  = props.getProperty("COLLECTION_DB_ID")  || "";
  CONFIG.CUSTOMER_DB_ID    = props.getProperty("CUSTOMER_DB_ID")    || "";
  CONFIG.EXPENSE_DB_ID     = props.getProperty("EXPENSE_DB_ID")     || "";
  CONFIG.WHATSAPP_TOKEN    = props.getProperty("WHATSAPP_TOKEN")    || "";
  CONFIG.WHATSAPP_PHONE_ID = props.getProperty("WHATSAPP_PHONE_ID") || "";
  CONFIG.BASE_RATE         = props.getProperty("BASE_RATE")         || "8.5";
  CONFIG.BUSINESS_NAME     = props.getProperty("BUSINESS_NAME")     || "Gaudai AI Dairy";
}

/**
 * Persist CONFIG back to script properties.
 */
function saveConfigToProperties() {
  var props = PropertiesService.getScriptProperties();
  if (CONFIG.MASTER_DB_ID)     props.setProperty("MASTER_DB_ID",     CONFIG.MASTER_DB_ID);
  if (CONFIG.COLLECTION_DB_ID) props.setProperty("COLLECTION_DB_ID", CONFIG.COLLECTION_DB_ID);
  if (CONFIG.CUSTOMER_DB_ID)   props.setProperty("CUSTOMER_DB_ID",   CONFIG.CUSTOMER_DB_ID);
  if (CONFIG.EXPENSE_DB_ID)    props.setProperty("EXPENSE_DB_ID",    CONFIG.EXPENSE_DB_ID);
  if (CONFIG.WHATSAPP_TOKEN)   props.setProperty("WHATSAPP_TOKEN",   CONFIG.WHATSAPP_TOKEN);
  if (CONFIG.WHATSAPP_PHONE_ID) props.setProperty("WHATSAPP_PHONE_ID", CONFIG.WHATSAPP_PHONE_ID);
  if (CONFIG.BASE_RATE)         props.setProperty("BASE_RATE",         CONFIG.BASE_RATE);
  if (CONFIG.BUSINESS_NAME)     props.setProperty("BUSINESS_NAME",     CONFIG.BUSINESS_NAME);
}

/**
 * ONE-TIME SETUP: Run this function from the Apps Script editor.
 * It saves the Master Spreadsheet ID to script properties and
 * auto-creates all sub-spreadsheets.
 *
 * How to use:
 *   1. Open your Master Google Sheet, copy its ID from the URL
 *      (the long string between /d/ and /edit)
 *   2. Paste it into MASTER_SHEET_ID_OVERRIDE at the top of this file, OR
 *      paste it as the argument below and run this function.
 *   3. Click Run > setupMaster in the Apps Script editor.
 */
function setupMaster(masterIdArg) {
  var masterId = masterIdArg || MASTER_SHEET_ID_OVERRIDE;
  if (!masterId) {
    throw new Error("Please paste your Master Spreadsheet ID into MASTER_SHEET_ID_OVERRIDE at the top of Code.gs, then run setupMaster() again.");
  }
  PropertiesService.getScriptProperties().setProperty("MASTER_DB_ID", masterId);
  CONFIG.MASTER_DB_ID = masterId;
  // Trigger full auto-setup
  autoSetupSheets();
  saveConfigToProperties();
  Logger.log("✅ Setup complete! Master ID: " + masterId);
  Logger.log("   Collection DB: " + CONFIG.COLLECTION_DB_ID);
  Logger.log("   Customer DB:   " + CONFIG.CUSTOMER_DB_ID);
  Logger.log("   Expense DB:    " + CONFIG.EXPENSE_DB_ID);
}

/**
 * HTTP GET – called when you visit the web app URL in a browser.
 * Bootstraps everything on first visit and returns a status page.
 */
function doGet(e) {
  loadConfigFromProperties();
  var masterId = (e && e.parameter && e.parameter.masterId) || CONFIG.MASTER_DB_ID;
  if (masterId) {
    CONFIG.MASTER_DB_ID = masterId;
    autoSetupSheets();
    saveConfigToProperties();
  }
  var html = "<h2>Gaudai AI Dairy ERP – Backend Status</h2>";
  html += "<p><b>Master DB:</b> " + (CONFIG.MASTER_DB_ID || "❌ Not set") + "</p>";
  html += "<p><b>Collection DB:</b> " + (CONFIG.COLLECTION_DB_ID || "❌ Not set") + "</p>";
  html += "<p><b>Customer DB:</b> " + (CONFIG.CUSTOMER_DB_ID || "❌ Not set") + "</p>";
  html += "<p><b>Expense DB:</b> " + (CONFIG.EXPENSE_DB_ID || "❌ Not set") + "</p>";
  if (!CONFIG.MASTER_DB_ID) {
    html += "<p style='color:red'>⚠️ To bootstrap, visit: <b>[this URL]?masterId=YOUR_SHEET_ID</b></p>";
    html += "<p>Replace YOUR_SHEET_ID with the ID from your Master Google Sheet URL.</p>";
  } else {
    html += "<p style='color:green'>✅ Backend is configured and ready!</p>";
  }
  return HtmlService.createHtmlOutput(html);
}

/**
 * HTTP POST Entry Point
 * Receives JSON requests from the React client.
 */
function doPost(e) {
  var response = { success: false, message: "" };
  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;

    // 1. Load IDs from PropertiesService (fast, persisted)
    loadConfigFromProperties();

    // Override configuration with IDs supplied in request payload
    if (requestData.sheetsIdMaster) CONFIG.MASTER_DB_ID = requestData.sheetsIdMaster;
    if (requestData.sheetsIdCollection) CONFIG.COLLECTION_DB_ID = requestData.sheetsIdCollection;
    if (requestData.sheetsIdCustomer) CONFIG.CUSTOMER_DB_ID = requestData.sheetsIdCustomer;
    if (requestData.sheetsIdExpense) CONFIG.EXPENSE_DB_ID = requestData.sheetsIdExpense;

    // 2. Only open spreadsheet settings and setup sheets if config is not fully set in properties
    var props = PropertiesService.getScriptProperties();
    var isSetupCompleted = props.getProperty("SETUP_COMPLETED") === "true";

    if (!isSetupCompleted || !CONFIG.MASTER_DB_ID || !CONFIG.COLLECTION_DB_ID || !CONFIG.CUSTOMER_DB_ID || !CONFIG.EXPENSE_DB_ID) {
      if (!CONFIG.MASTER_DB_ID && requestData.sheetsIdMaster) {
        CONFIG.MASTER_DB_ID = requestData.sheetsIdMaster;
        saveConfigToProperties();
      }
      loadSettingsFromSheets();
      autoSetupSheets();
      saveConfigToProperties();
      if (CONFIG.MASTER_DB_ID && CONFIG.COLLECTION_DB_ID && CONFIG.CUSTOMER_DB_ID && CONFIG.EXPENSE_DB_ID) {
        props.setProperty("SETUP_COMPLETED", "true");
      }
    }

    var result;
    switch (action) {
      // --- BATCH LOADING ---
      case 'batchLoadData':
        result = batchLoadData();
        break;
      case 'importBackupData':
        result = importBackupData(requestData);
        break;

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
        result = markFarmerPaid(requestData.entryId, requestData.amount);
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
  // Priority: already set > PropertiesService > MASTER_SHEET_ID_OVERRIDE > active spreadsheet
  if (!CONFIG.MASTER_DB_ID) {
    var props = PropertiesService.getScriptProperties();
    CONFIG.MASTER_DB_ID = props.getProperty("MASTER_DB_ID") || MASTER_SHEET_ID_OVERRIDE || "";
  }
  if (!CONFIG.MASTER_DB_ID) {
    try {
      CONFIG.MASTER_DB_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
    } catch(e) {
      // Standalone script — need explicit ID
    }
  }
  // Save whatever we found so future calls skip this step
  if (CONFIG.MASTER_DB_ID) {
    PropertiesService.getScriptProperties().setProperty("MASTER_DB_ID", CONFIG.MASTER_DB_ID);
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
  var props = PropertiesService.getScriptProperties();
  var settings = {
    baseRate: parseFloat(props.getProperty("baseRate") || props.getProperty("BASE_RATE") || "8.5"),
    businessName: props.getProperty("businessName") || props.getProperty("BUSINESS_NAME") || "Gaudai AI Dairy",
    adminMobile: props.getProperty("adminMobile") || "",
    whatsappToken: props.getProperty("whatsappToken") || props.getProperty("WHATSAPP_TOKEN") || CONFIG.WHATSAPP_TOKEN || "",
    whatsappPhoneId: props.getProperty("whatsappPhoneId") || props.getProperty("WHATSAPP_PHONE_ID") || CONFIG.WHATSAPP_PHONE_ID || "",
    sheetsIdCollection: props.getProperty("sheetsIdCollection") || props.getProperty("COLLECTION_DB_ID") || CONFIG.COLLECTION_DB_ID || "",
    sheetsIdCustomer: props.getProperty("sheetsIdCustomer") || props.getProperty("CUSTOMER_DB_ID") || CONFIG.CUSTOMER_DB_ID || "",
    sheetsIdExpense: props.getProperty("sheetsIdExpense") || props.getProperty("EXPENSE_DB_ID") || CONFIG.EXPENSE_DB_ID || "",
    sheetsIdMaster: props.getProperty("sheetsIdMaster") || props.getProperty("MASTER_DB_ID") || CONFIG.MASTER_DB_ID || MASTER_SHEET_ID_OVERRIDE || "",
    dueReminderFreq: parseInt(props.getProperty("dueReminderFreq") || "2")
  };
  
  // If baseRate is default or keys are missing, we can try to sync from sheet once
  if (!props.getProperty("SETTINGS_CACHED") && CONFIG.MASTER_DB_ID) {
    try {
      var ss = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);
      var sheet = ss.getSheetByName("Settings");
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          var key = data[i][0];
          var val = data[i][1];
          props.setProperty(key, String(val));
          if (key === 'baseRate') settings.baseRate = parseFloat(val);
          else if (key === 'businessName') settings.businessName = val;
          else if (key === 'adminMobile') settings.adminMobile = val;
          else if (key === 'dueReminderFreq') settings.dueReminderFreq = parseInt(val);
        }
        props.setProperty("SETTINGS_CACHED", "true");
      }
    } catch(e) {}
  }
  
  return settings;
}

function updateSettingsTable(requestData) {
  var masterId = CONFIG.MASTER_DB_ID || requestData.sheetsIdMaster;
  if (!masterId) {
    return { success: false, message: "Master sheet ID is missing. Please run setupMaster() from Apps Script editor first." };
  }
  
  // Write to spreadsheet Settings sheet
  try {
    var ss = SpreadsheetApp.openById(masterId);
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
  } catch(e) {}

  // Update properties memory for ultra-fast config lookup!
  var props = PropertiesService.getScriptProperties();
  var keys = Object.keys(requestData);
  keys.forEach(function(k) {
    if (requestData[k] !== undefined && requestData[k] !== null) {
      props.setProperty(k, String(requestData[k]));
    }
  });

  // Keep uppercase properties synchronized as well
  if (requestData.sheetsIdMaster)     props.setProperty("MASTER_DB_ID",     requestData.sheetsIdMaster);
  if (requestData.sheetsIdCollection) props.setProperty("COLLECTION_DB_ID", requestData.sheetsIdCollection);
  if (requestData.sheetsIdCustomer)   props.setProperty("CUSTOMER_DB_ID",   requestData.sheetsIdCustomer);
  if (requestData.sheetsIdExpense)    props.setProperty("EXPENSE_DB_ID",    requestData.sheetsIdExpense);
  if (requestData.whatsappToken)      props.setProperty("WHATSAPP_TOKEN",    requestData.whatsappToken);
  if (requestData.whatsappPhoneId)    props.setProperty("WHATSAPP_PHONE_ID", requestData.whatsappPhoneId);
  if (requestData.baseRate)           props.setProperty("BASE_RATE",         String(requestData.baseRate));
  if (requestData.businessName)       props.setProperty("BUSINESS_NAME",     requestData.businessName);
  
  props.setProperty("SETTINGS_CACHED", "true");
  
  return { success: true, message: "Settings saved successfully" };
}

// --- FARMERS IMPLEMENTATION ---
function registerFarmer(data) {
  var ss = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
  var sheet = ss.getSheetByName("Farmers");
  var rows = sheet.getDataRange().getValues();
  var maxId = 0;
  for (var i = 1; i < rows.length; i++) {
    var fid = rows[i][0];
    if (fid) {
      var num = parseInt(fid.replace(/\D/g, ""), 10);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    }
  }
  var farmerId = "F-" + String(maxId + 1).padStart(2, '0');

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
      current_due: parseSafeFloat(values[i][5])
    });
  }
  return { success: true, data: list };
}

function addMilkCollection(data) {
  var ss = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
  var colSheet = ss.getSheetByName("Milk_Collections");
  var entryId = "E" + Date.now();

  var qty = parseSafeFloat(data.quantity);
  var fatVal = parseSafeFloat(data.fat);
  var rateVal = parseSafeFloat(data.calculated_rate);
  var totalVal = parseSafeFloat(data.total_amount);
  var paidVal = parseSafeFloat(data.paid_amount);
  var dueVal = parseSafeFloat(data.due_amount);

  var status = dueVal <= 0 ? 'Paid' : (paidVal > 0 ? 'Partial' : 'Pending');

  colSheet.appendRow([
    entryId,
    data.farmer_id,
    data.date,
    data.milk_type,
    qty,
    fatVal,
    parseSafeFloat(data.snf) || 8.5,
    rateVal,
    totalVal,
    paidVal,
    dueVal,
    status,
    new Date().toISOString()
  ]);

  // Update farmer current_due
  var farmSheet = ss.getSheetByName("Farmers");
  var farmData = farmSheet.getDataRange().getValues();
  for (var i = 1; i < farmData.length; i++) {
    if (farmData[i][0] === data.farmer_id) {
      var currentDue = parseSafeFloat(farmData[i][5]) + dueVal;
      farmSheet.getRange(i + 1, 6).setValue(currentDue);
      break;
    }
  }

  // Log initial payment to Payments sheet if paid amount > 0
  if (paidVal > 0) {
    try {
      var paySheet = ss.getSheetByName("Payments");
      if (paySheet) {
        paySheet.appendRow([
          "PAY-" + Date.now(),
          data.farmer_id,
          paidVal,
          data.date || new Date().toISOString().split('T')[0],
          "Initial payment for collection entry " + entryId,
          new Date().toISOString()
        ]);
      }
    } catch(e) {
      logErrorToSheets("Failed to write initial payment to Payments sheet: " + e.toString());
    }
  }

  // Trigger WhatsApp Message
  try {
    sendWhatsAppReceipt(data);
  } catch(e) {}

  return { 
    success: true, 
    message: "Milk collection saved successfully",
    data: {
      entry_id: entryId,
      farmer_id: data.farmer_id,
      date: data.date,
      milk_type: data.milk_type,
      quantity: qty,
      fat: fatVal,
      snf: parseSafeFloat(data.snf) || 8.5,
      calculated_rate: rateVal,
      total_amount: totalVal,
      paid_amount: paidVal,
      due_amount: dueVal,
      status: status,
      timestamp: new Date().toISOString()
    }
  };
}

function getCollectionEntries() {
  var ss = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
  var sheet = ss.getSheetByName("Milk_Collections");
  var values = sheet.getDataRange().getValues();
  var list = [];
  for (var i = values.length - 1; i >= 1; i--) {
    var rawDate = values[i][2];
    var formattedDate = "";
    if (rawDate) {
      if (rawDate instanceof Date) {
        formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        formattedDate = String(rawDate).split('T')[0];
      }
    }
    list.push({
      entry_id: values[i][0],
      farmer_id: values[i][1],
      date: formattedDate,
      milk_type: values[i][3],
      quantity: parseSafeFloat(values[i][4]),
      fat: parseSafeFloat(values[i][5]),
      snf: parseSafeFloat(values[i][6]),
      calculated_rate: parseSafeFloat(values[i][7]),
      total_amount: parseSafeFloat(values[i][8]),
      paid_amount: parseSafeFloat(values[i][9]),
      due_amount: parseSafeFloat(values[i][10]),
      status: values[i][11]
    });
  }
  return { success: true, data: list };
}

function markFarmerPaid(entryId, amountCleared) {
  var ss = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
  var colSheet = ss.getSheetByName("Milk_Collections");
  var colData = colSheet.getDataRange().getValues();
  
  for (var i = 1; i < colData.length; i++) {
    if (colData[i][0] === entryId) {
      var farmerId = colData[i][1];
      var due = parseSafeFloat(colData[i][10]);
      var currentPaid = parseSafeFloat(colData[i][9]);
      
      var amtVal = amountCleared !== undefined && amountCleared !== null ? parseSafeFloat(amountCleared) : due;
      if (amtVal > due) {
        amtVal = due;
      }
      
      var paid = currentPaid + amtVal;
      var remainingDue = Math.max(0, due - amtVal);
      var status = remainingDue <= 0 ? "Paid" : "Partial";
      
      colSheet.getRange(i + 1, 10).setValue(paid); // update paid
      colSheet.getRange(i + 1, 11).setValue(remainingDue);    // update due
      colSheet.getRange(i + 1, 12).setValue(status); // status
      
      // Update farmer
      var farmSheet = ss.getSheetByName("Farmers");
      var farmData = farmSheet.getDataRange().getValues();
      for (var j = 1; j < farmData.length; j++) {
        if (farmData[j][0] === farmerId) {
          var newDue = Math.max(0, parseSafeFloat(farmData[j][5]) - amtVal);
          farmSheet.getRange(j + 1, 6).setValue(newDue);
          break;
        }
      }

      // Also log payment to Payments sheet
      try {
        var paySheet = ss.getSheetByName("Payments");
        if (paySheet) {
          paySheet.appendRow([
            "PAY-" + Date.now(),
            farmerId,
            amtVal,
            new Date().toISOString().split('T')[0],
            "Cleared due for collection entry " + entryId,
            new Date().toISOString()
          ]);
        }
      } catch(e) {
        logErrorToSheets("Failed to write to Payments sheet: " + e.toString());
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
  var maxId = 0;
  for (var i = 1; i < rows.length; i++) {
    var cid = rows[i][0];
    if (cid) {
      var num = parseInt(cid.replace(/\D/g, ""), 10);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    }
  }
  var customerId = "c-" + String(maxId + 1).padStart(2, '0');

  sheet.appendRow([
    customerId,
    data.shop_name,
    data.owner_name,
    data.mobile,
    data.address || "",
    0,
    new Date().toISOString()
  ]);
  return { success: true, message: "Customer added", data: { customer_id: customerId } };
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
      current_due: parseSafeFloat(values[i][5])
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
      unit_price: parseSafeFloat(values[i][3]),
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

  var totalVal = parseSafeFloat(data.total_amount);
  var paidVal = parseSafeFloat(data.paid_amount);
  var dueVal = parseSafeFloat(data.due_amount);

  var status = dueVal <= 0 ? 'Paid' : (paidVal > 0 ? 'Partial' : 'Pending');

  salesSheet.appendRow([
    billId,
    data.customer_id,
    data.date,
    totalVal,
    paidVal,
    dueVal,
    status,
    new Date().toISOString()
  ]);

  // Update customer current_due
  var custSheet = ss.getSheetByName("Customers");
  var custData = custSheet.getDataRange().getValues();
  for (var i = 1; i < custData.length; i++) {
    if (custData[i][0] === data.customer_id) {
      var currentDue = parseSafeFloat(custData[i][5]) + dueVal;
      custSheet.getRange(i + 1, 6).setValue(currentDue);
      break;
    }
  }
  return { 
    success: true, 
    data: {
      bill_id: billId,
      customer_id: data.customer_id,
      date: data.date,
      items: data.items,
      total_amount: totalVal,
      paid_amount: paidVal,
      due_amount: dueVal,
      status: status,
      timestamp: new Date().toISOString()
    }
  };
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
    var rawDate = values[i][2];
    var formattedDate = "";
    if (rawDate) {
      if (rawDate instanceof Date) {
        formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        formattedDate = String(rawDate).split('T')[0];
      }
    }
    list.push({
      bill_id: values[i][0],
      customer_id: values[i][1],
      date: formattedDate,
      total_amount: parseSafeFloat(values[i][3]),
      paid_amount: parseSafeFloat(values[i][4]),
      due_amount: parseSafeFloat(values[i][5]),
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
  var amtVal = parseSafeFloat(data.amount);

  var rowData = [
    expId,
    data.date,
    data.reason,
    amtVal,
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

  return { 
    success: true, 
    data: {
      expense_id: expId,
      date: data.date,
      reason: data.reason,
      amount: amtVal,
      category: data.category,
      payment_method: data.payment_method,
      notes: data.notes || "",
      timestamp: timestamp
    }
  };
}

function getExpenses() {
  var ss = SpreadsheetApp.openById(CONFIG.EXPENSE_DB_ID);
  var sheet = ss.getSheetByName("Expenses");
  var values = sheet.getDataRange().getValues();
  var list = [];
  for (var i = values.length - 1; i >= 1; i--) {
    var rawDate = values[i][1];
    var formattedDate = "";
    if (rawDate) {
      if (rawDate instanceof Date) {
        formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        formattedDate = String(rawDate).split('T')[0];
      }
    }
    list.push({
      expense_id: values[i][0],
      date: formattedDate,
      reason: values[i][2],
      amount: parseSafeFloat(values[i][3]),
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
  
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  try {
    var ssCust = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
    var salesSheet = ssCust.getSheetByName("Sales");
    var salesVal = salesSheet.getDataRange().getValues();
    for (var i = 1; i < salesVal.length; i++) {
      var rowDate = salesVal[i][2];
      if (rowDate) {
        if (rowDate instanceof Date) {
          rowDate = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          rowDate = String(rowDate).split('T')[0];
        }
        if (rowDate === today) {
          salesSum += parseSafeFloat(salesVal[i][3]);
        }
      }
    }
    
    var custSheet = ssCust.getSheetByName("Customers");
    var custVal = custSheet.getDataRange().getValues();
    for (var i = 1; i < custVal.length; i++) {
      pendingDuesSum += parseSafeFloat(custVal[i][5]);
    }
  } catch(e) {}

  try {
    var ssCol = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
    var paySheet = ssCol.getSheetByName("Payments");
    if (paySheet) {
      var payVal = paySheet.getDataRange().getValues();
      for (var i = 1; i < payVal.length; i++) {
        var rowDate = payVal[i][3];
        if (rowDate) {
          if (rowDate instanceof Date) {
            rowDate = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
          } else {
            rowDate = String(rowDate).split('T')[0];
          }
          if (rowDate === today) {
            colPaidSum += parseSafeFloat(payVal[i][2]);
          }
        }
      }
    }
  } catch(e) {
    logErrorToSheets("Error in getMasterFinancialSummary parsing Payments: " + e.toString());
  }

  try {
    var ssExp = SpreadsheetApp.openById(CONFIG.EXPENSE_DB_ID);
    var expSheet = ssExp.getSheetByName("Expenses");
    var expVal = expSheet.getDataRange().getValues();
    for (var i = 1; i < expVal.length; i++) {
      var rowDate = expVal[i][1];
      if (rowDate) {
        if (rowDate instanceof Date) {
          rowDate = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          rowDate = String(rowDate).split('T')[0];
        }
        if (rowDate === today) {
          opExpSum += parseSafeFloat(expVal[i][3]);
        }
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

function parseSafeFloat(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  var cleaned = String(val).replace(/[^0-9.]/g, '');
  var num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function batchLoadData() {
  var farmers = [];
  var collections = [];
  var products = [];
  var customers = [];
  var sales = [];
  var expenses = [];
  var summary = {};
  var cashFlow = [];

  try {
    farmers = getFarmerList().data;
  } catch(e) {
    logErrorToSheets("batchLoadData getFarmerList error: " + e.toString());
  }
  try {
    collections = getCollectionEntries().data;
  } catch(e) {
    logErrorToSheets("batchLoadData getCollectionEntries error: " + e.toString());
  }
  try {
    products = getProductList().data;
  } catch(e) {
    logErrorToSheets("batchLoadData getProductList error: " + e.toString());
  }
  try {
    customers = getCustomerList().data;
  } catch(e) {
    logErrorToSheets("batchLoadData getCustomerList error: " + e.toString());
  }
  try {
    sales = getSalesHistory().data;
  } catch(e) {
    logErrorToSheets("batchLoadData getSalesHistory error: " + e.toString());
  }
  try {
    expenses = getExpenses().data;
  } catch(e) {
    logErrorToSheets("batchLoadData getExpenses error: " + e.toString());
  }
  try {
    summary = getMasterFinancialSummary().data;
  } catch(e) {
    logErrorToSheets("batchLoadData getMasterFinancialSummary error: " + e.toString());
  }
  try {
    cashFlow = getCashFlowStatement().data;
  } catch(e) {
    logErrorToSheets("batchLoadData getCashFlowStatement error: " + e.toString());
  }

  return {
    success: true,
    data: {
      farmers: farmers,
      collections: collections,
      products: products,
      customers: customers,
      sales: sales,
      expenses: expenses,
      summary: summary,
      cashFlow: cashFlow
    }
  };
}

function importBackupData(data) {
  // 1. Farmers & Collections (Collection DB)
  try {
    var ssCol = SpreadsheetApp.openById(CONFIG.COLLECTION_DB_ID);
    if (data.farmers && data.farmers.length > 0) {
      var sheet = ssCol.getSheetByName("Farmers");
      if (sheet) {
        var existingIds = sheet.getDataRange().getValues().map(function(r) { return r[0]; });
        data.farmers.forEach(function(f) {
          if (f.farmer_id && existingIds.indexOf(f.farmer_id) === -1) {
            sheet.appendRow([
              f.farmer_id,
              f.name || "",
              f.mobile || "",
              f.address || "",
              f.milk_type || "Cow",
              parseSafeFloat(f.current_due),
              f.created_at || new Date().toISOString()
            ]);
            existingIds.push(f.farmer_id);
          }
        });
      }
    }
    
    if (data.collections && data.collections.length > 0) {
      var sheet = ssCol.getSheetByName("Milk_Collections");
      if (sheet) {
        var existingIds = sheet.getDataRange().getValues().map(function(r) { return r[0]; });
        data.collections.forEach(function(c) {
          if (c.entry_id && existingIds.indexOf(c.entry_id) === -1) {
            sheet.appendRow([
              c.entry_id,
              c.farmer_id || "",
              c.date || "",
              c.milk_type || "Cow",
              parseSafeFloat(c.quantity),
              parseSafeFloat(c.fat),
              parseSafeFloat(c.snf) || 8.5,
              parseSafeFloat(c.calculated_rate),
              parseSafeFloat(c.total_amount),
              parseSafeFloat(c.paid_amount),
              parseSafeFloat(c.due_amount),
              c.status || "Pending",
              c.timestamp || new Date().toISOString()
            ]);
            existingIds.push(c.entry_id);
          }
        });
      }
    }
  } catch(e) {
    logErrorToSheets("importBackupData Collection DB error: " + e.toString());
  }

  // 2. Customers, Products & Sales (Customer DB)
  try {
    var ssCust = SpreadsheetApp.openById(CONFIG.CUSTOMER_DB_ID);
    if (data.customers && data.customers.length > 0) {
      var sheet = ssCust.getSheetByName("Customers");
      if (sheet) {
        var existingIds = sheet.getDataRange().getValues().map(function(r) { return r[0]; });
        data.customers.forEach(function(cust) {
          if (cust.customer_id && existingIds.indexOf(cust.customer_id) === -1) {
            sheet.appendRow([
              cust.customer_id,
              cust.shop_name || "",
              cust.owner_name || "",
              cust.mobile || "",
              cust.address || "",
              parseSafeFloat(cust.current_due),
              cust.created_at || new Date().toISOString()
            ]);
            existingIds.push(cust.customer_id);
          }
        });
      }
    }
    
    if (data.products && data.products.length > 0) {
      var sheet = ssCust.getSheetByName("Products");
      if (sheet) {
        var existingIds = sheet.getDataRange().getValues().map(function(r) { return r[0]; });
        data.products.forEach(function(p) {
          if (p.product_id && existingIds.indexOf(p.product_id) === -1) {
            sheet.appendRow([
              p.product_id,
              p.product_name || "",
              p.category || "Other",
              parseSafeFloat(p.unit_price),
              p.status || "Active",
              p.updated_at || new Date().toISOString()
            ]);
            existingIds.push(p.product_id);
          }
        });
      }
    }

    if (data.sales && data.sales.length > 0) {
      var sheet = ssCust.getSheetByName("Sales");
      if (sheet) {
        var existingIds = sheet.getDataRange().getValues().map(function(r) { return r[0]; });
        data.sales.forEach(function(s) {
          if (s.bill_id && existingIds.indexOf(s.bill_id) === -1) {
            sheet.appendRow([
              s.bill_id,
              s.customer_id || "",
              s.date || "",
              parseSafeFloat(s.total_amount),
              parseSafeFloat(s.paid_amount),
              parseSafeFloat(s.due_amount),
              s.status || "Pending",
              s.timestamp || new Date().toISOString()
            ]);
            existingIds.push(s.bill_id);
          }
        });
      }
    }
  } catch(e) {
    logErrorToSheets("importBackupData Customer DB error: " + e.toString());
  }

  // 3. Expenses (Expense DB)
  try {
    var ssExp = SpreadsheetApp.openById(CONFIG.EXPENSE_DB_ID);
    if (data.expenses && data.expenses.length > 0) {
      var sheet = ssExp.getSheetByName("Expenses");
      if (sheet) {
        var existingIds = sheet.getDataRange().getValues().map(function(r) { return r[0]; });
        data.expenses.forEach(function(exp) {
          if (exp.expense_id && existingIds.indexOf(exp.expense_id) === -1) {
            sheet.appendRow([
              exp.expense_id,
              exp.date || "",
              exp.reason || "",
              parseSafeFloat(exp.amount),
              exp.category || "Other",
              exp.payment_method || "Cash",
              exp.notes || "",
              exp.timestamp || new Date().toISOString()
            ]);
            existingIds.push(exp.expense_id);
          }
        });
      }
    }
  } catch(e) {
    logErrorToSheets("importBackupData Expense DB error: " + e.toString());
  }

  return { success: true, message: "Backup data synchronized successfully" };
}
