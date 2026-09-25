import os
from google import genai

# Configuration
SERVICE_ACCOUNT_FILE = r"c:\Users\boktiarshakil\project\jft\nihongo-pathway-8b5926fad51e.json"
PROJECT_ID = "nihongo-pathway"
LOCATION = "us-central1"

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = SERVICE_ACCOUNT_FILE

client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)

print("Listing models...")
try:
    for m in client.models.list():
        if "imagen" in m.name.lower():
            print(f"Model: {m.name}, Display Name: {m.display_name}")
except Exception as e:
    print(f"Error: {e}")
