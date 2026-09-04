const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? 
            walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const targetDir = "c:\\Users\\acer\\OneDrive\\Documents\\ERPKIDDOS\\erp-frontend\\src";
const filesWithSearch = [];
const missingX = [];

walkDir(targetDir, function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.toLowerCase().includes('placeholder="search')) {
            filesWithSearch.push(filePath);
            
            // Heuristic to check if an X icon or clear button exists right after
            // the input or in the file for clearing search.
            // We check for "onClick={() => setSearch" or "onClick={() => setQuery"
            // combined with `<X` or similar.
            const hasX = content.includes('<X ') || content.includes('<X\n') || content.includes('size={14}');
            const hasClearSearch = content.includes('("")') && (content.includes('setSearch') || content.includes('setSearchTerm') || content.includes('setQuery'));
            
            if (!hasX || !hasClearSearch) {
                missingX.push(filePath);
            }
        }
    }
});

console.log("Total files with search:", filesWithSearch.length);
console.log("Files potentially missing clear icon:", missingX.length);
console.log(missingX.join('\n'));
