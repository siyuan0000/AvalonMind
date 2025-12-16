import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from avalon.web.app import app

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
    # Create logs directory if it doesn't exist
    logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)

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
