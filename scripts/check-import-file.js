const ExcelJS = require('exceljs');
const fs = require('fs');

async function checkFile() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fs.readFileSync('/app/server/uploads/equipment-for-import.xlsx'));
  const ws = wb.worksheets[0];
  
  const headers = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = cell.value;
  });
  
  console.log('Headers:', headers);
  console.log('\n=== Rows for RU/77/806 ===');
  
  let count = 0;
  ws.eachRow((row, num) => {
    if (num === 1) return;
    const obj = {};
    row.eachCell((cell, col) => {
      obj[headers[col]] = cell.value;
    });
    
    if (obj['код объекта'] === 'RU/77/806') {
      count++;
      console.log(`${count}. ${obj['тип оборудования']} | SN: ${obj['серийный номер']} | LOC: ${obj['местоположение']}`);
    }
  });
  
  console.log(`\nTotal: ${count} rows`);
}

checkFile().catch(console.error);
