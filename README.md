# AvalonRL

## Avalon 6-Player AI Game

A complete implementation of the Avalon board game (6-player version) where all players are controlled by AI using DeepSeek-R1 via Ollama.

> 🌐 **Live Demo**: Try it at [https://lsyon.onrender.com/](https://lsyon.onrender.com/)
> If the page seems stuck on loading, wait 1–2 minutes — the server may be waking up from sleep (free-tier hosting).


## Features

- Full 6-player Avalon game implementation based on the PRD
- All game phases: role assignment, team proposals, voting, missions, and assassination
- Proper role visibility logic (Merlin, Percival, Evil team)
- AI players controlled by DeepSeek-R1 via Ollama
- Strict output parsing to ensure AI follows game rules

## Role Composition (6 Players)

- **Good Team (4 players):**
  - Merlin: Knows all Evil players
  - Percival: Sees Merlin and Morgana (cannot distinguish)
  - Loyal Servant (x2): No special abilities

- **Evil Team (2 players):**
  - Morgana: Appears as Merlin to Percival
  - Assassin: Can kill Merlin if Good wins

## Prerequisites

### Required
- Python 3.7+

### Optional (depending on AI backend choice)
1. **Ollama** (for local Ollama models):
   - Install Ollama: https://ollama.ai
   - Pull models: `ollama pull deepseek-r1` or `ollama pull qwen2.5`

2. **DeepSeek API** (for online API):
   - Get API key from https://platform.deepseek.com
   - Configure API key using one of these methods:
     - Create `.env.local` file: `DEEPSEEK_API_KEY=your_key` (recommended)
     - Set environment variable: `export DEEPSEEK_API_KEY=your_key`
     - Enter manually when prompted

3. **Local Models** (for Transformers):
   - Install dependencies: `pip install transformers torch accelerate`
   - Download model from HuggingFace

## Installation

No additional Python dependencies required for basic usage (Ollama/API modes).
For local models, install: `pip install transformers torch accelerate`

## Usage

### Start the Web Application

Run the application using the entry point:
```bash
python run.py
```
python run.py
```
This will start the web server (default: http://localhost:5000).

### Run Evaluation

To run a batch evaluation of AI performance:
```bash
python evaluate_win_rate.py --rounds 10 --model deepseek-chat
```
Options:
- `--rounds`: Number of games to play (default: 10)
- `--model`: AI model to use (default: `deepseek-chat`)
- `--verbose`: Enable detailed game output (default: silent)

### Project Structure

The project follows a modular Python package layout:

- `avalon/`: Main package
  - `core/`: Game engine, controller, and logger
  - `ai/`: AI backend integrations
  - `web/`: Flask web application
  - `arena/`: Arena simulation engine
  - `services/`: External services (Supabase)
  - `config.py`: Centralized configuration
- `run.py`: Application entry point
- `logs/`: Game logs directory

### Example: Mixed AI Configuration

You can configure different players with different models:
- Alice: Ollama (deepseek-r1)
- Bob: Ollama (qwen2.5)
- Charlie: DeepSeek API (deepseek-chat)
- Diana: Ollama (llama3.1)
- Eve: DeepSeek API (deepseek-reasoner)
- Frank: Local Model (Qwen/Qwen2.5-7B-Instruct)

The game will:
1. Assign roles randomly to 6 AI players
2. Run through mission rounds with AI decision-making for:
   - Team proposals (leader)
   - Voting (all players)
   - Mission actions (team members)
3. Trigger assassination phase if Good wins 3 missions
4. Display final results

## How It Works

### Game Flow with Discussion Phase

Each mission round now includes a **Discussion Phase**:

1. **Initial Proposal**: Leader proposes a team
2. **Discussion Phase**: Each player (except leader) comments on the proposal in turn
   - Players can express support or concerns
   - Share strategic thoughts without revealing roles
   - Question the leader's choices
3. **Leader Final Decision**: Leader hears all comments and makes final team selection
   - Can keep original proposal or modify based on discussion
4. **Voting Phase**: All players vote on the final team
5. **Mission Phase**: If approved, selected players execute the mission

### AI Integration

Each decision point calls the configured AI backend with:
- Player's role information and visibility
- Current game state
- Discussion history (for later phases)
- Strict output format requirements

The system supports three backend types:
1. **OllamaAI**: Calls local models via `ollama run <model_name>`
2. **DeepSeekAPI**: Makes HTTP requests to DeepSeek's API
3. **LocalModelAI**: Loads models directly with Transformers

Example prompt format for team proposal:
```
You are playing Avalon. You are Merlin. You see the following Evil players: [Eve, Frank]

Mission Status: 1 Success, 0 Fail | Rejections this round: 0/5
Players: [Alice, Bob, Charlie, Diana, Eve, Frank]

You are the leader. You must select exactly 2 players for this mission.

IMPORTANT: Output ONLY a comma-separated list of player names, nothing else.
Example format: Alice,Bob

Your selection:
```

Example prompt format for discussion:
```
You are playing Avalon. You are Percival...

Leader Alice has proposed this team: [Alice, Bob]

Previous discussion:
  Charlie: I support this team composition.
  Diana: I have concerns about Bob's inclusion.

IMPORTANT: Output a brief comment (1-2 sentences) about this team proposal.

Your comment:
```

### Output Parsing

The system uses multiple strategies to extract valid choices:
1. Direct text matching
2. Regex pattern matching (brackets, quotes)
3. Fallback to random valid choice if parsing fails

### Game Flow

1. **Role Assignment**: Random distribution with proper 4 Good / 2 Evil split
2. **Mission Rounds**: 5 rounds with team sizes [2, 3, 4, 3, 4]
   - **Initial Proposal**: Leader AI proposes initial team
   - **Discussion Phase**: Each player comments on the proposal (5 players speak)
   - **Leader Final Decision**: Leader considers feedback and finalizes team
   - **Voting**: All AI players vote to approve/reject final team
   - **Mission Execution**: Selected AI players choose Success/Fail
3. **Win Conditions**:
   - Good wins after 3 successful missions (then assassination phase)
   - Evil wins after 3 failed missions
   - **Special Rule**: After 4 consecutive rejections, the 5th team is forced (no discussion, no vote) and must proceed to mission
   - Assassination: Evil wins if Assassin correctly identifies Merlin

## Example Output

```
============================================================
AVALON - 6 PLAYER GAME
============================================================

Role Assignment:
  Alice: Percival (Good)
  Bob: Loyal Servant (Good)
  Charlie: Assassin (Evil)
  Diana: Merlin (Good)
  Eve: Loyal Servant (Good)
  Frank: Morgana (Evil)

============================================================
ROUND 1 - Mission requires 2 players
============================================================

Leader: Alice
Initial proposal: ['Alice', 'Bob']

────────────────────────────────────────────────────────────
DISCUSSION PHASE
────────────────────────────────────────────────────────────

Bob: I support this team. We need to succeed on this first mission.

Charlie: I'm not sure about this composition. Maybe we should consider other options.

Diana: This team looks solid to me. Let's move forward.

Eve: I agree with the proposal. Alice is a good choice for the mission.

Frank: I have some concerns, but I'll defer to the majority.

────────────────────────────────────────────────────────────
Leader Alice makes final decision after hearing discussion...
────────────────────────────────────────────────────────────

Alice: I'm keeping my original proposal.
Final team: ['Alice', 'Bob']

────────────────────────────────────────────────────────────
VOTING PHASE
────────────────────────────────────────────────────────────
  Alice: APPROVE
  Bob: APPROVE
  Charlie: REJECT
  Diana: APPROVE
  Eve: APPROVE
  Frank: REJECT

Result: 4 approve, 2 reject → APPROVED

────────────────────────────────────────────────────────────
MISSION PHASE
────────────────────────────────────────────────────────────
  Alice: SUCCESS
  Bob: SUCCESS

Mission Result: SUCCESS
...
```

## Game Rules

- Good players MUST always choose Success on missions
- Evil players MAY choose Success or Fail on missions
- Majority vote required to approve team (except 5th vote)
- **5th Vote Rule**: After 4 rejections, the 5th team automatically proceeds without discussion or voting
- First team to win 3 missions triggers endgame
- If Good wins, Assassin gets one chance to identify Merlin

## Notes

- Each AI call has a 60-second timeout
- Maximum 3 retry attempts per decision
- Fallback to random valid choices if AI fails to respond properly
- Good players are forced to choose Success even if AI outputs Fail