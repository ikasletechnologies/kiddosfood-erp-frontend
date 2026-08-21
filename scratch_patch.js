const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\acer\\OneDrive\\Documents\\ERPKIDDOS\\erp-backend\\src\\modules\\finance\\account.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

const target = `lastTransaction = { type: 'INFLOW', amount: lastPayment.paidAmount, date: lastPayment.createdAt, note: 'Payment Received' };`;
const replacement = `const isOutflow = lastPayment.entityType === 'VENDOR';
        lastTransaction = { type: isOutflow ? 'OUTFLOW' : 'INFLOW', amount: lastPayment.paidAmount, date: lastPayment.createdAt, note: isOutflow ? 'Payment Made' : 'Payment Received' };`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully patched account.service.ts');
} else {
  console.log('Target string not found');
}
