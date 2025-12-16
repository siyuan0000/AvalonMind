import json
import os
import uuid
from pathlib import Path
from typing import Dict, Optional

class AgentConfig:
    """Configuration for an Arena Agent."""

    def __init__(self, name: str, base_model: str, prompts: Dict[str, str], config_id: Optional[str] = None):
        self.id = config_id or str(uuid.uuid4())
        self.name = name
        self.base_model = base_model
        self.prompts = prompts

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "base_model": self.base_model,
            "prompts": self.prompts
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'AgentConfig':
        return cls(
            name=data["name"],
            base_model=data["base_model"],
            prompts=data["prompts"],
            config_id=data.get("id")
        )

class ArenaConfigManager:
    """Manages storage and retrieval of AgentConfigs."""

    def __init__(self, storage_dir: str = "arena_configs"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)

    def save_config(self, config: AgentConfig) -> str:
        """Save config to file. Returns config ID."""
        file_path = self.storage_dir / f"{config.id}.json"
        with open(file_path, 'w') as f:
            json.dump(config.to_dict(), f, indent=2)
        return config.id

    def load_config(self, config_id: str) -> Optional[AgentConfig]:
        """Load config by ID."""
        file_path = self.storage_dir / f"{config_id}.json"
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            return AgentConfig.from_dict(data)
        except Exception as e:
            print(f"Error loading config {config_id}: {e}")
            return None

    def list_configs(self) -> list[dict]:
        """List all available configs (summary)."""
        configs = []
        for file_path in self.storage_dir.glob("*.json"):
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    configs.append({
                        "id": data.get("id"),
                        "name": data.get("name"),
                        "base_model": data.get("base_model")
                    })
            except Exception:
                continue
        return configs

    def delete_config(self, config_id: str) -> bool:
        """Delete a config."""
        file_path = self.storage_dir / f"{config_id}.json"
        if file_path.exists():
            file_path.unlink()
            return True
        return False
