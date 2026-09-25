import os
import json
from pathlib import Path
from google import genai
from google.genai import types

# Configuration
SERVICE_ACCOUNT_FILE = r"c:\Users\X\Projects\jft\nihongo-pathway-8b5926fad51e.json"
PROJECT_ID = "nihongo-pathway"
LOCATION = "us-central1"

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = SERVICE_ACCOUNT_FILE

client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)

def generate_exam(exam_id):
    prompt = f"""
    You are an expert Japanese teacher. Generate a full JFT-Basic Simulation Exam in JSON format for exam ID: "{exam_id}".
    The exam MUST have exactly 4 sections:
    1. "Script and Vocabulary" (approx 12 questions). Mix of "image" type and "text" type.
       For "image" type, include "imagePrompt" (detailed prompt for AI image generation) and options/answer.
       For "text" type, stem with (______) blank.
    2. "Conversation and Expression" (approx 13 questions). "text" type. Provide "dialogue" array with {{speaker: "A", speech: "..."}} and (___) blank.
    3. "Listening Comprehension" (approx 12 questions). "audio" type. Include "audio" (e.g. q26.mp3), and CRITICALLY "audioTranscript" using ONLY two speaker tags: "男：" and "女：". Avoid other labels like "先生" or "客" in the transcript tags. The sentence MUST use Japanese full stops "。". 
    4. "Reading Comprehension" (approx 13 questions). "text" type. Provide "context" and "stem".

    Return ONLY raw, valid JSON. No markdown wrappers. No chat output.
    Format exactly like this example structure:
    {{
        "id": "{exam_id}",
        "title": "JFT-Basic Simulation Exam {exam_id.replace('jft','')}",
        "description": "Simulation Exam testing daily interactions, nuanced vocabulary...",
        "duration": 3600,
        "sections": [
            ...
        ]
    }}
    """

    print(f"Generating for {exam_id}...")
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        content = response.text
        
        # Clean up potential markdown
        if content.startswith("```"):
            content = content.replace("```json\n", "").replace("```\n", "").replace("```", "")
        
        # Validate JSON
        parsed = json.loads(content)
        
        out_dir = Path("exams") / exam_id
        out_dir.mkdir(parents=True, exist_ok=True)
        with open(out_dir / "data.json", "w", encoding="utf-8") as f:
            json.dump(parsed, f, ensure_ascii=False, indent=4)
        print(f"Success! Written to {out_dir}/data.json")

    except Exception as e:
        print(f"Failed to generate for {exam_id}: {e}")

if __name__ == "__main__":
    generate_exam("jft1")
    generate_exam("jft2")
