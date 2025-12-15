import subprocess
import json
import re
import os
from config import config

class BaseAI:
    """Base class for AI backends."""

    def call_model(self, prompt, max_retries=3):
        """Call the AI model. Must be implemented by subclasses."""
        raise NotImplementedError

    def extract_choice(self, response, valid_choices):
        """Extract a valid choice from AI response."""
        if not response:
            return None

        # Look for exact matches (case insensitive)
        response_lower = response.lower()
        for choice in valid_choices:
            if choice.lower() in response_lower:
                return choice

        # Try to find in brackets or quotes
        for pattern in [r'\[([^\]]+)\]', r'"([^"]+)"', r"'([^']+)'"]:
            matches = re.findall(pattern, response)
            for match in matches:
                if match in valid_choices:
                    return match

        return None


class OllamaAI(BaseAI):
    """Interface to call models via Ollama."""

    def __init__(self, model_name='deepseek-r1'):
        self.model_name = model_name

    def call_model(self, prompt, max_retries=3):
        """Call Ollama model."""
        for attempt in range(max_retries):
            try:
                result = subprocess.run(
                    ['ollama', 'run', self.model_name, prompt],
                    capture_output=True,
                    text=True,
                    timeout=60
                )

                response = result.stdout.strip()

                if not response:
                    print(f"  [Attempt {attempt + 1}] Empty response, retrying...")
                    continue

                return response

            except subprocess.TimeoutExpired:
                print(f"  [Attempt {attempt + 1}] Timeout, retrying...")
                continue
            except Exception as e:
                print(f"  [Attempt {attempt + 1}] Error: {e}")
                continue

        return None


class DeepSeekAPI(BaseAI):
    """Interface to call DeepSeek via API."""

    def __init__(self, api_key=None, model='deepseek-chat'):
        self.api_key = api_key or config.get_deepseek_api_key()
        self.model = model
        self.base_url = 'https://api.deepseek.com/v1/chat/completions'
        self.token_usage = 0

    def call_model(self, prompt, max_retries=3):
        """Call DeepSeek API."""
        if not self.api_key:
            print("  [Error] DeepSeek API key not found")
            return None

        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }

        data = {
            'model': self.model,
            'messages': [
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.7
        }

        for attempt in range(max_retries):
            try:
                import urllib.request
                req = urllib.request.Request(
                    self.base_url,
                    data=json.dumps(data).encode('utf-8'),
                    headers=headers
                )

                with urllib.request.urlopen(req, timeout=30) as response:
                    result = json.loads(response.read().decode('utf-8'))
                    if 'usage' in result:
                        self.token_usage += result['usage'].get('total_tokens', 0)
                    return result['choices'][0]['message']['content'].strip()

            except Exception as e:
                print(f"  [Attempt {attempt + 1}] API Error: {e}")
                continue

        return None


class LocalModelAI(BaseAI):
    """Interface for local models (placeholder for transformers/vllm)."""

    def __init__(self, model_path, backend='transformers'):
        self.model_path = model_path
        self.backend = backend
        self.model = None
        self.tokenizer = None
        self._load_model()

    def _load_model(self):
        """Load the local model."""
        if self.backend == 'transformers':
            try:
                from transformers import AutoModelForCausalLM, AutoTokenizer
                print(f"Loading model from {self.model_path}...")
                self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_path,
                    device_map='auto',
                    trust_remote_code=True
                )
                print("Model loaded successfully!")
            except ImportError:
                print("  [Error] transformers not installed. Install with: pip install transformers torch")
            except Exception as e:
                print(f"  [Error] Failed to load model: {e}")
        else:
            print(f"  [Error] Backend '{self.backend}' not supported")

    def call_model(self, prompt, max_retries=3):
        """Call local model."""
        if not self.model or not self.tokenizer:
            return None

        try:
            inputs = self.tokenizer(prompt, return_tensors='pt').to(self.model.device)
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=100,
                temperature=0.7,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
            response = self.tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
            return response.strip()
        except Exception as e:
            print(f"  [Error] Generation failed: {e}")
            return None
