#!/bin/bash

# Avalon AI Game Web UI Launcher

echo "Starting Avalon AI Game Web UI..."

# Check if Flask is installed
if ! python3 -c "import flask" 2>/dev/null; then
    echo "Installing Flask..."
    pip3 install flask
fi

# Start the web server
python3 run.py
