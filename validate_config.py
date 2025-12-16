import os
import socket
from urllib.parse import urlparse
from config import config

print("--- Configuration Validation ---")

# 1. Check Supabase URL
url = config.get_supabase_url()
key = config.get_supabase_key()

print(f"SUPABASE_URL: '{url}'")
print(f"SUPABASE_KEY: '{key[:10]}...' (masked)" if key else "SUPABASE_KEY: None")

if not url:
    print("❌ Error: SUPABASE_URL is missing.")
    exit(1)

# 2. Parse URL
try:
    parsed = urlparse(url)
    hostname = parsed.hostname
    print(f"Hostname: '{hostname}'")
    
    if not hostname:
        print("❌ Error: Could not parse hostname from URL.")
        exit(1)
        
    # 3. DNS Resolution
    print(f"Attempting to resolve {hostname}...")
    ip = socket.gethostbyname(hostname)
    print(f"✅ DNS Resolution Successful: {hostname} -> {ip}")
    
except socket.gaierror as e:
    print(f"❌ DNS Error: {e}")
    print("   -> This means the URL is incorrect or does not exist.")
    print("   -> Please check your .env.local file.")
except Exception as e:
    print(f"❌ Unexpected Error: {e}")
