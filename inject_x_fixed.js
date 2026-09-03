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
            // Find all input tags: match <input followed by anything lazy, ending in />
            const inputRegex = /<input[\s\S]*?\/>/gi;
            let match;
            
            const matches = [];
            while ((match = inputRegex.exec(content)) !== null) {
                // check if this input has a placeholder starting with "Search"
                if (match[0].toLowerCase().includes('placeholder="search')) {
                    matches.push({
                        fullMatch: match[0],
                        index: match.index
                    });
                }
            }

            for (let i = matches.length - 1; i >= 0; i--) {
                const { fullMatch, index } = matches[i];
                
                const valueMatch = fullMatch.match(/value=\{([a-zA-Z0-9_]+)\}/);
                const setterMatch = fullMatch.match(/set[a-zA-Z0-9_]+\(/);
                
                if (valueMatch && setterMatch) {
                    const stateVar = valueMatch[1];
                    const setterName = setterMatch[0].slice(0, -1);
                    
                    const nextText = content.slice(index + fullMatch.length, index + fullMatch.length + 300);
                    
                    const hasX = (nextText.includes('<X') || nextText.includes('<X\\n')) && (nextText.includes(setterName + '("")') || nextText.includes(setterName + "('')"));
                    const hasClearButton = nextText.includes('onClick={() => ' + setterName + '("")}') || nextText.includes('onClick={() => ' + setterName + '(\'\')}');
                    
                    // Also check if X is ALREADY inside the fullMatch (e.g. if we messed up earlier or someone put it inside the input somehow, though impossible in jsx)
                    if (!hasX && !hasClearButton) {
                        // Let's ensure the parent is relative
                        // We will inject X
                        const injection = `\n            {${stateVar} && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => ${setterName}("")} 
              />
            )}`;
                        content = content.slice(0, index + fullMatch.length) + injection + content.slice(index + fullMatch.length);
                        
                        if (!content.includes('import {') || !content.match(/import\s+\{[^}]*X[^}]*\}\s+from\s+["']lucide-react["']/)) {
                            const lucideRegex = /import\s+\{([^}]+)\}\s+from\s+["']lucide-react["']/;
                            const lucideMatch = content.match(lucideRegex);
                            if (lucideMatch) {
                                const imports = lucideMatch[1].split(',').map(s => s.trim());
                                if (!imports.includes('X')) {
                                    const newImports = lucideMatch[1] + ', X';
                                    content = content.replace(lucideRegex, `import { ${newImports} } from "lucide-react"`);
                                }
                            } else {
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
