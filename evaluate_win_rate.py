
import argparse
import time
import os
from avalon.core.engine import AvalonGame
from avalon.core.controller import GameController
from avalon.ai.backends import DeepSeekAPI, OllamaAI
from avalon.config import config

def run_evaluation(num_rounds, model_name, verbose=False):
    """Run evaluation for a specified number of rounds."""
    
    print(f"Starting evaluation: {num_rounds} rounds with model {model_name}")
    
    results = {
        'good_wins': 0,
        'evil_wins': 0,
        'games': []
    }
    
    for i in range(num_rounds):
        print(f"Running game {i+1}/{num_rounds}...", end='', flush=True)
        game_start_time = time.time()
        
        try:
            # Initialize players
            player_names = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6']
            game = AvalonGame(player_names)
            
            # Create AI instances
            player_ais = []
            
            # Use DeepSeek API or Ollama based on model name
            if model_name.startswith('deepseek-') and 'r1' not in model_name: # Simple heuristic
                 # Check for API key
                api_key = config.get_deepseek_api_key()
                if not api_key:
                    print("Error: DeepSeek API Key not found.")
                    return
                
                for _ in range(6):
                    player_ais.append(DeepSeekAPI(api_key=api_key, model=model_name))
            else:
                # Assume Ollama for other models (including local deepseek-r1)
                for _ in range(6):
                    player_ais.append(OllamaAI(model_name=model_name))

            # Run game
            controller = GameController(game, player_ais, verbose=verbose)
            controller.run_game()
            
            # Record result
            # We need to peek at the last log event or the game state to determine winner
            # Since run_game() doesn't return the result, we can look at the logger
            
            # Check logs directly from controller.logger
            winner = controller.logger.game_log['final_result']['winner']
            
            if winner == 'GOOD':
                results['good_wins'] += 1
            else:
                results['evil_wins'] += 1
                
            duration = time.time() - game_start_time
            print(f" Done ({winner}) - {duration:.2f}s")
            
            results['games'].append({
                'id': i+1,
                'winner': winner,
                'duration': duration,
                'succeeded_missions': sum(game.mission_results)
            })
            
        except Exception as e:
            print(f" Error: {e}")
            import traceback
            traceback.print_exc()

    # Print summary
    print("\n" + "="*60)
    print("EVALUATION SUMMARY")
    print("="*60)
    print(f"Total Games: {num_rounds}")
    print(f"Good Wins:   {results['good_wins']} ({(results['good_wins']/num_rounds)*100:.1f}%)")
    print(f"Evil Wins:   {results['evil_wins']} ({(results['evil_wins']/num_rounds)*100:.1f}%)")
    print("="*60)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run Avalon AI Evaluation')
    parser.add_argument('--rounds', type=int, default=10, help='Number of rounds to play')
    parser.add_argument('--model', type=str, default='deepseek-chat', help='AI model to use (deepseek-chat, deepseek-r1, qwen2.5, etc.)')
    parser.add_argument('--verbose', action='store_true', help='Show game output')
    
    args = parser.parse_args()
    
    run_evaluation(args.rounds, args.model, args.verbose)
