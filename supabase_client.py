import os
from supabase import create_client, Client
from pathlib import Path
import json

class SupabaseClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SupabaseClient, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        self.url = os.environ.get("SUPABASE_URL")
        self.key = os.environ.get("SUPABASE_KEY")
        
        # Try loading from .env.local if not in env
        if not self.url or not self.key:
            env_path = Path(__file__).parent / '.env.local'
            if env_path.exists():
                try:
                    with open(env_path, 'r') as f:
                        for line in f:
                            if line.strip().startswith('SUPABASE_URL='):
                                self.url = line.strip().split('=', 1)[1].strip().strip('"\'')
                            elif line.strip().startswith('SUPABASE_KEY='):
                                self.key = line.strip().split('=', 1)[1].strip().strip('"\'')
                except Exception as e:
                    print(f"[Supabase] Error loading .env.local: {e}")

        if self.url and self.key:
            try:
                self.client: Client = create_client(self.url, self.key)
                print("[Supabase] Client initialized successfully")
            except Exception as e:
                print(f"[Supabase] Initialization failed: {e}")
                self.client = None
        else:
            print("[Supabase] Credentials not found. Supabase integration disabled.")
            self.client = None
            
        self._initialized = True

    def save_game_log(self, log_data):
        """Save game log to Supabase."""
        if not self.client:
            return False

        try:
            data = {
                'game_id': log_data['game_id'],
                'timestamp': log_data['timestamp'],
                'winner': log_data.get('final_result', {}).get('winner', 'Unknown'),
                'log_data': log_data
            }
            
            self.client.table('game_logs').upsert(data).execute()
            print(f"[Supabase] Game {log_data['game_id']} saved successfully.")
            return True
        except Exception as e:
            print(f"[Supabase] Failed to save game log: {e}")
            return False

    def get_game_logs(self, limit=10):
        """Fetch recent game logs."""
        if not self.client:
            return []

        try:
            response = self.client.table('game_logs')\
                .select('game_id, timestamp, winner')\
                .order('timestamp', desc=True)\
                .limit(limit)\
                .execute()
            return response.data
        except Exception as e:
            print(f"[Supabase] Failed to fetch logs: {e}")
            return []

    def get_game_log(self, game_id):
        """Fetch a specific game log."""
        if not self.client:
            return None

        try:
            response = self.client.table('game_logs')\
                .select('log_data')\
                .eq('game_id', game_id)\
                .execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]['log_data']
            return None
        except Exception as e:
            print(f"[Supabase] Failed to fetch log {game_id}: {e}")
            return None

# Global instance
supabase = SupabaseClient()
