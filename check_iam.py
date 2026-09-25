import os
import json
import urllib.request
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SERVICE_ACCOUNT_FILE = r"c:\Users\boktiarshakil\project\jft\nihongo-pathway-8b5926fad51e.json"
SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
creds.refresh(Request())
token = creds.token
project_id = "nihongo-pathway"

print("=== CHECKING VERTEX AI API STATUS ===")

# Check API status
url = f"https://serviceusage.googleapis.com/v1/projects/{project_id}/services/aiplatform.googleapis.com"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        state = data.get('state', 'UNKNOWN')
        print(f"Vertex AI API: {state}")
except Exception as e:
    print(f"Error checking API: {e}")

print("\n=== CHECKING TESTIAM PERMISSION ===")
# Check if service account can call predict
test_url = f"https://cloudresourcemanager.googleapis.com/v1/projects/{project_id}:testIamPermissions"
body = json.dumps({"permissions": [
    "aiplatform.endpoints.predict",
    "aiplatform.models.predict"
]}).encode("utf-8")
req2 = urllib.request.Request(
    test_url,
    data=body,
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST"
)
try:
    with urllib.request.urlopen(req2) as resp:
        data2 = json.loads(resp.read())
        granted = data2.get('permissions', [])
        print(f"Granted permissions: {granted}")
        if "aiplatform.endpoints.predict" in granted:
            print("✅ aiplatform.endpoints.predict is GRANTED!")
        else:
            print("❌ aiplatform.endpoints.predict is NOT granted")
except Exception as e:
    print(f"Error: {e}")
