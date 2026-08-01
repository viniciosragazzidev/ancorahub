const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');
let updatedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('CardContent className="p-0"')) continue;
  
  let newContent = content.replace(/<Card\s+className=\"[^\"]*\"/g, (match) => {
    let classes = match;
    classes = classes.replace(/\bbg-card\b/, 'bg-transparent');
    classes = classes.replace(/\bborder-border(?:\/\d+)?\b/, 'border-transparent');
    classes = classes.replace(/\bshadow-\w+\b/, 'shadow-none');
    return classes;
  });
  
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    updatedCount++;
    console.log('Updated', file);
  }
}
console.log('Total updated:', updatedCount);
