#!/usr/bin/env python3
"""
JFT Exam Hub — Audio Generator
Uses gTTS (Google Text-to-Speech) to generate audio for all listening questions.

Install: pip install gtts
Usage:   python generate_audio.py
"""

import os
import json
import sys
from pathlib import Path

try:
    from gtts import gTTS
except ImportError:
    print("Please install gTTS: pip install gtts")
    exit(1)

BASE_DIR = Path(__file__).parent
EXAMS_DIR = BASE_DIR / "exams"

def generate_audio_for_exam(exam_id: str):
    data_path = EXAMS_DIR / exam_id / "data.json"
    audio_dir = EXAMS_DIR / exam_id / "audio"
    
    if not data_path.exists():
        print(f"  [SKIP] {exam_id}: data.json not found")
        return

    audio_dir.mkdir(exist_ok=True)

    with open(data_path, encoding="utf-8") as f:
        exam = json.load(f)

    for section in exam["sections"]:
        for q in section["questions"]:
            if q.get("type") != "audio":
                continue
            
            audio_file = audio_dir / q["audio"]
            transcript = q.get("audioTranscript", "")
            
            if not transcript:
                print(f"  [SKIP] {q['audio']}: No transcript found")
                continue
            
            if audio_file.exists():
                print(f"  [EXISTS] {q['audio']}")
                continue
            
            print(f"  [GEN] {q['audio']}...")
            try:
                tts = gTTS(text=transcript, lang="ja", slow=False)
                tts.save(str(audio_file))
                print(f"  [OK] Saved: {audio_file}")
            except Exception as e:
                print(f"  [ERROR] {q['audio']}: {e}")

def main():
    print("JFT Exam Hub — Audio Generator")
    print("=" * 40)
    
    if not EXAMS_DIR.exists():
        print("Error: 'exams' directory not found. Run from the project root.")
        return
    
    # Allow specifying target exams as command-line arguments
    target_exams = sys.argv[1:]
    
    if target_exams:
        for exam_id in target_exams:
            print(f"\nProcessing: {exam_id}")
            generate_audio_for_exam(exam_id)
    else:
        for exam_dir in sorted(EXAMS_DIR.iterdir()):
            if exam_dir.is_dir():
                print(f"\nProcessing: {exam_dir.name}")
                generate_audio_for_exam(exam_dir.name)
    
    print("\n" + "=" * 40)
    print("Done! Audio files are saved in exams/<id>/audio/")

if __name__ == "__main__":
    main()
