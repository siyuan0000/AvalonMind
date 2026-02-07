"""
Avalon AI Game Web UI
A simple Flask-based web interface for running and viewing Avalon games.
"""

from flask import Flask, render_template, request, jsonify, send_file, Response, session
import os
import json
import subprocess
import secrets
from threading import Thread, Event, Lock
from queue import Queue

# Core Modules
from avalon.core.engine import AvalonGame
from avalon.core.controller import GameController, HumanPlayer
from avalon.ai.backends import DeepSeekAPI
from avalon.config import config
from avalon.services.supabase import supabase

# Configure Flask to look for templates and static files in the project root
template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../templates'))
static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../static'))

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)

# Session configuration
app.secret_key = os.environ.get('FLASK_SECRET_KEY') or secrets.token_hex(32)

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

# Track current game controller instance
current_controller = None

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

def run_game_thread(game_config):
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
        api_key = config.get_deepseek_api_key()
        print(f"Loaded API Key: {'*' * 5 + api_key[-4:] if api_key else 'None'}")
        
        if not api_key:
            raise ValueError("DeepSeek API Key not found. Please check .env.local")
        
        # Player 0 (Alice) - Always Human Player (removed observer mode)
        player_ais.append(HumanPlayer(name=player_names[0]))
            
        # Players 1-5 - Fixed DeepSeek AI
        for i in range(1, 6):
            player_ais.append(DeepSeekAPI(api_key=api_key, model='deepseek-chat'))

        # Run the game
        running_game['status'] = 'running'
        controller = GameController(game, player_ais)
        
        global current_controller
        current_controller = controller
        
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
        
        # Save game to Supabase with user_id
        user_id = running_game.get('user_id')
        if user_id and controller.logger.game_log:
            supabase.save_game_log(controller.logger.game_log, user_id)
        
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

@app.route('/api/start_game', methods=['POST'])
def start_game():
    """Start a new game with the provided configuration"""
    global running_game

    # Check authentication
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Please login to play', 'auth_required': True}), 401
    
    # Check weekly play limit
    can_play, limit_info = supabase.check_can_play(user_id)
    if not can_play:
        return jsonify({
            'error': 'You have reached your weekly game limit. VIP members can play unlimited games.',
            'weekly_limit_reached': True,
            'weekly_count': limit_info.get('weekly_count', 1)
        }), 403

    game_config = request.json or {}
    
    if running_game['is_running']:
        return jsonify({'error': 'Game is already running'}), 400

    # Reset running game state with user_id
    running_game = {
        'is_running': True,
        'game_id': None,
        'status': 'starting',
        'log_path': None,
        'pending_input': None,
        'input_event': Event(),
        'input_response': None,
        'current_action': '',
        'user_id': user_id  # Track user for this game
    }

    # Start game in a separate thread
    thread = Thread(target=run_game_thread, args=(game_config,))
    thread.daemon = True
    thread.start()

    return jsonify({'message': 'Game started', 'status': 'starting'})

@app.route('/api/stop_game', methods=['POST'])
def stop_game():
    """Stop the current game"""
    global running_game, current_controller

    if not running_game['is_running']:
        return jsonify({'error': 'No game running'}), 400

    if current_controller:
        current_controller.stop()
        
    running_game['status'] = 'stopping'
    return jsonify({'message': 'Game stopping...', 'status': 'stopping'})

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

    return jsonify({'logs': logs})

@app.route('/api/log/<game_id>')
def get_log(game_id):
    """Get a specific game log"""
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

@app.route('/record')
def record():
    """User game records page"""
    return render_template('record.html')

# ============== Authentication Routes ==============

def get_current_user_id():
    """Get the current user ID from session."""
    return session.get('user_id')

def get_current_user_email():
    """Get the current user email from session."""
    return session.get('email')

@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    """Register a new user."""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    user, error = supabase.sign_up(email, password)
    
    if error:
        return jsonify({'error': error}), 400
    
    if user:
        # Create user profile
        supabase.create_user_profile(user.id, email)
        
        # Set session
        session['user_id'] = user.id
        session['email'] = email
        
        return jsonify({
            'message': 'Registration successful',
            'user': {
                'id': user.id,
                'email': email
            }
        })
    
    return jsonify({'error': 'Registration failed'}), 500

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Login an existing user."""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    user, error = supabase.sign_in(email, password)
    
    if error:
        return jsonify({'error': error}), 400
    
    if user:
        # Ensure user profile exists
        profile = supabase.get_user_profile(user.id)
        if not profile:
            supabase.create_user_profile(user.id, email)
        
        # Set session
        session['user_id'] = user.id
        session['email'] = email
        
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'email': email
            }
        })
    
    return jsonify({'error': 'Login failed'}), 500

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    """Logout the current user."""
    session.clear()
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/auth/me')
def auth_me():
    """Get current user info."""
    user_id = get_current_user_id()
    
    if not user_id:
        return jsonify({'authenticated': False})
    
    email = get_current_user_email()
    profile = supabase.get_user_profile(user_id)
    weekly_count = supabase.get_weekly_game_count(user_id)
    
    return jsonify({
        'authenticated': True,
        'user': {
            'id': user_id,
            'email': email,
            'is_vip': profile.get('is_vip', False) if profile else False,
            'weekly_games': weekly_count
        }
    })

@app.route('/api/user_games')
def get_user_games():
    """Get game logs for the current user."""
    user_id = get_current_user_id()
    
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    games = supabase.get_user_game_logs(user_id, limit, offset)
    
    # Extract summary info from each game
    game_summaries = []
    for game in games:
        log_data = game.get('log_data', {})
        
        # Find user's role (Alice is player 0)
        user_role = None
        players = log_data.get('players', [])
        for player in players:
            if player.get('name') == 'Alice':
                user_role = player.get('role')
                break
        
        game_summaries.append({
            'game_id': game.get('game_id'),
            'timestamp': game.get('timestamp'),
            'winner': game.get('winner'),
            'user_role': user_role,
            'has_ai_reasoning': bool(log_data.get('rounds'))
        })
    
    return jsonify({'games': game_summaries})

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

