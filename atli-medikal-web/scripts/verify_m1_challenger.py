"""
Empirical Challenger Verification Script for Milestone 1:
1. WCAG 2.1 Luminance & Mathematical Contrast Ratios for DESIGN_REPORT.md and css/style.css tokens.
2. Comprehensive scan of css/style.css for hardcoded, undeclared, or conflicting z-index values.
"""

import re
import sys
import os

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 3:
        hex_str = ''.join([c*2 for c in hex_str])
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

def srgb_channel_to_linear(c):
    c_srgb = c / 255.0
    if c_srgb <= 0.04045:
        return c_srgb / 12.92
    else:
        return ((c_srgb + 0.055) / 1.055) ** 2.4

def relative_luminance(hex_str):
    r, g, b = hex_to_rgb(hex_str)
    r_lin = srgb_channel_to_linear(r)
    g_lin = srgb_channel_to_linear(g)
    b_lin = srgb_channel_to_linear(b)
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin

def contrast_ratio(hex1, hex2):
    lum1 = relative_luminance(hex1)
    lum2 = relative_luminance(hex2)
    l_max = max(lum1, lum2)
    l_min = min(lum1, lum2)
    return (l_max + 0.05) / (l_min + 0.05)

def check_wcag_levels(ratio):
    # WCAG 2.1:
    # AA Normal: >= 4.5
    # AA Large: >= 3.0
    # AAA Normal: >= 7.0
    # AAA Large: >= 4.5
    aa_normal = ratio >= 4.5
    aa_large = ratio >= 3.0
    aaa_normal = ratio >= 7.0
    aaa_large = ratio >= 4.5
    return {
        'AA_Normal': aa_normal,
        'AA_Large': aa_large,
        'AAA_Normal': aaa_normal,
        'AAA_Large': aaa_large,
    }

# 1. Colors reported in DESIGN_REPORT.md table
DESIGN_REPORT_PAIRS = [
    ("Trust Navy (#051923)", "#051923", "Crisp White (#FFFFFF)", "#FFFFFF", "Primary Display & Section Headings", 17.95),
    ("Trust Navy (#051923)", "#051923", "Medical Slate (#F8FAFC)", "#F8FAFC", "Page Headers on canvas", 17.16),
    ("Trust Navy (#051923)", "#051923", "Light Blue (#EBF4F6)", "#EBF4F6", "Badge & Accent Card Text", 16.07),
    ("Clinical Deep Teal (#0A4D68)", "#0A4D68", "Crisp White (#FFFFFF)", "#FFFFFF", "Primary CTA Buttons, Links, Brand Icons", 9.23),
    ("Clinical Deep Teal (#0A4D68)", "#0A4D68", "Medical Slate (#F8FAFC)", "#F8FAFC", "Feature titles on canvas", 8.83),
    ("Clinical Deep Teal (#0A4D68)", "#0A4D68", "Light Blue (#EBF4F6)", "#EBF4F6", "Interactive category chips", 8.27),
    ("Crisp White (#FFFFFF)", "#FFFFFF", "Clinical Deep Teal (#0A4D68)", "#0A4D68", "Button text on Primary CTA", 9.23),
    ("Crisp White (#FFFFFF)", "#FFFFFF", "Trust Navy (#051923)", "#051923", "Header text on dark banner", 17.95),
    ("Slate 900 (#0F172A)", "#0F172A", "Crisp White (#FFFFFF)", "#FFFFFF", "Card Titles & Heavy Text", 17.85),
    ("Slate 800 (#1E293B)", "#1E293B", "Crisp White (#FFFFFF)", "#FFFFFF", "Primary Body Text", 14.63),
    ("Slate 700 (#334155)", "#334155", "Crisp White (#FFFFFF)", "#FFFFFF", "Product Specification Bullets", 10.35),
    ("Slate 600 (#475569)", "#475569", "Crisp White (#FFFFFF)", "#FFFFFF", "Secondary Meta & Descriptions", 7.58),
    ("Slate 500 (#64748B)", "#64748B", "Crisp White (#FFFFFF)", "#FFFFFF", "SKU, Micro-dates, Strikethroughs", 4.76),
    ("Dark Status Amber (#B45309)", "#B45309", "Soft Amber (#FFFBEB)", "#FFFBEB", "Warranty & Stock Warning Badges", 5.02),
    ("Clinical Red (#DC2626)", "#DC2626", "Soft Red (#FEF2F2)", "#FEF2F2", "Form Errors & Stock Alerts", 4.83),
    ("Medical Cyan (#088395)", "#088395", "Crisp White (#FFFFFF)", "#FFFFFF", "Decorative Accents, Focus Rings", 4.48),
]

# 2. Additional Semantic Combinations in css/style.css
CSS_SEMANTIC_PAIRS = [
    ("Status Success (#16A34A)", "#16A34A", "Status Success BG (#ECFDF5)", "#ECFDF5", "Stokta Var / Ücretsiz Kargo Badge"),
    ("Status Warning (#B45309)", "#B45309", "Status Warning BG (#FFFBEB)", "#FFFBEB", "2 Yıl Garanti / SGK Badge"),
    ("Status Error (#DC2626)", "#DC2626", "Status Error BG (#FEF2F2)", "#FEF2F2", "Tükendi / Hata Bildirimi"),
    ("Status Info (#0284C7)", "#0284C7", "Status Info BG (#F0F9FF)", "#F0F9FF", "Bilgilendirme Rozeti"),
    ("White (#FFFFFF)", "#FFFFFF", "WhatsApp (#25D366)", "#25D366", "WhatsApp CTA Button"),
    ("White (#FFFFFF)", "#FFFFFF", "WhatsApp Dark (#128C7E)", "#128C7E", "WhatsApp Hover / Bar CTA"),
    ("White (#FFFFFF)", "#FFFFFF", "Brand Accent Hover (#066675)", "#066675", "Accent Button Hover"),
    ("Text Light (#94A3B8)", "#94A3B8", "Page BG (#F8FAFC)", "#F8FAFC", "Slate 400 on canvas"),
    ("Text Light (#94A3B8)", "#94A3B8", "Card BG (#FFFFFF)", "#FFFFFF", "Slate 400 on card"),
    ("Text Body (#334155)", "#334155", "Page BG (#F8FAFC)", "#F8FAFC", "Slate 700 on canvas"),
    ("Text Muted (#64748B)", "#64748B", "Page BG (#F8FAFC)", "#F8FAFC", "Slate 500 on canvas"),
    ("Link Hover (#088395)", "#088395", "Page BG (#F8FAFC)", "#F8FAFC", "Cyan link hover on canvas"),
    ("Brand Primary (#0A4D68)", "#0A4D68", "Accent Surface (#EBF4F6)", "#EBF4F6", "Category chip active"),
]

def run_contrast_verification():
    print("=" * 80)
    print("1. EMPIRICAL MATHEMATICAL CONTRAST VERIFICATION (WCAG 2.1)")
    print("=" * 80)
    
    print("\n--- A. DESIGN_REPORT.md Reported Pairs vs Exact Mathematical Calculations ---")
    mismatches = []
    failed_aa = []
    failed_aaa_normal = []
    
    for fg_name, fg_hex, bg_name, bg_hex, role, reported_ratio in DESIGN_REPORT_PAIRS:
        exact_ratio = contrast_ratio(fg_hex, bg_hex)
        levels = check_wcag_levels(exact_ratio)
        diff = abs(exact_ratio - reported_ratio)
        is_close = diff < 0.05
        
        status = "MATCH" if is_close else f"MISMATCH (diff={diff:.2f})"
        if not is_close:
            mismatches.append((fg_name, bg_name, reported_ratio, exact_ratio))
            
        aa_str = "PASS" if levels['AA_Normal'] else ("PASS(Large)" if levels['AA_Large'] else "FAIL")
        aaa_str = "PASS" if levels['AAA_Normal'] else ("PASS(Large)" if levels['AAA_Large'] else "FAIL")
        
        if not levels['AA_Normal'] and not levels['AA_Large']:
            failed_aa.append((fg_name, bg_name, exact_ratio, role))
        if not levels['AAA_Normal']:
            failed_aaa_normal.append((fg_name, bg_name, exact_ratio, role))

        print(f"[{status}] {fg_name} on {bg_name}")
        print(f"   Role: {role}")
        print(f"   Reported: {reported_ratio:.2f}:1 | Exact: {exact_ratio:.2f}:1 | AA: {aa_str} | AAA: {aaa_str}")

    print("\n--- B. Additional CSS Semantic Pairs Verification ---")
    for fg_name, fg_hex, bg_name, bg_hex, role in CSS_SEMANTIC_PAIRS:
        exact_ratio = contrast_ratio(fg_hex, bg_hex)
        levels = check_wcag_levels(exact_ratio)
        aa_str = "PASS" if levels['AA_Normal'] else ("PASS(Large)" if levels['AA_Large'] else "FAIL")
        aaa_str = "PASS" if levels['AAA_Normal'] else ("PASS(Large)" if levels['AAA_Large'] else "FAIL")
        print(f"{fg_name} on {bg_name}")
        print(f"   Role: {role}")
        print(f"   Exact: {exact_ratio:.2f}:1 | AA: {aa_str} | AAA: {aaa_str}")

    return mismatches, failed_aa, failed_aaa_normal

def run_zindex_scan(css_path):
    print("\n" + "=" * 80)
    print("2. CSS Z-INDEX AND LAYER COLLISION AUDIT")
    print("=" * 80)

    if not os.path.exists(css_path):
        print(f"ERROR: File not found: {css_path}")
        return

    with open(css_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    # Find root declarations
    root_z_vars = {}
    z_var_pattern = re.compile(r'(--z-[a-zA-Z0-9_-]+)\s*:\s*([^;]+);')
    in_root = False

    for i, line in enumerate(lines, 1):
        if ':root' in line:
            in_root = True
        if in_root:
            m = z_var_pattern.search(line)
            if m:
                root_z_vars[m.group(1)] = m.group(2).strip()
            if '}' in line and in_root and i > 20: # simple block exit
                in_root = False

    print(f"Declared --z-* variables in :root ({len(root_z_vars)} variables):")
    for var, val in sorted(root_z_vars.items(), key=lambda x: int(re.sub(r'[^0-9]', '', x[1]) or 0)):
        print(f"   {var}: {val}")

    # Scan all z-index occurrences in the stylesheet
    z_index_pattern = re.compile(r'z-index\s*:\s*([^;!}\n]+)')
    
    occurrences = []
    hardcoded = []
    var_usages = []
    undeclared_vars = []

    for idx, line in enumerate(lines, 1):
        # ignore comments
        clean_line = re.sub(r'/\*.*?\*/', '', line).strip()
        m = z_index_pattern.search(clean_line)
        if m:
            raw_val = m.group(1).strip()
            occurrences.append((idx, line.strip(), raw_val))
            
            var_match = re.search(r'var\((--z-[a-zA-Z0-9_-]+)[^)]*\)', raw_val)
            if var_match:
                var_name = var_match.group(1)
                var_usages.append((idx, var_name, line.strip()))
                if var_name not in root_z_vars:
                    undeclared_vars.append((idx, var_name, line.strip()))
            else:
                # Value is hardcoded or not using standard var
                # Check if it's in :root definition itself
                if not any(f'{var}:' in line for var in root_z_vars):
                    hardcoded.append((idx, raw_val, line.strip()))

    print(f"\nTotal z-index occurrences found in file: {len(occurrences)}")
    print(f"Tokens using var(--z-*): {len(var_usages)}")
    print(f"Tokens with undeclared vars: {len(undeclared_vars)}")
    print(f"Tokens with hardcoded values: {len(hardcoded)}")

    if hardcoded:
        print("\n[ALERT] Hardcoded z-index declarations found:")
        for line_no, val, content in hardcoded:
            print(f"   Line {line_no}: z-index: {val} -> `{content}`")
    else:
        print("\n[OK] Zero hardcoded z-index declarations found in rule blocks!")

    if undeclared_vars:
        print("\n[ALERT] Undeclared z-index variables:")
        for line_no, var, content in undeclared_vars:
            print(f"   Line {line_no}: {var} -> `{content}`")
    else:
        print("[OK] All var(--z-*) references are declared in :root!")

    return root_z_vars, hardcoded, undeclared_vars, var_usages

if __name__ == '__main__':
    css_file = os.path.join(os.path.dirname(__file__), '..', 'css', 'style.css')
    mismatches, failed_aa, failed_aaa_normal = run_contrast_verification()
    run_zindex_scan(css_file)
