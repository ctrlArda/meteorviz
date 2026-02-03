#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix Turkish character encoding issues in JavaScript files."""

import re

def fix_encoding(filepath):
    # Read the file
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    # Turkish character replacements (UTF-8 mojibake fixes)
    replacements = {
        'Ä±': 'ı',
        'Ã§': 'ç',
        'ÅŸ': 'ş',
        'Ã¼': 'ü',
        'Ã¶': 'ö',
        'Ä°': 'İ',
        'Ã‡': 'Ç',
        'Åž': 'Ş',
        'Ãœ': 'Ü',
        'Ã–': 'Ö',
        'ÄŸ': 'ğ',
        'Äž': 'Ğ',
        'Ä°': 'İ',
        # Additional encoding issues
        'â€"': '–',
        'â€™': "'",
        'â€œ': '"',
        'â€\x9d': '"',
        'â‰ˆ': '≈',
        'â„¹': 'ℹ',
        'âš ': '⚠',
        'Ã ': 'à',
        'Ã¡': 'á',
        'Ã¢': 'â',
        'Ã£': 'ã',
        'Ã¤': 'ä',
        'Ã¥': 'å',
        'Ã¦': 'æ',
        'Ã¨': 'è',
        'Ã©': 'é',
        'Ãª': 'ê',
        'Ã«': 'ë',
        'Ã¬': 'ì',
        'Ã­': 'í',
        'Ã®': 'î',
        'Ã¯': 'ï',
        'Ã°': 'ð',
        'Ã±': 'ñ',
        'Ã²': 'ò',
        'Ã³': 'ó',
        'Ã´': 'ô',
        'Ãµ': 'õ',
        'Ã¸': 'ø',
        'Ã¹': 'ù',
        'Ãº': 'ú',
        'Ã»': 'û',
        'Ã½': 'ý',
        'Ã¾': 'þ',
        'Ã¿': 'ÿ',
        # Common broken patterns
        'Ã‚': 'Â',
        'Ã\x9f': 'ß',
    }
    
    for broken, fixed in replacements.items():
        content = content.replace(broken, fixed)
    
    # Write back with UTF-8 encoding
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Fixed encoding in {filepath}")

if __name__ == "__main__":
    fix_encoding("simulation_v2.js")
    fix_encoding("index.html")
    print("Done!")
