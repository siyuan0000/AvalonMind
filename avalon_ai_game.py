import random
import subprocess
import json
import re
import os
from typing import Optional
from pathlib import Path
from datetime import datetime
from prompts import AvalonPrompts
from game_logger import GameLogger

class Player:
    """Represents a player in the Avalon game."""

    def __init__(self, name, role):
        self.name = name
        self.role = role
        self.is_evil = role in ['Morgana', 'Assassin']

    def __repr__(self):
        return f"{self.name} ({self.role})"


class AvalonGame:
    """Main game engine for 6-player Avalon."""

    # Mission configuration for 6 players
    MISSION_SIZES = [2, 3, 4, 3, 4]

    def __init__(self, player_names):
        """
        Initialize game with 6 players.

        Game order rules:
        - Player list order: Fixed (e.g., Alice, Bob, Charlie, Diana, Eve, Frank)
        - Discussion order: Clockwise through player list (forward: 0→1→2→3→4→5)
        - Leader rotation: Clockwise (same direction as player order)
        """
        self.players = self.assign_roles(player_names)
        self.leader_index = random.randint(0, 5)
        self.mission_results = []  # True = Success, False = Fail
        self.rejection_count = 0
        self.current_round = 0

        # Display initial game state
        print("\n" + "="*60)
        print("AVALON - 6 PLAYER GAME")
        print("="*60)
        print("\nRole Assignment:")
        for p in self.players:
            print(f"  {p.name}: {p.role} ({'Evil' if p.is_evil else 'Good'})")
        print("\n" + "="*60)

    def assign_roles(self, player_names):
        """Assign roles according to 6-player setup."""
        roles = ['Merlin', 'Percival', 'Loyal Servant', 'Loyal Servant', 'Morgana', 'Assassin']
        random.shuffle(roles)
        return [Player(name, role) for name, role in zip(player_names, roles)]

    def get_role_visibility(self, player):
        """Get what information a player can see based on their role."""
        info = [f"You are {player.name}."]

        if player.role == 'Merlin':
            # Merlin sees all Evil players
            evil_players = [p.name for p in self.players if p.is_evil]
            info.append(f"You are Merlin. You see the following Evil players: {evil_players}")

        elif player.role == 'Percival':
            # Percival sees Merlin and Morgana (cannot distinguish)
            merlin_morgana = [p.name for p in self.players if p.role in ['Merlin', 'Morgana']]
            info.append(f"You are Percival. You see these as possible Merlins: {merlin_morgana}")

        elif player.role in ['Loyal Servant']:
            info.append(f"You are a Loyal Servant of Arthur. You have no special information.")

        elif player.is_evil:
            # Evil players see each other
            evil_team = [p.name for p in self.players if p.is_evil and p.name != player.name]
            info.append(f"You are {player.role} (Evil). Your evil teammates are: {evil_team}")

        return " ".join(info)

    def get_current_leader(self):
        """Get the current leader."""
        return self.players[self.leader_index]

    def rotate_leader(self):
        """Rotate leadership to next player clockwise (increasing indices)."""
        self.leader_index = (self.leader_index + 1) % len(self.players)

    def get_game_state(self):
        """Get current game state summary."""
        good_wins = sum(1 for r in self.mission_results if r)
        evil_wins = sum(1 for r in self.mission_results if not r)
        return f"Mission Status: {good_wins} Success, {evil_wins} Fail | Rejections this round: {self.rejection_count}/5"


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


class HumanPlayer(BaseAI):
    """Interface for a human player via Web UI."""

    def __init__(self, name):
        self.name = name

    def call_model(self, prompt, max_retries=3):
        """Should not be called directly for human players."""
        raise NotImplementedError("Human player input should be handled via input_handler")


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
        # Try to load API key from: 1) parameter, 2) .env.local file, 3) environment variable
        if api_key:
            self.api_key = api_key
        else:
            self.api_key = self._load_api_key_from_env_file() or os.getenv('DEEPSEEK_API_KEY')

        self.model = model
        self.base_url = 'https://api.deepseek.com/v1/chat/completions'

    def _load_api_key_from_env_file(self):
        """Load API key from .env.local file."""
        env_file = Path(__file__).parent / '.env.local'
        if env_file.exists():
            try:
                with open(env_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('DEEPSEEK_API_KEY='):
                            # Remove DEEPSEEK_API_KEY= prefix and any quotes
                            key = line.split('=', 1)[1].strip()
                            # Remove surrounding quotes if present
                            if (key.startswith('"') and key.endswith('"')) or \
                               (key.startswith("'") and key.endswith("'")):
                                key = key[1:-1]
                            return key
            except Exception as e:
                print(f"  [Warning] Could not read .env.local: {e}")
        return None

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


class GameController:
    """Controls the game flow with AI players."""

    def __init__(self, game, player_ai_configs):
        """
        Initialize game controller with per-player AI configurations.

        Args:
            game: AvalonGame instance
            player_ai_configs: List of 6 AI instances, one for each player
        """
        self.game = game
        self.player_ais = player_ai_configs
        self.input_handler = None  # Callback for human input
        self.log_handler = None    # Callback for status updates

        # Initialize game logger
        self.logger = GameLogger()
        self.logger.log_players(self.game.players, self.player_ais)

    def set_input_handler(self, handler):
        """Set callback for handling human input."""
        self.input_handler = handler

    def set_log_handler(self, handler):
        """Set callback for game status updates."""
        self.log_handler = handler

    def set_event_handler(self, handler):
        """Set callback for structured game events."""
        self.event_handler = handler

    def log_event(self, event_type, data):
        """Emit a structured event."""
        if hasattr(self, 'event_handler') and self.event_handler:
            self.event_handler(event_type, data)

    def log_action(self, message):
        """Send status update to handler."""
        if self.log_handler:
            self.log_handler(message)
        # Also emit as a generic log event
        self.log_event('log', {'message': message})

    def _get_human_input(self, player, action_type, **kwargs):
        """Request input from human player."""
        if self.input_handler:
            return self.input_handler(player.name, action_type, **kwargs)
        return None

    def get_player_ai(self, player):
        """Get the AI instance for a specific player."""
        player_index = self.game.players.index(player)
        return self.player_ais[player_index]

    def ai_discuss_proposal(self, player, leader, proposed_team, discussion_history):
        """AI player discusses the proposed team."""
        role_info = self.game.get_role_visibility(player)
        game_state = self.game.get_game_state()
        team_names = [p.name for p in proposed_team]
        game_history = self.logger.get_game_history_summary()

        prompt = AvalonPrompts.discussion(
            role_info=role_info,
            game_state=game_state,
            leader_name=leader.name,
            proposed_team=team_names,
            discussion_history=discussion_history,
            game_history=game_history
        )

        ai = self.get_player_ai(player)

        if isinstance(ai, HumanPlayer):
            response = self._get_human_input(
                player, 
                'discussion',
                role_info=role_info,
                game_state=game_state,
                leader_name=leader.name,
                proposed_team=team_names,
                discussion_history=discussion_history,
                game_history=game_history
            )
        else:
            response = ai.call_model(prompt)
            self.log_event('reasoning', {'player': player.name, 'content': response})

        if not response:
            return "I'll go with the majority decision."

        # Clean up response - take first 2 sentences max
        sentences = response.strip().split('.')[:2]
        comment = '.'.join(sentences).strip()
        if comment and not comment.endswith('.'):
            comment += '.'

        return comment if comment else "I'll trust the leader's judgment."

    def ai_leader_final_proposal(self, leader, initial_team, team_size, discussion_history):
        """AI leader makes final proposal after hearing discussion. Returns (team, reasoning)."""
        player_names = [p.name for p in self.game.players]
        role_info = self.game.get_role_visibility(leader)
        game_state = self.game.get_game_state()
        initial_team_names = [p.name for p in initial_team]
        game_history = self.logger.get_game_history_summary()

        prompt = AvalonPrompts.leader_final_decision(
            role_info=role_info,
            game_state=game_state,
            player_names=player_names,
            initial_team=initial_team_names,
            team_size=team_size,
            discussion_history=discussion_history,
            game_history=game_history
        )

        ai = self.get_player_ai(leader)

        if isinstance(ai, HumanPlayer):
            response = self._get_human_input(
                leader,
                'leader_final_proposal',
                role_info=role_info,
                game_state=game_state,
                player_names=player_names,
                initial_team=initial_team_names,
                team_size=team_size,
                discussion_history=discussion_history,
                game_history=game_history
            )
        else:
            response = ai.call_model(prompt)
            self.log_event('reasoning', {'player': leader.name, 'content': response})

        if not response:
            # Fallback: keep initial team
            return initial_team, "Keeping original team (no AI response)"

        # Parse the response
        selected_names = [name.strip() for name in response.replace('\n', ',').split(',')]
        selected_names = [name for name in selected_names if name in player_names]

        # Ensure we have exactly team_size players
        if len(selected_names) != team_size:
            # Fallback: keep initial team
            return initial_team, "Keeping original team (invalid AI response)"

        team = [p for p in self.game.players if p.name in selected_names]
        return team, response

    def ai_propose_team(self, leader, team_size):
        """AI leader proposes a team. Returns (team, reasoning)."""
        player_names = [p.name for p in self.game.players]
        role_info = self.game.get_role_visibility(leader)
        game_state = self.game.get_game_state()
        game_history = self.logger.get_game_history_summary()

        prompt = AvalonPrompts.team_proposal(
            role_info=role_info,
            game_state=game_state,
            player_names=player_names,
            team_size=team_size,
            game_history=game_history
        )

        self.log_action(f"{leader.name} is proposing a team...")
        print(f"\n[AI] {leader.name} is proposing a team...")
        ai = self.get_player_ai(leader)
        
        if isinstance(ai, HumanPlayer):
            response = self._get_human_input(
                leader,
                'team_proposal',
                role_info=role_info,
                game_state=game_state,
                player_names=player_names,
                team_size=team_size,
                game_history=game_history
            )
        else:
            response = ai.call_model(prompt)
            self.log_event('reasoning', {'player': leader.name, 'content': response})

        if not response:
            # Fallback: random selection
            print(f"  [Fallback] No valid response, selecting randomly")
            return random.sample(self.game.players, team_size), "No reasoning provided"

        # Parse the response
        selected_names = [name.strip() for name in response.replace('\n', ',').split(',')]
        selected_names = [name for name in selected_names if name in player_names]

        # Ensure we have exactly team_size players
        if len(selected_names) != team_size:
            print(f"  [Fallback] Invalid count ({len(selected_names)} != {team_size}), selecting randomly")
            return random.sample(self.game.players, team_size), "Random selection (AI response was invalid)"

        team = [p for p in self.game.players if p.name in selected_names]
        return team, response

    def ai_vote(self, player, proposed_team):
        """AI player votes on proposed team."""
        role_info = self.game.get_role_visibility(player)
        game_state = self.game.get_game_state()
        team_names = [p.name for p in proposed_team]
        game_history = self.logger.get_game_history_summary()

        prompt = AvalonPrompts.vote(
            role_info=role_info,
            game_state=game_state,
            proposed_team=team_names,
            game_history=game_history
        )

        ai = self.get_player_ai(player)
        
        if isinstance(ai, HumanPlayer):
            response = self._get_human_input(
                player,
                'vote',
                role_info=role_info,
                game_state=game_state,
                proposed_team=team_names,
                game_history=game_history
            )
        else:
            response = ai.call_model(prompt)
            self.log_event('reasoning', {'player': player.name, 'content': response})
        
        vote = ai.extract_choice(response, ['APPROVE', 'REJECT'])

        if not vote:
            # Fallback: random vote
            vote = random.choice(['APPROVE', 'REJECT'])

        return vote == 'APPROVE'

    def ai_mission_action(self, player):
        """AI player chooses mission action (Success or Fail)."""
        role_info = self.game.get_role_visibility(player)
        game_state = self.game.get_game_state()
        game_history = self.logger.get_game_history_summary()

        prompt = AvalonPrompts.mission_action(
            role_info=role_info,
            game_state=game_state,
            game_history=game_history
        )

        ai = self.get_player_ai(player)

        if isinstance(ai, HumanPlayer):
            response = self._get_human_input(
                player,
                'mission_action',
                role_info=role_info,
                game_state=game_state,
                game_history=game_history
            )
        else:
            response = ai.call_model(prompt)
            self.log_event('reasoning', {'player': player.name, 'content': response})

        action = ai.extract_choice(response, ['SUCCESS', 'FAIL'])

        if not action:
            # Fallback based on role
            if player.is_evil:
                action = random.choice(['SUCCESS', 'FAIL'])
            else:
                action = 'SUCCESS'

        # Good players MUST choose success
        if not player.is_evil and action == 'FAIL':
            action = 'SUCCESS'

        return action == 'SUCCESS'

    def ai_assassinate(self, assassin):
        """AI assassin chooses target to kill."""
        player_names = [p.name for p in self.game.players if not p.is_evil]
        role_info = self.game.get_role_visibility(assassin)
        game_history = self.logger.get_game_history_summary()

        prompt = AvalonPrompts.assassination(
            role_info=role_info,
            good_players=player_names,
            game_history=game_history
        )

        ai = self.get_player_ai(assassin)

        if isinstance(ai, HumanPlayer):
            response = self._get_human_input(
                assassin,
                'assassination',
                role_info=role_info,
                good_players=player_names,
                game_history=game_history
            )
        else:
            response = ai.call_model(prompt)
            self.log_event('reasoning', {'player': assassin.name, 'content': response})

        # Extract target name
        target_name = None
        for name in player_names:
            if name in response:
                target_name = name
                break

        if not target_name:
            # Fallback: random good player
            target_name = random.choice(player_names)

        return next(p for p in self.game.players if p.name == target_name)

    def run_mission_round(self, round_num):
        """Run a complete mission round with discussion phase."""
        team_size = AvalonGame.MISSION_SIZES[round_num]

        print(f"\n{'='*60}")
        print(f"ROUND {round_num + 1} - Mission requires {team_size} players")
        print(f"{'='*60}")
        self.log_action(f"Starting Round {round_num + 1} (Team size: {team_size})")
        self.log_event('phase', {'name': 'Round Start', 'round': round_num + 1, 'team_size': team_size})

        # Initialize round log
        round_log = self.logger.start_round(round_num + 1, team_size)

        self.game.rejection_count = 0

        while self.game.rejection_count < 5:
            leader = self.game.get_current_leader()
            print(f"\nLeader: {leader.name}")
            print(f"Vote attempt: {self.game.rejection_count + 1}/5")

            # Check if this is the 5th vote (forced mission)
            is_forced_mission = (self.game.rejection_count == 4)

            # Leader proposes initial team
            initial_team, leader_reasoning = self.ai_propose_team(leader, team_size)
            initial_team_names = [p.name for p in initial_team]
            print(f"Initial proposal: {initial_team_names}")

            # Initialize proposal log
            proposal_log = self.logger.log_proposal(leader.name, initial_team_names, is_forced_mission)
            self.logger.log_leader_reasoning(proposal_log, leader_reasoning)

            # Skip discussion phase on 5th vote
            if is_forced_mission:
                print(f"\n{'─'*60}")
                print("⚠️  5TH VOTE - FORCED MISSION (No discussion)")
                print(f"{'─'*60}")
                print("\nAfter 4 rejections, this team must proceed without voting!")
                final_team = initial_team
                final_team_names = initial_team_names
                self.logger.log_final_team(proposal_log, final_team_names)
            else:
                # Discussion phase - each player comments in order
                print(f"\n{'─'*60}")
                print("DISCUSSION PHASE")
                print(f"{'─'*60}")
                self.log_action(f"Discussion Phase: Leader {leader.name} opens the floor")

                # Discussion happens clockwise, matching leader order
                discussion_history = []

                # Leader opens the discussion with initial reasoning
                leader_opening = self.ai_discuss_proposal(leader, leader, initial_team, discussion_history)
                discussion_history.append((leader.name, leader_opening))
                self.logger.add_discussion_comment(proposal_log, leader.name, leader_opening, tag="Leader Opening")
                self.log_event('discussion', {'player': leader.name, 'content': leader_opening, 'tag': 'Leader Opening'})
                print(f"\n{leader.name} (Leader opening): {leader_opening}")

                leader_position = self.game.players.index(leader)
                discussion_order = [
                    self.game.players[(leader_position + offset) % len(self.game.players)]
                    for offset in range(1, len(self.game.players))
                ]

                for player in discussion_order:
                    self.log_action(f"Discussion: {player.name} is speaking...")
                    comment = self.ai_discuss_proposal(player, leader, initial_team, discussion_history)
                    discussion_history.append((player.name, comment))
                    self.logger.add_discussion_comment(proposal_log, player.name, comment)
                    self.log_event('discussion', {'player': player.name, 'content': comment})
                    print(f"\n{player.name}: {comment}")

                # Leader gives a final summary after hearing everyone
                leader_summary = self.ai_discuss_proposal(leader, leader, initial_team, discussion_history)
                discussion_history.append((leader.name, leader_summary))
                self.logger.add_discussion_comment(proposal_log, leader.name, leader_summary, tag="Leader Summary")
                self.log_event('discussion', {'player': leader.name, 'content': leader_summary, 'tag': 'Leader Summary'})
                print(f"\n{leader.name} (Leader summary): {leader_summary}")

                # Leader's final summary and decision
                print(f"\n{'─'*60}")
                print(f"Leader {leader.name} makes final decision after hearing discussion...")
                print(f"{'─'*60}")

                final_team, final_reasoning = self.ai_leader_final_proposal(leader, initial_team, team_size, discussion_history)

                # Check if team changed
                initial_names = set(p.name for p in initial_team)
                final_names = set(p.name for p in final_team)
                final_team_names = [p.name for p in final_team]

                # Log final team
                self.logger.log_final_team(proposal_log, final_team_names, final_reasoning)

                if initial_names != final_names:
                    print(f"\n{leader.name}: After considering your input, I'm changing my proposal.")
                    print(f"Final team: {final_team_names}")
                else:
                    print(f"\n{leader.name}: I'm keeping my original proposal.")
                    print(f"Final team: {final_team_names}")

            # Voting phase (skip on 5th vote)
            if is_forced_mission:
                print(f"\n{'─'*60}")
                print("FORCED MISSION - NO VOTE")
                print(f"{'─'*60}")
                print("\nThe team automatically proceeds to mission!")
                approved = True
            else:
                print(f"\n{'─'*60}")
                print("VOTING PHASE")
                print(f"{'─'*60}")
                self.log_action(f"Voting Phase: Players are voting on {leader.name}'s team")

                votes = []
                votes_dict = {}
                for player in self.game.players:
                    vote = self.ai_vote(player, final_team)
                    votes.append(vote)
                    votes_dict[player.name] = vote
                    print(f"  {player.name}: {'APPROVE' if vote else 'REJECT'}")
                    self.log_event('vote', {'player': player.name, 'vote': 'APPROVE' if vote else 'REJECT'})

                # Log votes
                self.logger.log_votes(proposal_log, votes_dict)

                approve_count = sum(votes)
                approved = approve_count > len(votes) / 2

                print(f"\nResult: {approve_count} approve, {len(votes) - approve_count} reject → {'APPROVED' if approved else 'REJECTED'}")
                self.log_action(f"Vote Result: {'APPROVED' if approved else 'REJECTED'} ({approve_count} vs {len(votes) - approve_count})")

            # Record proposal outcome for the shared timeline memory
            round_log['proposals'].append(proposal_log)

            if approved:
                # Run mission
                print(f"\n{'─'*60}")
                print("MISSION PHASE")
                print(f"{'─'*60}")
                self.log_action("Mission Phase: Team is executing the mission...")

                mission_actions = []
                mission_actions_dict = {}
                for player in final_team:
                    action = self.ai_mission_action(player)
                    mission_actions.append(action)
                    mission_actions_dict[player.name] = action
                    print(f"  {player.name}: {'SUCCESS' if action else 'FAIL'}")

                success_count = sum(mission_actions)
                mission_success = success_count == len(final_team)

                print(f"\nMission Result: {'SUCCESS' if mission_success else 'FAIL'}")
                self.log_action(f"Mission Result: {'SUCCESS' if mission_success else 'FAIL'} ({success_count} success, {len(final_team) - success_count} fail)")

                # Log mission result
                self.logger.log_mission(round_log, final_team_names, mission_actions_dict, mission_success)

                self.game.mission_results.append(mission_success)
                return mission_success
            else:
                # Team rejected, rotate to next leader
                self.game.rejection_count += 1
                self.game.rotate_leader()
                print(f"\nLeadership passes to next player...")

        # Should never reach here (5th vote is forced)
        return False

    def run_assassination_phase(self):
        """Run assassination phase after Good wins 3 missions."""
        print(f"\n{'='*60}")
        print("ASSASSINATION PHASE")
        print(f"{'='*60}")
        self.log_action("Assassination Phase: Assassin is choosing a target...")

        assassin = next(p for p in self.game.players if p.role == 'Assassin')
        print(f"\n{assassin.name} (Assassin) must identify and kill Merlin...")

        target = self.ai_assassinate(assassin)
        print(f"\nAssassin targets: {target.name}")

        target_was_merlin = (target.role == 'Merlin')

        # Log assassination
        self.logger.log_assassination(assassin.name, target.name, target_was_merlin)

        if target_was_merlin:
            print(f"\n{target.name} was Merlin! EVIL WINS!")
            self.log_action(f"Assassination Successful! {target.name} was Merlin. EVIL WINS!")
            return False
        else:
            print(f"\n{target.name} was {target.role}, not Merlin! GOOD WINS!")
            self.log_action(f"Assassination Failed! {target.name} was {target.role}. GOOD WINS!")
            return True

    def run_game(self):
        """Run the complete game."""
        # Run 5 rounds or until win condition
        for round_num in range(5):
            self.run_mission_round(round_num)

            good_wins = sum(1 for r in self.game.mission_results if r)
            evil_wins = sum(1 for r in self.game.mission_results if not r)

            # Check win conditions
            if good_wins >= 3:
                # Good wins 3 missions, assassin phase
                good_victory = self.run_assassination_phase()
                self.print_final_result(good_victory)
                return
            elif evil_wins >= 3:
                # Evil wins 3 missions
                print(f"\n{'='*60}")
                print("EVIL WINS 3 MISSIONS!")
                print(f"{'='*60}")
                self.print_final_result(False)
                return

        # Should not reach here
        self.print_final_result(False)

    def print_final_result(self, good_victory):
        """Print final game result."""
        winner = 'GOOD' if good_victory else 'EVIL'
        mission_results = ['SUCCESS' if r else 'FAIL' for r in self.game.mission_results]

        # Log final result
        self.logger.log_final_result(winner, mission_results)

        # Save game log
        self.logger.save()

        print(f"\n{'='*60}")
        print("GAME OVER")
        print(f"{'='*60}")
        print(f"\nWinner: {winner}")
        print(f"\nMission Results: {mission_results}")
        print(f"\nFinal Roles:")
        for p in self.game.players:
            print(f"  {p.name}: {p.role} ({'Evil' if p.is_evil else 'Good'})")
        print(f"\n{'='*60}")


def main():
    """Main entry point."""
    print("Starting Avalon 6-Player AI Game...")
    print("Using DeepSeek-R1 via Ollama for all players\n")

    # Check if ollama is available
    try:
        subprocess.run(['ollama', 'list'], capture_output=True, check=True)
    except Exception as e:
        print(f"ERROR: Ollama not found. Please install Ollama and run 'ollama pull deepseek-r1'")
        return

    # Create game with 6 players
    player_names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank']
    game = AvalonGame(player_names)

    # Run game with AI controller
    from avalon_ai_game import OllamaAI

    # lightweight 1B model for smooth gameplay
    player_ais = [OllamaAI(model_name="Llama-3.2-1B-Instruct-Q6_K") for _ in range(6)]

    controller = GameController(game, player_ais)
    controller.run_game()


if __name__ == "__main__":
    main()
