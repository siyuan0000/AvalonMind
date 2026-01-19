import os
import sys
from avalon.core.engine import AvalonGame
from avalon.core.controller import GameController
from avalon.ai.backends import BaseAI

# Mock AI to avoid API calls and just return valid JSON
class MockAI(BaseAI):
    def call_model(self, prompt, max_retries=3):
        # Return a valid JSON response for any prompt
        if "suspicion_scores" in prompt or "JSON" in prompt:
            return '''
            {
                "thought_process": "Mock thought",
                "suspicion_scores": {"Alice": 10, "Bob": 20},
                "comment": "Mock comment",
                "vote": "APPROVE",
                "team": ["Alice", "Bob"],
                "action": "SUCCESS",
                "target": "Merlin"
            }
            '''
        return "Mock response"

def reproduce_bug():
    try:
        print("Initializing game...")
        player_names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank']
        game = AvalonGame(player_names)
        
        print("Initializing AI...")
        player_ais = [MockAI() for _ in range(6)]
        
        print("Initializing Controller...")
        controller = GameController(game, player_ais)
        
        print("Running one step of the game...")
        # We can't run the full game loop easily without blocking, 
        # but we can try to run the first round logic manually or just let it start and see if it crashes immediately.
        
        # Let's try to run just the first part of a round
        round_num = 0
        team_size = AvalonGame.MISSION_SIZES[round_num]
        leader = game.get_current_leader()
        
        print(f"Leader: {leader.name}")
        
        # Test ai_propose_team
        print("Testing ai_propose_team...")
        team, reasoning = controller.ai_propose_team(leader, team_size)
        print(f"Team: {team}, Reasoning: {reasoning}")
        
        print("Bug reproduction script finished successfully.")
        
    except Exception as e:
        print(f"CAUGHT EXCEPTION: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    reproduce_bug()
