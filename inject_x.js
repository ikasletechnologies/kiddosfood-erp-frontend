const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const targetDir = "c:\\Users\\acer\\OneDrive\\Documents\\ERPKIDDOS\\erp-frontend\\src";
let modifiedFilesCount = 0;

walkDir(targetDir, function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        
        if (content.toLowerCase().includes('placeholder="search')) {
            // Find all <input ... placeholder="Search..." ... /> tags
            // regex to match input element that contains placeholder="Search..."
            const inputRegex = /<input[^>]+placeholder=["']Search[^>]*\/?>/gi;
            let match;
            
            // Collect matches first because modifying string while regex matching is bad
            const matches = [];
            while ((match = inputRegex.exec(content)) !== null) {
                matches.push({
                    fullMatch: match[0],
                    index: match.index
                });
            }

            // Iterate backwards to not mess up indices during replacement
            for (let i = matches.length - 1; i >= 0; i--) {
                const { fullMatch, index } = matches[i];
                
                // Extract value variable
                const valueMatch = fullMatch.match(/value=\{([a-zA-Z0-9_]+)\}/);
                // Extract onChange setter (e.g. setSearch(e.target.value))
                const setterMatch = fullMatch.match(/set[a-zA-Z0-9_]+\(/);
                
                if (valueMatch && setterMatch) {
                    const stateVar = valueMatch[1];
                    const setterName = setterMatch[0].slice(0, -1); // remove '('
                    
                    // Look at the next few lines after the input
                    const nextText = content.slice(index + fullMatch.length, index + fullMatch.length + 300);
                    
                    // Check if it already has X icon logic
                    const hasX = nextText.includes('<X') && nextText.includes(setterName + '("")');
                    const hasClearButton = nextText.includes('onClick={() => ' + setterName + '("")}') || nextText.includes('onClick={() => ' + setterName + '(\'\')}');
                    
                    if (!hasX && !hasClearButton) {
                        // Inject X icon block
                        const injection = `
            {${stateVar} && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => ${setterName}("")} 
              />
            )}`;
                        content = content.slice(0, index + fullMatch.length) + injection + content.slice(index + fullMatch.length);
                        
                        // Ensure X is imported from lucide-react
                        if (!content.includes('import {') || !content.match(/import\s+\{[^}]*X[^}]*\}\s+from\s+["']lucide-react["']/)) {
                            // Check if lucide-react is already imported
                            const lucideRegex = /import\s+\{([^}]+)\}\s+from\s+["']lucide-react["']/;
                            const lucideMatch = content.match(lucideRegex);
                            if (lucideMatch) {
                                // Add X if missing
                                const imports = lucideMatch[1].split(',').map(s => s.trim());
                                if (!imports.includes('X')) {
                                    const newImports = lucideMatch[1] + ', X';
                                    content = content.replace(lucideRegex, `import { ${newImports} } from "lucide-react"`);
                                }
                            } else {
                                // Add new import
                                content = `import { X } from "lucide-react";\n` + content;
                            }
                        }
                    }
                }
            }
            
            if (content !== originalContent) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Modified: ${filePath}`);
                modifiedFilesCount++;
            }
        }
    }
});

console.log(`Total files modified: ${modifiedFilesCount}`);
