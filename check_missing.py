import os
import json
from pathlib import Path

exams_dir = Path('exams')
total_missing = 0
total_images = 0

for d in sorted(os.listdir(exams_dir)):
    data_path = exams_dir / d / 'data.json'
    if data_path.exists():
        try:
            with open(data_path, encoding='utf-8') as f:
                data = json.load(f)
            for s in data.get('sections', []):
                for q in s.get('questions', []):
                    if 'image' in q and 'imagePrompt' in q:
                        total_images += 1
                        img_path = exams_dir / d / 'images' / q['image']
                        if not img_path.exists() or img_path.stat().st_size < 1000:
                            total_missing += 1
        except Exception:
            continue

print(f"Total images needed: {total_images}")
print(f"Total missing images: {total_missing}")
