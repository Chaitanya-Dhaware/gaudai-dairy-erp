async function test() {
  const url = 'https://script.google.com/macros/s/AKfycbzK0YqgnlG-cOtFuaJ746Znlskms0oIvZBJC4-kdk-mztNpy0c3stN235iZxecPUy3nfA/exec';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'getRawSheetData',
        sheetsIdCollection: '1pqKxGdefTZURvccDBUcNNqB-CuAyxluQ2-8YtARhSyM'
      })
    });
    const json = await res.json();
    console.log('Result:', JSON.stringify(json, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
