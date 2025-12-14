"""
Avalon AI Game Web UI
A simple Flask-based web interface for running and viewing Avalon games.
"""

from flask import Flask, render_template, request, jsonify, send_file, Response
import os
import json
import subprocess
from datetime import datetime
from avalon_ai_game import AvalonGame, GameController, OllamaAI, DeepSeekAPI, LocalModelAI, HumanPlayer
from arena import Arena
from arena_config import AgentConfig, ArenaConfigManager
from supabase_client import supabase
from threading import Thread, Event, Lock
import time
from queue import Queue

app = Flask(__name__)

# Event streaming setup
event_listeners = []
listeners_lock = Lock()

def broadcast_event(event_type, data):
    """Broadcast an event to all connected listeners."""
    with listeners_lock:
        dead_listeners = []
        for q in event_listeners:
            try:
                q.put((event_type, data))
            except:
                dead_listeners.append(q)
        
        for q in dead_listeners:
            event_listeners.remove(q)

app = Flask(__name__)

# Global variable to track running game
running_game = {
    'is_running': False,
    'game_id': None,
    'status': 'idle',
    'log_path': None,
    'pending_input': None,  # {player, type, data}
    'input_event': Event(),
    'input_response': None,
    'current_action': ''
}

# Global variable to track running arena session
arena_runner = {
    'is_running': False,
    'status': 'idle',
    'progress': 0,
    'total_games': 0,
    'results': [],
    'current_game_idx': 0,
    'error': None
}

arena_config_manager = ArenaConfigManager()

def load_env_api_key():
    """Load API key from .env.local file"""
    env_path = os.path.join(os.path.dirname(__file__), '.env.local')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.strip().startswith('DEEPSEEK_API_KEY='):
                    key = line.strip().split('=', 1)[1].strip()
                    # Remove quotes if present
                    if (key.startswith('"') and key.endswith('"')) or \
                       (key.startswith("'") and key.endswith("'")):
                        key = key[1:-1]
                    return key
    return os.environ.get('DEEPSEEK_API_KEY')

def handle_log_action(message):
    """Callback to handle game log updates."""
    global running_game
    running_game['current_action'] = message

def handle_game_event(event_type, data):
    """Callback to handle game events."""
    broadcast_event(event_type, data)

@app.route('/api/stream')
def stream():
    def event_stream():
        q = Queue()
        with listeners_lock:
            event_listeners.append(q)
        try:
            while True:
                event_type, data = q.get()
                yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        except GeneratorExit:
            with listeners_lock:
                if q in event_listeners:
                    event_listeners.remove(q)

    return Response(event_stream(), mimetype="text/event-stream")

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    user, error = supabase.sign_up(email, password)
    if error:
        return jsonify({'error': error}), 400
    return jsonify({'user': {'id': user.id, 'email': user.email}})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    user, error = supabase.sign_in(email, password)
    if error:
        return jsonify({'error': error}), 400
    return jsonify({'user': {'id': user.id, 'email': user.email}})

@app.route('/api/user/<user_id>/usage')
def get_usage(user_id):
    usage = supabase.get_user_usage(user_id)
    return jsonify({'total_tokens': usage})

def handle_human_input(player_name, action_type, **kwargs):
    """Callback to handle human input requests from the game thread."""
    global running_game
    
    # Set pending input state
    running_game['pending_input'] = {
        'player': player_name,
        'type': action_type,
        'data': kwargs
    }
    
    # Clear event and wait for input
    running_game['input_event'].clear()
    running_game['input_event'].wait()
    
    # Get response and clear state
    response = running_game['input_response']
    running_game['pending_input'] = None
    running_game['input_response'] = None
    
    return response

def run_game_thread(config, user_id=None):
    """Run game in a separate thread"""
    global running_game

    try:
        running_game['status'] = 'initializing'

        # Initialize players
        player_names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank']
        game = AvalonGame(player_names)

        # Create AI instances based on configuration
        player_ais = []
        
        # Fixed DeepSeek API Key (from config or env)
        api_key = config.get('api_key') or load_env_api_key()
        print(f"Loaded API Key: {'*' * 5 + api_key[-4:] if api_key else 'None'}")
        
        if not api_key:
            raise ValueError("DeepSeek API Key not found. Please check .env.local")
        
        # Determine User Player (Player 0 - Alice)
        user_mode = config.get('user_mode', 'watch') # 'play' or 'watch'
        
        # Player 0 (Alice) - User or AI
        if user_mode == 'play':
            player_ais.append(HumanPlayer(name=player_names[0]))
        else:
            player_ais.append(DeepSeekAPI(api_key=api_key, model='deepseek-chat'))
            
        # Players 1-5 - Fixed DeepSeek AI
        for i in range(1, 6):
            player_ais.append(DeepSeekAPI(api_key=api_key, model='deepseek-chat'))

        # Run the game
        running_game['status'] = 'running'
        controller = GameController(game, player_ais)
        
        # Set input handler for human players
        controller.set_input_handler(handle_human_input)
        
        # Set log handler for status updates
        controller.set_log_handler(handle_log_action)
        
        # Set event handler for real-time updates
        controller.set_event_handler(handle_game_event)
        
        controller.run_game()

        # Game completed successfully
        running_game['status'] = 'completed'
        running_game['game_id'] = controller.logger.game_log['game_id']
        running_game['log_path'] = os.path.join('logs', f"game_{running_game['game_id']}.json")
        
        # Update token usage if user is logged in
        if user_id:
            tokens_used = controller.get_total_token_usage()
            supabase.update_token_usage(user_id, tokens_used)
            print(f"Updated token usage for user {user_id}: +{tokens_used} tokens")

    except Exception as e:
        running_game['status'] = 'error'
        running_game['error'] = str(e)
        print(f"Game error: {e}")

    finally:
        running_game['is_running'] = False

@app.route('/')
def index():
    """Main page - game setup and control"""
    return render_template('index.html')

@app.route('/arena')
def arena_page():
    """Arena configuration and runner page"""
    return render_template('arena.html')

@app.route('/api/start_game', methods=['POST'])
def start_game():
    """Start a new game with the provided configuration"""
    global running_game

    config = request.json
    user_id = config.get('user_id')
    
    if running_game['is_running']:
        return jsonify({'error': 'Game is already running'}), 400

    # Reset running game state
    running_game = {
        'is_running': True,
        'game_id': None,
        'status': 'starting',
        'log_path': None,
        'pending_input': None,
        'input_event': Event(),
        'input_response': None,
        'current_action': ''
    }

    # Start game in a separate thread
    thread = Thread(target=run_game_thread, args=(config,))
    thread.daemon = True
    thread.start()

    return jsonify({'message': 'Game started', 'status': 'starting'})

@app.route('/api/game_status')
def game_status():
    """Get current game status"""
    # Create a copy to avoid serialization issues with Event objects
    status_copy = running_game.copy()
    if 'input_event' in status_copy:
        del status_copy['input_event']
    return jsonify(status_copy)

@app.route('/api/submit_action', methods=['POST'])
def submit_action():
    """Submit an action for a human player"""
    global running_game
    
    if not running_game['is_running'] or not running_game['pending_input']:
        return jsonify({'error': 'No pending input request'}), 400
        
    data = request.json
    action = data.get('action')
    
    # Store response and signal game thread
    running_game['input_response'] = action
    running_game['input_event'].set()
    
    return jsonify({'status': 'success'})

@app.route('/api/logs')
def list_logs():
    """List all game logs"""
    logs_dir = os.path.join(os.path.dirname(__file__), 'logs')

    if not os.path.exists(logs_dir):
        return jsonify({'logs': []})

    logs = []
    for filename in os.listdir(logs_dir):
        if filename.endswith('.json'):
            filepath = os.path.join(logs_dir, filename)
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)
                    logs.append({
                        'filename': filename,
                        'game_id': data.get('game_id'),
                        'timestamp': data.get('timestamp'),
                        'winner': data.get('final_result', {}).get('winner', 'Unknown')
                    })
            except:
                pass

    # Sort by timestamp, most recent first
    logs.sort(key=lambda x: x['timestamp'], reverse=True)

    # Try to fetch from Supabase
    supabase_logs = supabase.get_game_logs(limit=20)
    if supabase_logs:
        # Merge or replace? For now, let's prefer Supabase if available, or just return Supabase logs
        # To keep it simple and consistent, if Supabase is connected, we return Supabase logs.
        # If not, we fall back to local logs.
        return jsonify({'logs': supabase_logs})

    return jsonify({'logs': logs})

@app.route('/api/log/<game_id>')
def get_log(game_id):
    """Get a specific game log"""
    # Try Supabase first
    supabase_log = supabase.get_game_log(game_id)
    if supabase_log:
        return jsonify(supabase_log)

    log_file = os.path.join(os.path.dirname(__file__), 'logs', f'game_{game_id}.json')

    if not os.path.exists(log_file):
        return jsonify({'error': 'Log not found'}), 404

    try:
        with open(log_file, 'r') as f:
            log_data = json.load(f)
        return jsonify(log_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/log/<game_id>/download')
def download_log(game_id):
    """Download a game log as JSON"""
    log_file = os.path.join(os.path.dirname(__file__), 'logs', f'game_{game_id}.json')

    if not os.path.exists(log_file):
        return jsonify({'error': 'Log not found'}), 404

    return send_file(log_file, as_attachment=True, download_name=f'game_{game_id}.json')

@app.route('/viewer')
def viewer():
    """Game log viewer page"""
    return render_template('viewer.html')

@app.route('/api/check_ollama')
def check_ollama():
    """Check if Ollama is available and list models"""
    try:
        result = subprocess.run(['ollama', 'list'],
                              capture_output=True,
                              text=True,
                              timeout=5)

        if result.returncode == 0:
            # Parse model list
            lines = result.stdout.strip().split('\n')[1:]  # Skip header
            models = []
            for line in lines:
                if line.strip():
                    parts = line.split()
                    if parts:
                        models.append(parts[0])

            return jsonify({
                'available': True,
                'models': models
            })
        else:
            return jsonify({'available': False, 'models': []})

    except Exception as e:
        return jsonify({'available': False, 'models': [], 'error': str(e)})

# -----------------------------------------------------------------------------
# Arena API Endpoints
# -----------------------------------------------------------------------------

def run_arena_thread(hero_config_data, baseline_config_data, num_games):
    """Run arena batch in a separate thread."""
    global arena_runner
    
    try:
        arena_runner['status'] = 'running'
        arena_runner['progress'] = 0
        arena_runner['total_games'] = num_games
        arena_runner['results'] = []
        arena_runner['error'] = None
        
        # Create configs
        hero_config = AgentConfig.from_dict(hero_config_data)
        baseline_config = AgentConfig.from_dict(baseline_config_data) if baseline_config_data else None
        
        # Initialize Arena
        arena = Arena(hero_config, baseline_config)
        
        print(f"Starting Arena Batch: {num_games} games")
        
        for i in range(num_games):
            if not arena_runner['is_running']:
                break
                
            arena_runner['current_game_idx'] = i + 1
            print(f"Arena Game {i+1}/{num_games}")
            
            result = arena.run_match()
            arena_runner['results'].append(result)
            arena_runner['progress'] = i + 1
            
            # Optional: Save result to Supabase or local file immediately
            
        arena_runner['status'] = 'completed'
        print("Arena Batch Completed")
        
    except Exception as e:
        arena_runner['status'] = 'error'
        arena_runner['error'] = str(e)
        print(f"Arena Error: {e}")
        
    finally:
        arena_runner['is_running'] = False

@app.route('/api/arena/start', methods=['POST'])
def start_arena():
    """Start an arena batch."""
    global arena_runner
    
    if arena_runner['is_running']:
        return jsonify({'error': 'Arena is already running'}), 400
        
    data = request.json
    hero_config = data.get('hero_config')
    baseline_config = data.get('baseline_config')
    num_games = data.get('num_games', 10)
    
    if not hero_config:
        return jsonify({'error': 'Hero config is required'}), 400
        
    arena_runner['is_running'] = True
    
    thread = Thread(target=run_arena_thread, args=(hero_config, baseline_config, num_games))
    thread.daemon = True
    thread.start()
    
    return jsonify({'message': 'Arena started', 'status': 'starting'})

@app.route('/api/arena/status')
def arena_status():
    """Get arena status."""
    return jsonify(arena_runner)

@app.route('/api/arena/stop', methods=['POST'])
def stop_arena():
    """Stop the arena."""
    global arena_runner
    arena_runner['is_running'] = False
    return jsonify({'message': 'Stopping arena...'})

@app.route('/api/arena/configs', methods=['GET'])
def list_arena_configs():
    """List saved agent configs."""
    configs = arena_config_manager.list_configs()
    return jsonify({'configs': configs})

@app.route('/api/arena/configs', methods=['POST'])
def save_arena_config():
    """Save an agent config."""
    data = request.json
    try:
        config = AgentConfig.from_dict(data)
        config_id = arena_config_manager.save_config(config)
        return jsonify({'id': config_id, 'message': 'Config saved'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/arena/configs/<config_id>', methods=['GET'])
def get_arena_config(config_id):
    """Get a specific agent config."""
    config = arena_config_manager.load_config(config_id)
    if config:
        return jsonify(config.to_dict())
    return jsonify({'error': 'Config not found'}), 404

@app.route('/api/arena/configs/<config_id>', methods=['DELETE'])
def delete_arena_config(config_id):
    """Delete an agent config."""
    if arena_config_manager.delete_config(config_id):
        return jsonify({'message': 'Config deleted'})
    return jsonify({'error': 'Config not found'}), 404

def find_free_port(start_port=5000, max_port=5010):
    """Find a free port to use"""
    import socket
    for port in range(start_port, max_port + 1):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('0.0.0.0', port))
                return port
        except OSError:
            continue
    return None

if __name__ == '__main__':
    import sys

    # Create logs directory if it doesn't exist
    logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)

    # Create templates and static directories if they don't exist
    templates_dir = os.path.join(os.path.dirname(__file__), 'templates')
    static_dir = os.path.join(os.path.dirname(__file__), 'static')

    if not os.path.exists(templates_dir):
        os.makedirs(templates_dir)
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)

    # Find available port (only on first run, not on reloader restart)
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        port = find_free_port(5000, 5010)

        if port is None:
            print("\nError: No available ports between 5000 and 5010")
            print("Please free up a port or disable AirPlay Receiver in System Preferences -> Sharing")
            exit(1)

        # Store port in environment for reloader
        os.environ['FLASK_PORT'] = str(port)

        print("\n" + "="*60)
        print("Avalon AI Game Web UI")
        print("="*60)
        print(f"\nStarting server on http://localhost:{port}")
        print("Press Ctrl+C to stop\n")
    else:
        # Reloader process, get port from environment
        port = int(os.environ.get('FLASK_PORT', 5000))

    app.run(debug=True, host='0.0.0.0', port=port)
