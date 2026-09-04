const fs = require('fs');

let content = fs.readFileSync('c:\\Users\\acer\\OneDrive\\Documents\\ERPKIDDOS\\erp-frontend\\src\\app\\reports\\page.tsx', 'utf8');

const inputRegex = /<input[^>]+placeholder=["']Search[^>]*\/?>/gi;
let match;
while ((match = inputRegex.exec(content)) !== null) {
    console.log("Found match:");
    console.log(match[0]);
    
    const valueMatch = match[0].match(/value=\{([a-zA-Z0-9_]+)\}/);
    const setterMatch = match[0].match(/set[a-zA-Z0-9_]+\(/);
    console.log("Value match:", valueMatch);
    console.log("Setter match:", setterMatch);
}
