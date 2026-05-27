const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztn7ZXbhrpjZ2V8mHVqQEjENJKogtZ1sYkVo6mMQQLy_-Qk83tBk8Q53Ziq27egUa_Pw/exec";

async function test() {
  try {
    console.log("Calling getSpreadsheetTabUrl for 2026-05-27...");
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "getSpreadsheetTabUrl",
        type: "collection",
        date: "2026-05-27"
      })
    });
    const json = await res.json();
    console.log("Apps Script Response:", json);
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

test();
