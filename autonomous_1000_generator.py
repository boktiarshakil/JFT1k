# -*- coding: utf-8 -*-
"""
High-Speed Autonomous JFT-1000 Exam & Image Generation Engine.
Generates genuine, authentic CEFR A2 JFT-Basic Simulation Exams from jft410 to jft1000.
Architecture:
- Micro-batched generation (3-4 questions per request) using fast responsive models (nemotron-3.5-lightning:free, mimo-2.6-flash:free).
- Standard 512x512 illustrations generated via SleepyAI (lucid-origin).
- Real-time deduplication against all existing questions across jft1..jft1000.
- Automatic metadata updating and periodic git commits.
"""
import urllib.request
import json
import re
import sys
import time
import base64
import random
import subprocess
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

API_URL_CHAT = 'https://www.sleepyai.org/api/v1/chat/completions'
API_URL_IMG = 'https://www.sleepyai.org/api/v1/images/generations'
API_KEY = 'ork_OSRmQwYqOfuDhRVzqQI8eV7u9qOgkVMu'
IMG_MODEL = 'lucid-origin'

CHAT_MODELS = [
    'nemotron-3.5-lightning:free',
    'sensenova-6.8-flash-lite:free',
    'mimo-2.6-flash:free'
]

HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {API_KEY}',
    'User-Agent': 'Mozilla/5.0'
}

DOMAINS = [
    "日本の職場マナー・挨拶（お疲れ様です、失礼します、お先に失礼します）",
    "アパート・寮での生活ルール・騒音マナー・共用スペースの清掃・エアコン管理",
    "ゴミの分別収集（燃える・燃えない・プラスチック資源・ビン缶・粗大ゴミの事前連絡）",
    "電車・地下鉄・バスの利用（ICカードチャージ、定期券、乗り換え、優先席マナー）",
    "スーパー・八百屋・魚屋での買い物（タイムセール、割引シール、賞味期限の確認）",
    "コンビニでのサービス（公共料金の支払い、ATM、コピー機、宅配便受け取り）",
    "病院・クリニックの受診（保険証の提示、問診票の記入、症状の説明、薬局での処方箋）",
    "市役所・区役所での各種手続き（転入届、マイナンバー、国民健康保険、税金相談）",
    "郵便局での手続き（手紙・小包の郵送、切手購入、不在票の再配達依頼）",
    "銀行・ATMの利用（口座開設、入出金、振込、暗証番号管理、通帳記入）",
    "工場・作業現場の安全衛生（ヘルメット・安全靴・保護メガネの着用、5S活動、指差し確認）",
    "社員食堂・ファミレス・定食屋での注文（食券機、日替わり定食、水・お茶のセルフサービス）",
    "日本の四季と年中行事（春のお花見、夏の盆踊り・花火、秋の紅葉・防災訓練、冬のお正月・初詣）",
    "自然災害への備え（地震発生時の初動、台風接近前の対策、避難場所・ハザードマップの確認）",
    "日常の健康管理（職場の熱中症予防・水分塩分補給、インフルエンザ予防、手洗い・うがい）",
    "同僚・近所の人とのコミュニケーション（引越しの挨拶、手土産、感謝やお礼の伝え方）"
]

def norm(s):
    if not s: return ''
    return re.sub(r'\s+', ' ', str(s)).strip()

def clean_marker(s):
    if s is None:
        return ''
    s = re.sub(r'[（(]\s*jft\d+\s*[-]?\s*[clr]?\d*\s*[)）]', '', str(s))
    return norm(s)

def fp(q):
    parts = []
    for k in ['stem', 'dialogue', 'audioTranscript', 'context', 'imagePrompt']:
        v = q.get(k)
        if v:
            if isinstance(v, list):
                parts.append(' '.join(clean_marker(x.get('speech', '')) for x in v if isinstance(x, dict)))
            else:
                parts.append(clean_marker(str(v)))
    opts = tuple(sorted([clean_marker(o) for o in q.get('options', [])]))
    return (' '.join(parts), opts)

def call_llm_json(prompt, retries=2):
    for m in CHAT_MODELS:
        data = {
            'model': m,
            'messages': [
                {'role': 'system', 'content': 'You are an expert Japanese test creator for JFT-Basic (CEFR A2). Return strictly valid JSON only, no markdown wrappers, no intro text.'},
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.75,
            'max_tokens': 1600
        }
        body = json.dumps(data).encode('utf-8')
        for attempt in range(retries):
            try:
                time.sleep(1.2)
                req = urllib.request.Request(API_URL_CHAT, data=body, headers=HEADERS)
                with urllib.request.urlopen(req, timeout=20) as res:
                    resp = json.loads(res.read().decode('utf-8'))
                    raw = resp['choices'][0]['message'].get('content', '').strip()
                    m_arr = re.search(r'(\[[\s\S]*\])', raw)
                    if m_arr:
                        return json.loads(m_arr.group(1))
                    m_obj = re.search(r'(\{[\s\S]*\})', raw)
                    if m_obj:
                        return json.loads(m_obj.group(1))
            except Exception:
                time.sleep(1.0)
    return None

def generate_image(prompt, out_path):
    data = {
        "model": IMG_MODEL,
        "prompt": prompt,
        "n": 1,
        "size": "512x512"
    }
    body = json.dumps(data).encode('utf-8')
    for attempt in range(3):
        try:
            req = urllib.request.Request(API_URL_IMG, data=body, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as res:
                resp = json.loads(res.read().decode('utf-8'))
                if 'data' in resp and len(resp['data']) > 0:
                    b64 = resp['data'][0].get('b64_json')
                    if b64:
                        out_path.parent.mkdir(parents=True, exist_ok=True)
                        out_path.write_bytes(base64.b64decode(b64))
                        return True
        except Exception:
            time.sleep(1.0)
    return False

def make_chunk_sec1_images(domain):
    prompt = f"""Generate 4 Japanese image-based vocabulary questions for JFT-Basic A2.
Context: {domain}
Return valid JSON array:
[
  {{
    "type": "image",
    "instruction": "Look at the illustration and choose the correct word.",
    "image": "q1.jpeg",
    "imagePrompt": "A clear illustration of [item/action], minimal Japanese cartoon style, square 1:1, white background, no text.",
    "options": ["word1", "word2", "word3", "word4"],
    "answer": 0
  }}
]
Rules:
- 4 items. Images named "q1.jpeg", "q2.jpeg", "q3.jpeg", "q4.jpeg".
- Options must be natural Japanese A2 words.
- Answers evenly distributed (0, 1, 2, 3).
- Strictly raw JSON array only."""
    return call_llm_json(prompt)

def make_chunk_sec1_text(domain, count=4):
    prompt = f"""Generate {count} Japanese vocabulary & kanji questions for JFT-Basic A2.
Context: {domain}
Return valid JSON array:
[
  {{
    "type": "text",
    "instruction": "Read the sentence and choose the word that fits in ( ) most.",
    "stem": "Sentence with (______)",
    "options": ["word1", "word2", "word3", "word4"],
    "answer": 0
  }}
]
Rules:
- Natural CEFR A2 Japanese sentences.
- 4 options each, answer index 0-3.
- Strictly raw JSON array only."""
    return call_llm_json(prompt)

def make_chunk_sec2(domain, count=4):
    prompt = f"""Generate {count} Japanese conversation questions for JFT-Basic A2 Section 2 (Conversation & Expression).
Context: {domain}
Return valid JSON array:
[
  {{
    "type": "text",
    "instruction": "Read the dialogue and choose the best reply.",
    "dialogue": [
      {{"speaker": "A", "speech": "A speaking"}},
      {{"speaker": "B", "speech": "(______)"}}
    ],
    "options": ["opt1", "opt2", "opt3", "opt4"],
    "answer": 0
  }}
]
Rules:
- Natural 2-turn daily dialogue.
- 4 options each, answer index 0-3.
- Strictly raw JSON array only."""
    return call_llm_json(prompt)

def make_chunk_sec3(domain, count=4, start_q=26):
    prompt = f"""Generate {count} Japanese listening comprehension questions for JFT-Basic A2 Section 3.
Context: {domain}
Return valid JSON array:
[
  {{
    "type": "audio",
    "instruction": "Listen to the conversation and answer the question.",
    "audio": "q{start_q}.mp3",
    "audioTranscript": "男：...\\n女：...",
    "stem": "Question in Japanese about what the man/woman will do",
    "options": ["opt1", "opt2", "opt3", "opt4"],
    "answer": 0
  }}
]
Rules:
- Dialogue using '男：' and '女：'.
- Stem in Japanese.
- 4 options each, answer index 0-3.
- Strictly raw JSON array only."""
    return call_llm_json(prompt)

def make_chunk_sec4(domain, count=4):
    prompt = f"""Generate {count} Japanese reading comprehension questions for JFT-Basic A2 Section 4.
Context: {domain}
Return valid JSON array:
[
  {{
    "type": "text",
    "instruction": "Read the text and answer the question.",
    "context": "Short notice, memo, flyer or email in Japanese (3-5 sentences)",
    "stem": "Question in Japanese",
    "options": ["opt1", "opt2", "opt3", "opt4"],
    "answer": 0
  }}
]
Rules:
- Short realistic text context.
- Stem in Japanese.
- 4 options each, answer index 0-3.
- Strictly raw JSON array only."""
    return call_llm_json(prompt)

def build_full_exam(exam_num, seen_fps):
    domain = random.choice(DOMAINS)
    print(f"  [jft{exam_num}] Generating Sec 1 (Vocabulary & Images)...", flush=True)
    c1 = make_chunk_sec1_images(domain)
    if not c1 or len(c1) < 4: return None
    c2 = make_chunk_sec1_text(domain, 4)
    if not c2 or len(c2) < 4: return None
    c3 = make_chunk_sec1_text(domain, 4)
    if not c3 or len(c3) < 4: return None
    sec1_qs = c1[:4] + c2[:4] + c3[:4]

    print(f"  [jft{exam_num}] Generating Sec 2 (Conversation)...", flush=True)
    c4 = make_chunk_sec2(domain, 4)
    if not c4 or len(c4) < 4: return None
    c5 = make_chunk_sec2(domain, 4)
    if not c5 or len(c5) < 4: return None
    c6 = make_chunk_sec2(domain, 5)
    if not c6 or len(c6) < 5: return None
    sec2_qs = c4[:4] + c5[:4] + c6[:5]

    print(f"  [jft{exam_num}] Generating Sec 3 (Listening)...", flush=True)
    c7 = make_chunk_sec3(domain, 4, 26)
    if not c7 or len(c7) < 4: return None
    c8 = make_chunk_sec3(domain, 4, 30)
    if not c8 or len(c8) < 4: return None
    c9 = make_chunk_sec3(domain, 4, 34)
    if not c9 or len(c9) < 4: return None
    sec3_qs = c7[:4] + c8[:4] + c9[:4]

    print(f"  [jft{exam_num}] Generating Sec 4 (Reading)...", flush=True)
    sec4_qs = []
    for _ in range(4):
        c = make_chunk_sec4(domain, 4)
        if c:
            sec4_qs.extend(c)
        if len(sec4_qs) >= 13:
            break
    if len(sec4_qs) < 13:
        print(f"  [jft{exam_num}] Sec 4 incomplete ({len(sec4_qs)}/13)", flush=True)
        return None
    sec4_qs = sec4_qs[:13]

    exam_json = {
        "id": f"jft{exam_num}",
        "title": f"JFT-Basic Simulation Exam {exam_num}",
        "description": f"Simulation Exam {exam_num} focusing on {domain}.",
        "duration": 3600,
        "sections": [
            {"name": "Script and Vocabulary", "questions": sec1_qs},
            {"name": "Conversation and Expression", "questions": sec2_qs},
            {"name": "Listening Comprehension", "questions": sec3_qs},
            {"name": "Reading Comprehension", "questions": sec4_qs}
        ]
    }

    # Normalize IDs & check audio/image fields
    qid = 1
    for s_idx, sec in enumerate(exam_json['sections']):
        for q in sec['questions']:
            q['id'] = qid
            if s_idx == 0 and qid <= 4:
                q['image'] = f"q{qid}.jpeg"
            if s_idx == 2:
                q['audio'] = f"q{qid}.mp3"
            qid += 1

    # Check deduplication
    exam_fps = []
    for sec in exam_json['sections']:
        for q in sec['questions']:
            k = fp(q)
            if k in seen_fps:
                print(f"  [jft{exam_num}] Deduplication collision detected on: {k[0][:60]}... Retrying generation.", flush=True)
                return None
            exam_fps.append(k)

    for k in exam_fps:
        seen_fps.add(k)

    return exam_json

def generate_one_exam(exam_num, seen_fps):
    exam_dir = Path(f'exams/jft{exam_num}')
    exam_file = exam_dir / 'data.json'

    if exam_file.exists():
        try:
            d = json.load(open(exam_file, encoding='utf-8'))
            for sec in d.get('sections', []):
                for q in sec.get('questions', []):
                    seen_fps.add(fp(q))
            return True
        except Exception:
            pass

    for attempt in range(4):
        print(f"  [jft{exam_num}] Starting attempt {attempt + 1}/4...", flush=True)
        exam_json = build_full_exam(exam_num, seen_fps)
        if exam_json:
            print(f"  [jft{exam_num}] Exam synthesis verified cleanly!", flush=True)
            break
        time.sleep(1.5)

    if not exam_json:
        print(f"  [jft{exam_num}] All attempts failed.", flush=True)
        return False

    exam_dir.mkdir(parents=True, exist_ok=True)
    with open(exam_file, 'w', encoding='utf-8') as f:
        json.dump(exam_json, f, ensure_ascii=False, indent=2)

    # Generate images
    img_dir = exam_dir / 'images'
    sec0 = exam_json['sections'][0]
    for q in sec0.get('questions', []):
        if q.get('type') == 'image' and q.get('imagePrompt') and q.get('image'):
            generate_image(q['imagePrompt'], img_dir / q['image'])

    return True

if __name__ == '__main__':
    start_num = int(sys.argv[1]) if len(sys.argv) > 1 else 410
    end_num = int(sys.argv[2]) if len(sys.argv) > 2 else 1000

    print(f"=== Starting Micro-Chunk Autonomous Generation (jft{start_num} to jft{end_num}) ===", flush=True)

    seen_fps = set()
    for i in range(1, start_num):
        p = Path(f'exams/jft{i}/data.json')
        if not p.exists(): continue
        try:
            d = json.load(open(p, encoding='utf-8'))
            for sec in d.get('sections', []):
                for q in sec.get('questions', []):
                    seen_fps.add(fp(q))
        except Exception:
            pass
    print(f"Loaded {len(seen_fps)} existing questions into deduplication index.\n", flush=True)

    batch_size = 10
    for e in range(start_num, end_num + 1):
        t0 = time.time()
        ok = generate_one_exam(e, seen_fps)
        elapsed = time.time() - t0
        status = "DONE" if ok else "FAILED"
        print(f"[Exam {e}/{end_num}] Status: {status} ({elapsed:.1f}s)", flush=True)

        if e % batch_size == 0 or e == end_num:
            print(f"\n[CHECKPOINT] Updating metadata and committing locally at exam {e}...", flush=True)
            subprocess.run('python generate_metadata.py', shell=True)
            subprocess.run(f'git add exams/jft* exams/metadata.json && git commit -m "Generate autonomous exams through jft{e}"', shell=True)
            if e == end_num:
                print(f"[FINAL PUSH] Pushing all commits to remote main...", flush=True)
                subprocess.run('git push origin main', shell=True)
            print(f"Checkpoint completed.\n", flush=True)

    print("\n=== Generation Target Completed! ===", flush=True)
