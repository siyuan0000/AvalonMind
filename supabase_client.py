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
                print(f"[Supabase] Loading config from {env_path}")
                try:
                    with open(env_path, 'r') as f:
                        for line in f:
                            line = line.strip()
                            if not line or line.startswith('#'):
                                continue
                            if line.startswith('export '):
                                line = line[7:].strip()
                            
                            if '=' in line:
                                key, value = line.split('=', 1)
                                key = key.strip()
                                value = value.strip().strip('"\'')
                                
                                if key == 'SUPABASE_URL':
                                    self.url = value
                                elif key == 'SUPABASE_KEY':
                                    self.key = value
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

    def sign_up(self, email, password):
        """Sign up a new user."""
        if not self.client:
            return None, "Supabase client not initialized"
        try:
            res = self.client.auth.sign_up({
                "email": email,
                "password": password,
            })
            return res.user, None
        except Exception as e:
            return None, str(e)

    def sign_in(self, email, password):
        """Sign in an existing user."""
        if not self.client:
            return None, "Supabase client not initialized"
        try:
            res = self.client.auth.sign_in_with_password({
                "email": email,
                "password": password,
            })
            return res.user, None
        except Exception as e:
            return None, str(e)

    def update_token_usage(self, user_id, tokens_used, model='deepseek-chat'):
        """Update token usage for a user."""
        if not self.client:
            return False
        
        try:
            # Check if usage record exists
            res = self.client.table('user_usage').select('*').eq('user_id', user_id).execute()
            
            if res.data:
                # Update existing record
                current_usage = res.data[0].get('total_tokens', 0)
                self.client.table('user_usage').update({
                    'total_tokens': current_usage + tokens_used,
                    'last_updated': 'now()'
                }).eq('user_id', user_id).execute()
            else:
                # Create new record
                self.client.table('user_usage').insert({
                    'user_id': user_id,
                    'total_tokens': tokens_used,
                    'model': model
                }).execute()
                
            return True
        except Exception as e:
            print(f"[Supabase] Failed to update token usage: {e}")
            return False

    def get_user_usage(self, user_id):
        """Get token usage for a user."""
        if not self.client:
            return 0
        try:
            res = self.client.table('user_usage').select('total_tokens').eq('user_id', user_id).execute()
            if res.data:
                return res.data[0]['total_tokens']
            return 0
        except Exception as e:
            print(f"[Supabase] Failed to get user usage: {e}")
            return 0

    def save_arena_match(self, match_data):
        """Save arena match result."""
        if not self.client:
            return False
        
        try:
            self.client.table('arena_matches').insert(match_data).execute()
            print(f"[Supabase] Arena match saved.")
            return True
        except Exception as e:
            print(f"[Supabase] Failed to save arena match: {e}")
            return False

    def get_arena_leaderboard(self):
        """Get arena leaderboard stats."""
        if not self.client:
            return []
        
        try:
            # This requires a view or RPC in Supabase for aggregation, 
            # or we fetch raw data and aggregate in Python (less efficient but works for small scale)
            # For now, let's fetch raw matches and aggregate here.
            response = self.client.table('arena_matches').select('*').execute()
            matches = response.data
            
            stats = {}
            for m in matches:
                name = m.get('hero_name')
                if not name: continue
                
                if name not in stats:
                    stats[name] = {'played': 0, 'won': 0, 'roles': {}}
                
                stats[name]['played'] += 1
                if m.get('hero_won'):
                    stats[name]['won'] += 1
                    
                role = m.get('hero_role')
                if role:
                    if role not in stats[name]['roles']:
                        stats[name]['roles'][role] = {'played': 0, 'won': 0}
                    stats[name]['roles'][role]['played'] += 1
                    if m.get('hero_won'):
                        stats[name]['roles'][role]['won'] += 1
            
            # Convert to list
            leaderboard = []
            for name, data in stats.items():
                win_rate = (data['won'] / data['played']) * 100 if data['played'] > 0 else 0
                leaderboard.append({
                    'name': name,
                    'played': data['played'],
                    'won': data['won'],
                    'win_rate': round(win_rate, 1),
                    'roles': data['roles']
                })
            
            # Sort by win rate desc
            leaderboard.sort(key=lambda x: x['win_rate'], reverse=True)
            return leaderboard
            
        except Exception as e:
            print(f"[Supabase] Failed to get leaderboard: {e}")
            return []

# Global instance
supabase = SupabaseClient()
