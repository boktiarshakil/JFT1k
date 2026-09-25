import os
import json
import re

def generate_metadata():
    exams_dir = 'exams'
    output_file = os.path.join(exams_dir, 'metadata.json')
    
    metadata = []
    
    # Sort directories numerically by the 'jft' number
    def get_num(s):
        match = re.search(r'\d+', s)
        return int(match.group()) if match else 0

    if not os.path.exists(exams_dir):
        print(f"Error: {exams_dir} directory not found.")
        return

    subdirs = [d for d in os.listdir(exams_dir) if os.path.isdir(os.path.join(exams_dir, d)) and d.startswith('jft')]
    subdirs.sort(key=get_num)

    print(f"Found {len(subdirs)} exam directories. Processing...")

    for d in subdirs:
        json_path = os.path.join(exams_dir, d, 'data.json')
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                    # Extract only necessary fields for the hub
                    entry = {
                        "id": data.get("id", d),
                        "title": data.get("title", f"JFT Exam {get_num(d)}"),
                        "description": data.get("description", ""),
                        "duration": data.get("duration", 3600),
                        "questionCount": sum(len(s.get("questions", [])) for s in data.get("sections", []))
                    }
                    metadata.append(entry)
            except Exception as e:
                print(f"Error processing {json_path}: {e}")

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f"Successfully generated {output_file} with {len(metadata)} entries.")

if __name__ == "__main__":
    generate_metadata()
