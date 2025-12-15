import os
from pathlib import Path
from supabase_client import SupabaseClient

print("--- Debugging Supabase Initialization ---")

# 1. Check .env.local existence
env_path = Path(__file__).parent / '.env.local'
print(f"Checking for .env.local at: {env_path}")
if env_path.exists():
    print("  [OK] .env.local found.")
    print("  Content preview (first 2 lines):")
    try:
        with open(env_path, 'r') as f:
            lines = f.readlines()
            for i, line in enumerate(lines[:5]):
                print(f"    Line {i+1}: {repr(line)}")
    except Exception as e:
        print(f"  [Error] Could not read file: {e}")
else:
    print("  [FAIL] .env.local NOT found.")

# 2. Initialize Client
print("\nInitializing SupabaseClient...")
try:
    client = SupabaseClient()
    print(f"  URL (repr): {repr(client.url)}")
    print(f"  Key (repr): {repr(client.key)}")
    
    if client.url:
        import socket
        from urllib.parse import urlparse
        try:
            parsed = urlparse(client.url)
            hostname = parsed.hostname
            print(f"  Hostname: {hostname}")
            ip = socket.gethostbyname(hostname)
            print(f"  DNS Resolution: {hostname} -> {ip}")
        except Exception as e:
            print(f"  [FAIL] DNS Resolution failed: {e}")

    if client.client:
        print("  [OK] Client object created.")
        
        # 3. Test Connection
        print("\nTesting connection (fetching 1 row from game_logs)...")
        try:
            res = client.client.table('game_logs').select('*').limit(1).execute()
            print("  [OK] Connection successful. Data received.")
        except Exception as e:
            print(f"  [FAIL] Connection failed: {e}")
            
    else:
        print("  [FAIL] Client object is None.")

except Exception as e:
    print(f"  [CRITICAL] Exception during initialization: {e}")
