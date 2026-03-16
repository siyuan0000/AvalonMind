import os
import requests
from supabase import create_client, Client
from pathlib import Path
import json
from datetime import datetime, timedelta

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
        
        from avalon.config import config
        self.url = config.get_supabase_url()
        self.key = config.get_supabase_key()
        
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

    def save_game_log(self, log_data, user_id=None):
        """Save game log to Supabase with optional user association."""
        if not self.client:
            return False

        try:
            data = {
                'game_id': log_data['game_id'],
                'timestamp': log_data['timestamp'],
                'winner': (log_data.get('final_result') or {}).get('winner', 'Unknown'),
                'log_data': log_data
            }
            
            if user_id:
                data['user_id'] = user_id
            
            self.client.table('game_logs').upsert(data, on_conflict='game_id').execute()
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

    def resend_confirmation(self, email):
        """Resend email confirmation for a user."""
        if not self.client:
            return None, "Supabase client not initialized"
        try:
            # Supabase Python client doesn't have a direct resend confirmation method
            # We need to use the REST API directly
            import requests
            
            # Get the auth endpoint
            auth_endpoint = f"{self.url}/auth/v1/recover"
            
            # Prepare the request
            headers = {
                "apikey": self.key,
                "Content-Type": "application/json"
            }
            
            data = {
                "email": email,
                "type": "signup"  # This tells Supabase to resend confirmation
            }
            
            # Make the request
            response = requests.post(auth_endpoint, json=data, headers=headers)
            
            if response.status_code == 200:
                return True, None
            else:
                error_data = response.json()
                return False, error_data.get("msg", "Failed to resend confirmation")
                
        except Exception as e:
            return False, str(e)

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

    def get_user_profile(self, user_id):
        """Get user profile including VIP status."""
        if not self.client:
            return None
        try:
            response = self.client.table('user_profiles')\
                .select('*')\
                .eq('user_id', user_id)\
                .execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            print(f"[Supabase] Failed to get user profile: {e}")
            return None

    def create_user_profile(self, user_id, email):
        """Create a new user profile."""
        if not self.client:
            return False
        try:
            data = {
                'user_id': user_id,
                'email': email,
                'is_vip': False
            }
            self.client.table('user_profiles').insert(data).execute()
            print(f"[Supabase] User profile created for {email}")
            return True
        except Exception as e:
            print(f"[Supabase] Failed to create user profile: {e}")
            return False

    def update_user_profile(self, user_id, updates):
        """Update user profile (only columns that exist: is_vip)."""
        if not self.client:
            return False
        # Filter to only schema-valid fields
        valid_fields = {'is_vip'}
        updates = {k: v for k, v in updates.items() if k in valid_fields}
        if not updates:
            return True  # nothing to update
        try:
            self.client.table('user_profiles').update(updates).eq('user_id', user_id).execute()
            print(f"[Supabase] User profile updated for {user_id}")
            return True
        except Exception as e:
            print(f"[Supabase] Failed to update user profile: {e}")
            return False

    def get_weekly_game_count(self, user_id):
        """Get the number of games played this week by a user."""
        if not self.client:
            return 0
        try:
            # Calculate the start of the current week (Monday 00:00 UTC)
            today = datetime.utcnow()
            days_since_monday = today.weekday()
            week_start = (today - timedelta(days=days_since_monday)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            week_start_iso = week_start.isoformat()
            
            response = self.client.table('game_logs')\
                .select('game_id', count='exact')\
                .eq('user_id', user_id)\
                .gte('timestamp', week_start_iso)\
                .execute()
            
            return response.count if response.count else 0
        except Exception as e:
            print(f"[Supabase] Failed to get weekly game count: {e}")
            return 0

    def get_user_game_logs(self, user_id, limit=50, offset=0):
        """Fetch game logs for a specific user."""
        if not self.client:
            return []
        try:
            response = self.client.table('game_logs')\
                .select('game_id, timestamp, winner, log_data')\
                .eq('user_id', user_id)\
                .order('timestamp', desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
            return response.data
        except Exception as e:
            print(f"[Supabase] Failed to fetch user game logs: {e}")
            return []

    def check_can_play(self, user_id):
        """Check if user can play a game (VIP or under weekly limit)."""
        if not self.client:
            return True, None  # Allow if Supabase is not configured
        
        profile = self.get_user_profile(user_id)
        
        # If no profile exists, create one
        if not profile:
            return True, None  # New users can play
        
        # VIP users have unlimited games
        if profile.get('is_vip', False):
            return True, {'is_vip': True, 'weekly_count': None}
        
        # Check weekly limit
        weekly_count = self.get_weekly_game_count(user_id)
        if weekly_count >= 1:
            return False, {'is_vip': False, 'weekly_count': weekly_count}
        
        return True, {'is_vip': False, 'weekly_count': weekly_count}

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
