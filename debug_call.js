async function test() {
  const url = '<APPS_SCRIPT_URL>';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'getRawSheetData',
        sheetsIdCollection: '<COLLECTION_SHEET_ID>'
      })
    });
    const json = await res.json();
    console.log('Result:', JSON.stringify(json, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
