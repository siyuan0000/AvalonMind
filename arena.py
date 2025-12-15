import random
import time
from typing import List, Dict, Optional
from game_engine import AvalonGame
from game_controller import GameController
from ai_backends import OllamaAI, DeepSeekAPI, LocalModelAI
from prompts import AvalonPrompts
from arena_config import AgentConfig

class Arena:
    """
    Arena engine for running 1 vs 5 matches.
    """

    def __init__(self, hero_config: AgentConfig, baseline_config: Optional[AgentConfig] = None):
        self.hero_config = hero_config
        self.baseline_config = baseline_config  # If None, use default settings
        self.results = []

    def _create_ai_instance(self, config: AgentConfig):
        """Create AI backend instance from config."""
        model_type = config.base_model.split('/')[0]
        model_name = config.base_model.split('/')[1] if '/' in config.base_model else config.base_model

        if model_type == 'ollama':
            return OllamaAI(model_name=model_name)
        elif model_type == 'deepseek':
            return DeepSeekAPI(model=model_name)
        elif model_type == 'local':
            return LocalModelAI(model_path=model_name)
        else:
            # Default fallback
            return OllamaAI(model_name='deepseek-r1')

    def _create_prompts_instance(self, config: AgentConfig) -> AvalonPrompts:
        """Create AvalonPrompts instance from config."""
        return AvalonPrompts(templates=config.prompts)

    def run_match(self) -> dict:
        """Run a single match."""
        player_names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank']
        
        # Randomly assign Hero position
        hero_index = random.randint(0, 5)
        hero_name = player_names[hero_index]
        
        # Setup players
        # Hero gets custom AI and Prompts
        hero_ai = self._create_ai_instance(self.hero_config)
        hero_prompts = self._create_prompts_instance(self.hero_config)
        
        # Baselines get default AI (or from config) and default prompts
        baseline_ais = []
        baseline_prompts = None
        
        if self.baseline_config:
            baseline_ai_proto = self._create_ai_instance(self.baseline_config)
            baseline_prompts = self._create_prompts_instance(self.baseline_config)
        else:
            # Default baseline: Ollama deepseek-r1 with default prompts
            baseline_ai_proto = OllamaAI(model_name='deepseek-r1')
            from prompts import _default_prompts
            baseline_prompts = _default_prompts

        # Construct player AI list
        player_ais = []
        player_prompts_map = {}
        
        for i, name in enumerate(player_names):
            if i == hero_index:
                player_ais.append(hero_ai)
                player_prompts_map[name] = hero_prompts
            else:
                # Create new instance for each baseline player to avoid shared state if any
                # (Though currently AI classes are stateless mostly, but good practice)
                if self.baseline_config:
                     player_ais.append(self._create_ai_instance(self.baseline_config))
                     player_prompts_map[name] = baseline_prompts
                else:
                     player_ais.append(OllamaAI(model_name='deepseek-r1'))
                     # Default prompts are handled by fallback in GameController, 
                     # but we can set them explicitly if we want.
                     # For now, let's leave them out of the map to test fallback 
                     # or set them to default instance.
                     from prompts import _default_prompts
                     player_prompts_map[name] = _default_prompts

        # Initialize Game
        game = AvalonGame(player_names)
        controller = GameController(game, player_ais)
        controller.set_player_prompts(player_prompts_map)
        
        # Run Game
        print(f"Starting Arena Match: Hero '{self.hero_config.name}' is {hero_name}...")
        
        # Get Hero Role
        hero_player = game.players[hero_index]
        hero_role = hero_player.role
        hero_is_evil = hero_player.is_evil
        
        # Run rounds
        good_wins = False
        for round_num in range(5):
            result = controller.run_mission_round(round_num)
            
            # Check win condition
            success_count = sum(game.mission_results)
            fail_count = len(game.mission_results) - success_count
            
            if success_count >= 3:
                good_wins = True
                break
            if fail_count >= 3:
                good_wins = False
                break
        
        # Assassination Phase if Good wins
        assassination_success = False
        if good_wins:
            assassin = next(p for p in game.players if p.role == 'Assassin')
            target = controller.ai_assassinate(assassin)
            if target.role == 'Merlin':
                print(f"Assassin {assassin.name} killed Merlin {target.name}! Evil wins!")
                good_wins = False # Evil steals the win
                assassination_success = True
            else:
                print(f"Assassin {assassin.name} failed to kill Merlin. Good wins!")
        
        # Determine if Hero won
        hero_won = (hero_is_evil and not good_wins) or (not hero_is_evil and good_wins)
        
        match_result = {
            "hero_name": self.hero_config.name,
            "hero_role": hero_role,
            "hero_is_evil": hero_is_evil,
            "good_wins": good_wins,
            "hero_won": hero_won,
            "assassination_success": assassination_success,
            "timestamp": time.time()
        }
        
        self.results.append(match_result)
        
        # Save to Supabase
        from supabase_client import supabase
        supabase.save_arena_match(match_result)
        
        return match_result

    def run_batch(self, num_games: int):
        """Run a batch of games."""
        print(f"Running batch of {num_games} games...")
        for i in range(num_games):
            print(f"\n--- Game {i+1}/{num_games} ---")
            self.run_match()
        
        self.print_summary()

    def print_summary(self):
        """Print summary of results."""
        total = len(self.results)
        if total == 0:
            print("No games run.")
            return

        wins = sum(1 for r in self.results if r['hero_won'])
        win_rate = wins / total * 100
        
        print("\n" + "="*60)
        print(f"ARENA RESULTS: {self.hero_config.name}")
        print("="*60)
        print(f"Total Games: {total}")
        print(f"Hero Wins: {wins}")
        print(f"Win Rate: {win_rate:.1f}%")
        
        # Role breakdown
        roles = {}
        for r in self.results:
            role = r['hero_role']
            if role not in roles:
                roles[role] = {'played': 0, 'won': 0}
            roles[role]['played'] += 1
            if r['hero_won']:
                roles[role]['won'] += 1
        
        print("\nRole Breakdown:")
        for role, stats in roles.items():
            rate = stats['won'] / stats['played'] * 100
            print(f"  {role}: {stats['won']}/{stats['played']} ({rate:.1f}%)")
