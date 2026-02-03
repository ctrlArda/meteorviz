#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix Turkish character encoding issues."""

import re

def fix_file(filepath):
    # Try reading with different encodings
    encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-9']
    content = None
    
    for enc in encodings:
        try:
            with open(filepath, 'r', encoding=enc) as f:
                content = f.read()
            break
        except:
            continue
    
    if content is None:
        print(f"Could not read {filepath}")
        return
    
    # All possible broken Turkish character patterns
    replacements = {
        # Double encoded UTF-8 patterns
        'Ã§': 'ç',
        'Ã¼': 'ü', 
        'Ã¶': 'ö',
        'Ãœ': 'Ü',
        'Ã–': 'Ö',
        'Ã‡': 'Ç',
        'ÄŸ': 'ğ',
        'Äž': 'Ğ',
        'Ä±': 'ı',
        'Ä°': 'İ',
        'ÅŸ': 'ş',
        'Åž': 'Ş',
        
        # Partially fixed patterns (from previous run)
        'ç§': 'ç',
        'ü¼': 'ü',
        'ö¶': 'ö',
        'ı±': 'ı',
        'ğŸ': 'ğ',
        'İ°': 'İ',
        'ş': 'ş',  # Already correct but checking
        
        # Additional broken patterns
        'iç§': 'iç',
        'ç¶': 'ö',
        'ç¼': 'ü',
        'ı°': 'İ',
        'Nı': 'Nü',
        'Lç': 'Lü',
        'kç': 'kü',
        'hı': 'hı',
        
        # Fix specific broken words
        'YENı°': 'YENİ',
        'HARÄ°TA': 'HARİTA',
        'ÇˆARPIŞMA': 'ÇARPIŞMA',
        'Sİ°MÜ': 'SİMÜ',
        'GÜ–NCEL': 'GÜNCEL',
        'Dü–Şü': 'Düşü',
        'Gö–rsel': 'Görsel',
        
        # Arrows and special chars
        'â€"': '–',
        'â€™': "'",
        'â€œ': '"',
        'â€': '"',
        'â‰ˆ': '≈',
        'â„¹': 'ℹ',
        'âš': '⚠',
        '°': '',  # Remove stray degree symbols only when not meaningful
    }
    
    # Apply replacements
    for broken, fixed in replacements.items():
        content = content.replace(broken, fixed)
    
    # Fix remaining patterns with regex
    # Fix pattern like "ı±" -> "ı"
    content = re.sub(r'ı±', 'ı', content)
    content = re.sub(r'ç§', 'ç', content)
    content = re.sub(r'ç¼', 'ü', content)
    content = re.sub(r'ç¶', 'ö', content)
    content = re.sub(r'ğŸ', 'ğ', content)
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Fixed: {filepath}")

if __name__ == "__main__":
    fix_file("simulation_v2.js")
    fix_file("index.html")
    print("Done!")
