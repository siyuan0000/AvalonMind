import random
from typing import List, Optional

class Player:
    """Represents a player in the Avalon game."""

    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role
        self.is_evil = role in ['Morgana', 'Assassin']

    def __repr__(self) -> str:
        return f"{self.name} ({self.role})"


class AvalonGame:
    """Main game engine for 6-player Avalon."""

    # Mission configuration for 6 players
    MISSION_SIZES = [2, 3, 4, 3, 4]

    def __init__(self, player_names: List[str]):
        """
        Initialize game with 6 players.

        Game order rules:
        - Player list order: Fixed (e.g., Alice, Bob, Charlie, Diana, Eve, Frank)
        - Discussion order: Clockwise through player list (forward: 0→1→2→3→4→5)
        - Leader rotation: Clockwise (same direction as player order)
        """
        self.players = self.assign_roles(player_names)
        self.leader_index = random.randint(0, 5)
        self.mission_results: List[bool] = []  # True = Success, False = Fail
        self.rejection_count = 0
        self.current_round = 0

        self.current_round = 0

    def assign_roles(self, player_names: List[str]) -> List[Player]:
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
