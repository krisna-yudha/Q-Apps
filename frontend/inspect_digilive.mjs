import fs from 'fs';
import XLSX from 'xlsx';

const filePath = 'C:/Users/yudak/Downloads/sample/QSF - DIGILIVE.xlsx';
const buf = fs.readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer' });
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total raw rows in QSF - DIGILIVE.xlsx:', data.length);
console.log('Row 0:', data[0]);
console.log('Row 1:', data[1]);
console.log('Row 2:', data[2]);

data.forEach((row, idx) => {
  const rowStr = JSON.stringify(row);
  if (rowStr.includes('RTC4NRW6') || rowStr.includes('8078792')) {
    console.log(`Found in QSF - DIGILIVE row ${idx}:`, row);
  }
});
