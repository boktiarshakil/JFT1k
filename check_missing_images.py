import sys
import os
import json

# Force UTF-8 encoding for output
sys.stdout.reconfigure(encoding='utf-8')

base_path = r'c:\Users\boktiarshakil\project\jft\exams'
missing_images = []

dirs = os.listdir(base_path)
# Sort to have a consistent order
dirs.sort()

for item in dirs:
    exam_dir = os.path.join(base_path, item)
    if os.path.isdir(exam_dir):
        data_json_path = os.path.join(exam_dir, 'data.json')
        if os.path.exists(data_json_path):
            try:
                with open(data_json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    exam_id = data.get('id', item)
                    
                    for section in data.get('sections', []):
                        for question in section.get('questions', []):
                            if question.get('type') == 'image':
                                image_file = question.get('image')
                                prompt = question.get('imagePrompt', '')
                                if image_file:
                                    image_path = os.path.join(exam_dir, 'images', image_file)
                                    # Case insensitive check for Windows just in case, but usually exact match is safer
                                    if not os.path.exists(image_path):
                                        missing_images.append((exam_id, image_file, prompt))
            except Exception as e:
                # Silently ignore or log errors
                pass

# Output results in TSV format to a file
with open('missing_images.tsv', 'w', encoding='utf-8') as outfile:
    for mid, mimg, mprompt in missing_images:
        # prompt might have newlines or tabs
        clean_prompt = mprompt.replace('\n', ' ').replace('\t', ' ').strip()
        outfile.write(f"{mid}\t{mimg}\t{clean_prompt}\n")

print(f"Done. Processed {len(dirs)} exams. Found {len(missing_images)} missing images. Saved to missing_images.tsv.")
