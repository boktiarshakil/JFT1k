import json, re, sys
from pathlib import Path
from collections import defaultdict

lo = int(sys.argv[1]) if len(sys.argv) > 1 else 1
hi = int(sys.argv[2]) if len(sys.argv) > 2 else 290

def norm(s):
    return re.sub(r'\s+', ' ', str(s)).strip() if s else ''

def clean_marker(s):
    return norm(re.sub(r'[（(]\s*jft\d+\s*[-]?\s*[clr]?\d*\s*[)）]', '', s))

def dlg_key(q):
    d = q.get('dialogue')
    if not d: return ''
    return ' | '.join(f"{norm(t.get('speaker'))}: {norm(t.get('speech'))}" if isinstance(t, dict) else norm(t) for t in d)

def fp(q):
    stem = clean_marker(norm(q.get('stem')))
    d = clean_marker(dlg_key(q))
    tr = clean_marker(norm(q.get('audioTranscript') or ''))
    ctx = clean_marker(norm(q.get('context') or ''))
    img = clean_marker(norm(q.get('imagePrompt') or ''))
    opts = tuple(norm(o) for o in (q.get('options') or q.get('imageOptions') or []))
    content_key = stem or d or tr or ctx or img
    return (content_key, opts)

occ = defaultdict(lambda: defaultdict(list))
total_qs = 0
for i in range(lo, hi + 1):
    p = Path(f'exams/jft{i}/data.json')
    if not p.exists(): continue
    d = json.load(open(p, encoding='utf-8'))
    for sec in d['sections']:
        sname = sec['name']
        for q in sec['questions']:
            total_qs += 1
            f = fp(q)
            occ[sname][f].append(i)

dups_found = 0
for sname, fmap in occ.items():
    s_dups = sum(len(locs) for k, locs in fmap.items() if len(locs) > 1)
    if s_dups > 0:
        print(f'{sname}: {s_dups} duplicate instances!')
        dups_found += s_dups

print(f'Exams {lo}..{hi} check complete! Total questions checked: {total_qs}. Total duplicates found: {dups_found}')
