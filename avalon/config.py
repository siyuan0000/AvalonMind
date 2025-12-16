import os
from pathlib import Path

class Config:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Config, cls).__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self):
        self.SUPABASE_URL = os.environ.get("SUPABASE_URL")
        self.SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
        self.DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
        
        # Try loading from .env.local if not in env
        env_path = Path(__file__).parent.parent / '.env.local'
        if env_path.exists():
            print(f"[Config] Loading from {env_path}")
            try:
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith('#'):
                            continue
                        
                        # Handle 'export ' prefix
                        if line.startswith('export '):
                            line = line[7:].strip()
                        
                        if '=' in line:
                            key, value = line.split('=', 1)
                            key = key.strip()
                            value = value.strip().strip('"\'')
                            
                            if key == 'SUPABASE_URL':
                                self.SUPABASE_URL = value
                            elif key == 'SUPABASE_KEY':
                                self.SUPABASE_KEY = value
                            elif key == 'DEEPSEEK_API_KEY':
                                self.DEEPSEEK_API_KEY = value
            except Exception as e:
                print(f"[Config] Error loading .env.local: {e}")

    @classmethod
    def get_supabase_url(cls):
        return cls().SUPABASE_URL

    @classmethod
    def get_supabase_key(cls):
        return cls().SUPABASE_KEY

    @classmethod
    def get_deepseek_api_key(cls):
        return cls().DEEPSEEK_API_KEY

# Global instance for easy access
config = Config()
