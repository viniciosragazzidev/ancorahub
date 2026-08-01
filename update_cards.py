import os
import re

directory = 'src/'

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if '<CardContent className="p-0">' not in content:
        return

    def replacer(match):
        classes = match.group(0)
        classes = re.sub(r'\bbg-card\b', 'bg-transparent', classes)
        classes = re.sub(r'\bborder-border(?:/\d+)?\b', 'border-transparent', classes)
        classes = re.sub(r'\bshadow-\w+\b', 'shadow-none', classes)
        return classes

    # Match all Card components in this file
    new_content = re.sub(r'<Card\s+className="[^"]*"', replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx'):
            process_file(os.path.join(root, file))
