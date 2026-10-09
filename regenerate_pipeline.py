# -*- coding: utf-8 -*-
"""
High-Speed Autonomous Regeneration Engine for JFT-Basic.
Uses DeepSeek V4.1 Flash via SleepyAI API.
Generates genuine, authentic CEFR A2 questions in batches of 12-13:
- Listening Comprehension (dialogues / announcements, stems, 4 options)
- Reading Comprehension (notices / memos, stems, 4 options)
- Conversation & Expression (2-turn dialogues with blanks)
- Full option shuffling (A/B/C/D balanced ~25% each)
- Global deduplication check against all existing questions
- Clean formatting, zero fake markers
- Checkpoints & commits every 25 exams
"""
import urllib.request
import json
import re
import sys
import time
import random
import subprocess
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

API_URL = 'https://www.sleepyai.org/api/v1/chat/completions'
API_KEY = 'ork_OSRmQwYqOfuDhRVzqQI8eV7u9qOgkVMu'
MODEL = 'deepseek-v4.1-flash:free'

HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {API_KEY}',
    'User-Agent': 'Mozilla/5.0'
}

DOMAINS = [
    "工場現場での整理整頓（5S）・工具の返却・保護具（安全靴・ヘルメット）の点検",
    "アパート・マンションのゴミ分別（燃える・燃えない・資源ゴミ）と収集時間マナー",
    "駅や電車の運行案内・乗り換えアナウンス・遅延証明書の取得・ICカード利用",
    "病院・クリニックの受付、健康診断の前日絶食ルール、薬局での服薬指導",
    "スーパーやコンビニでの買い物・セルフレジの使い方・夕方のタイムセール割引",
    "台風・大雨・大地震の避難指示・非常用持ち出し袋・ブレーカー遮断ルール",
    "地域のイベント・盆踊り・町内会の清掃活動・市民マラソン大会",
    "日本の年中行事（お花見のマナー、お正月の大掃除、節分の豆まき、お盆休み）",
    "郵便局での宅配便発送・不在連絡票と再配達依頼・宅配ボックスの暗証番号",
    "市役所・区役所での転入届手続き・マイナンバーカード・国民健康保険証",
    "職場での業務連絡・会議室の予約・来客へのお茶出しとスリッパの準備",
    "社員食堂での注文方法・完全キャッシュレス決済・アレルギー表示の確認",
    "図書館の返却ポスト利用・市民体育館の室内シューズ着用ルール",
    "季節の健康管理（職場の熱中症予防・水分塩分補給、インフルエンザ予防接種）",
    "引越しの挨拶・粗大ゴミの事前申し込み・水道の水抜き凍結防止",
    "自転車の交通安全マナー（雨天時の傘差し運転禁止、夜間のライト点灯と反射材）"
]

def norm(s):
    if not s: return ''
    return re.sub(r'\s+', ' ', str(s)).strip()

def clean_marker(s):
    s = re.sub(r'[（(]\s*jft\d+\s*[-]\s*[clr]\d+\s*[)）]', '', s)
    s = re.sub(r'[（(]\s*jft\d+\s*[)）]', '', s)
    return norm(s)

def dialogue_key(q):
    d = q.get('dialogue')
    if not d: return ''
    return ' | '.join(f"{norm(t.get('speaker'))}:{norm(t.get('speech'))}" if isinstance(t, dict) else norm(t) for t in d)

def fp(q):
    stem = clean_marker(norm(q.get('stem')))
    dlg = clean_marker(dialogue_key(q))
    tr = clean_marker(norm(q.get('audioTranscript') or ''))
    ctx = clean_marker(norm(q.get('context') or ''))
    img = clean_marker(norm(q.get('imagePrompt') or ''))
    opts = tuple(norm(o) for o in (q.get('options') or q.get('imageOptions') or []))
    return (stem or dlg or tr or ctx or img, opts)

def call_llm(prompt, retries=5):
    data = {
        'model': MODEL,
        'messages': [
            {'role': 'system', 'content': 'You are an expert Japanese educator creating authentic JFT-Basic (CEFR A2) examination questions. Always return raw JSON array only.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.85
    }
    for attempt in range(retries):
        try:
            req = urllib.request.Request(API_URL, data=json.dumps(data).encode('utf-8'), headers=HEADERS)
            with urllib.request.urlopen(req, timeout=45) as resp:
                res = json.loads(resp.read().decode('utf-8'))
                raw = res['choices'][0]['message']['content'].strip()
                if raw.startswith("```"):
                    raw = re.sub(r"^```(?:json)?\s*", "", raw)
                    raw = re.sub(r"\s*```$", "", raw)
                return json.loads(raw)
        except Exception as e:
            time.sleep(2 * (attempt + 1))
    return None

def generate_rc_batch(count, seen_fps):
    topics = random.sample(DOMAINS, min(count, len(DOMAINS)))
    prompt = f"""Generate {count} distinct authentic Japanese CEFR A2 Reading Comprehension questions for JFT-Basic.
Topics to cover: {', '.join(topics)}
Requirements:
- Short passage (3-5 sentences) such as a memo, notice, or email in natural polite Japanese (です/ます).
- Question testing a key detail.
- Exactly 4 plausible options.
- The correct answer index (0-3).
- Do NOT include any exam IDs or markers like (jft...) in the text.
Return JSON strictly as a JSON array of {count} objects:
[
  {{
    "context": "Passage text in Japanese",
    "stem": "Question in Japanese",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "answer": 0
  }}
]"""
    items = call_llm(prompt)
    valid_items = []
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict) and 'context' in item and 'stem' in item and 'options' in item:
                opts = item['options']
                ans = item.get('answer', 0)
                if len(opts) == 4 and isinstance(ans, int) and 0 <= ans < 4:
                    correct_text = opts[ans]
                    random.shuffle(opts)
                    item['options'] = opts
                    item['answer'] = opts.index(correct_text)
                    k = (clean_marker(norm(item['stem'])) or clean_marker(norm(item['context'])), tuple(norm(o) for o in opts))
                    if k not in seen_fps:
                        seen_fps.add(k)
                        valid_items.append(item)
    return valid_items

def generate_lc_batch(count, seen_fps):
    topics = random.sample(DOMAINS, min(count, len(DOMAINS)))
    prompt = f"""Generate {count} distinct authentic Japanese CEFR A2 Listening Comprehension questions for JFT-Basic.
Topics to cover: {', '.join(topics)}
Requirements:
- Short dialogue or announcement script (2-4 lines) in natural Japanese.
- Question in Japanese.
- Exactly 4 plausible options.
- The correct answer index (0-3).
- Do NOT include any exam IDs or markers like (jft...) in the text.
Return JSON strictly as a JSON array of {count} objects:
[
  {{
    "audioTranscript": "Dialogue or announcement in Japanese",
    "stem": "Question in Japanese",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "answer": 0
  }}
]"""
    items = call_llm(prompt)
    valid_items = []
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict) and 'audioTranscript' in item and 'stem' in item and 'options' in item:
                opts = item['options']
                ans = item.get('answer', 0)
                if len(opts) == 4 and isinstance(ans, int) and 0 <= ans < 4:
                    correct_text = opts[ans]
                    random.shuffle(opts)
                    item['options'] = opts
                    item['answer'] = opts.index(correct_text)
                    k = (clean_marker(norm(item['stem'])) or clean_marker(norm(item['audioTranscript'])), tuple(norm(o) for o in opts))
                    if k not in seen_fps:
                        seen_fps.add(k)
                        valid_items.append(item)
    return valid_items

def generate_ce_batch(count, seen_fps):
    topics = random.sample(DOMAINS, min(count, len(DOMAINS)))
    prompt = f"""Generate {count} distinct authentic Japanese CEFR A2 Conversation & Expression questions for JFT-Basic.
Topics to cover: {', '.join(topics)}
Requirements:
- 2-turn dialogue between Person A and Person B.
- Exactly one sentence contains a blank (______).
- 4 choices to fill in the blank.
- The correct answer index (0-3).
- Do NOT include any exam IDs or markers like (jft...) in the text.
Return JSON strictly as a JSON array of {count} objects:
[
  {{
    "dialogue": [
      {{"speaker": "A", "speech": "sentence in Japanese"}},
      {{"speaker": "B", "speech": "sentence in Japanese"}}
    ],
    "options": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
    "answer": 0
  }}
]"""
    items = call_llm(prompt)
    valid_items = []
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict) and 'dialogue' in item and 'options' in item:
                opts = item['options']
                ans = item.get('answer', 0)
                if len(opts) in (3, 4) and isinstance(ans, int) and 0 <= ans < len(opts):
                    correct_text = opts[ans]
                    random.shuffle(opts)
                    item['options'] = opts
                    item['answer'] = opts.index(correct_text)
                    dlg_str = ' | '.join(f"{t.get('speaker')}:{t.get('speech')}" for t in item['dialogue'])
                    k = (clean_marker(norm(dlg_str)), tuple(norm(o) for o in opts))
                    if k not in seen_fps:
                        seen_fps.add(k)
                        valid_items.append(item)
    return valid_items

def main():
    start_exam = 96
    end_exam = 409
    if len(sys.argv) >= 3:
        start_exam = int(sys.argv[1])
        end_exam = int(sys.argv[2])

    print(f"=== Starting Regeneration Run for jft{start_exam} to jft{end_exam} ===")
    
    # 1. Build seen index of genuinely unique questions from 1..start_exam-1
    seen_fps = set()
    for e in range(1, start_exam):
        d = json.load(open(f'exams/jft{e}/data.json', encoding='utf-8'))
        for sec in d['sections']:
            for q in sec['questions']:
                seen_fps.add(fp(q))
    print(f"Loaded {len(seen_fps)} unique questions from jft1..jft{start_exam - 1}.")

    # 2. Iterate through exams
    total_replaced = 0
    checkpoint_counter = 0

    for e in range(start_exam, end_exam + 1):
        d = json.load(open(f'exams/jft{e}/data.json', encoding='utf-8'))
        
        # Identify dups in current exam
        ce_dups = []
        lc_dups = []
        rc_dups = []
        
        # Section 1 (CE)
        for q_idx, q in enumerate(d['sections'][1]['questions']):
            k = fp(q)
            if k in seen_fps:
                ce_dups.append(q_idx)
            else:
                seen_fps.add(k)
                
        # Section 2 (LC)
        for q_idx, q in enumerate(d['sections'][2]['questions']):
            k = fp(q)
            if k in seen_fps:
                lc_dups.append(q_idx)
            else:
                seen_fps.add(k)
                
        # Section 3 (RC)
        for q_idx, q in enumerate(d['sections'][3]['questions']):
            k = fp(q)
            if k in seen_fps:
                rc_dups.append(q_idx)
            else:
                seen_fps.add(k)

        dups_needed = len(ce_dups) + len(lc_dups) + len(rc_dups)
        if dups_needed == 0:
            continue

        print(f"\n[Exam {e}] Replacing {dups_needed} duplicates (CE:{len(ce_dups)}, LC:{len(lc_dups)}, RC:{len(rc_dups)})")
        
        # Replace CE
        if ce_dups:
            needed = len(ce_dups)
            new_qs = []
            while len(new_qs) < needed:
                batch = generate_ce_batch(needed - len(new_qs), seen_fps)
                new_qs.extend(batch)
                time.sleep(0.5)
            for q_idx, new_q in zip(ce_dups, new_qs):
                q = d['sections'][1]['questions'][q_idx]
                q['dialogue'] = new_q['dialogue']
                q['options'] = new_q['options']
                q['answer'] = new_q['answer']
                total_replaced += 1

        # Replace LC
        if lc_dups:
            needed = len(lc_dups)
            new_qs = []
            while len(new_qs) < needed:
                batch = generate_lc_batch(needed - len(new_qs), seen_fps)
                new_qs.extend(batch)
                time.sleep(0.5)
            for q_idx, new_q in zip(lc_dups, new_qs):
                q = d['sections'][2]['questions'][q_idx]
                q['audioTranscript'] = new_q['audioTranscript']
                q['stem'] = new_q['stem']
                q['options'] = new_q['options']
                q['answer'] = new_q['answer']
                total_replaced += 1

        # Replace RC
        if rc_dups:
            needed = len(rc_dups)
            new_qs = []
            while len(new_qs) < needed:
                batch = generate_rc_batch(needed - len(new_qs), seen_fps)
                new_qs.extend(batch)
                time.sleep(0.5)
            for q_idx, new_q in zip(rc_dups, new_qs):
                q = d['sections'][3]['questions'][q_idx]
                q['context'] = new_q['context']
                q['stem'] = new_q['stem']
                q['options'] = new_q['options']
                q['answer'] = new_q['answer']
                total_replaced += 1

        # Save exam
        json.dump(d, open(f'exams/jft{e}/data.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print(f"--> Saved jft{e}! Total replaced: {total_replaced}")
        checkpoint_counter += 1

        # Checkpoint every 25 exams
        if checkpoint_counter % 25 == 0:
            print(f"\n[CHECKPOINT] Processed {checkpoint_counter} exams. Updating metadata...")
            subprocess.run(['python', 'generate_metadata.py'])

    print(f"\n=== FINISHED RUN: Total {total_replaced} questions replaced! ===")
    subprocess.run(['python', 'generate_metadata.py'])

if __name__ == '__main__':
    main()
