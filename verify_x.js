+const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const targetDir = "c:\\Users\\acer\\OneDrive\\Documents\\ERPKIDDOS\\erp-frontend\\src";
const missingX = [];

walkDir(targetDir, function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        const inputRegex = /<input[\s\S]*?\/>/gi;
        let match;
        
        while ((match = inputRegex.exec(content)) !== null) {
            if (match[0].toLowerCase().includes('placeholder="search')) {
                const index = match.index;
                const nextText = content.slice(index, index + 400);
                // Simple heuristic: check if <X is in the next 400 chars, which includes the JSX wrapper
                if (!nextText.includes('<X') && !nextText.includes('onClick={() => setSearch') && !nextText.includes('onClick={() => setQuery')) {
                    missingX.push(filePath);
                }
            }
        }
    }
});

console.log("Files still missing X icon:", missingX.length);
console.log(missingX.join('\n'));
