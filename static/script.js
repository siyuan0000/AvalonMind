// Avalon AI Game Web UI - JavaScript

// Global state
let statusInterval = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    // loadRecentGames();
    startStatusPolling();
});

// Start a new game
async function startGame() {
    const startButton = document.getElementById('startButton');
    // const mode = document.querySelector('input[name="configMode"]:checked').value;

    // if (mode === 'custom') {
    //     alert('Custom mode is not yet implemented in the web interface. Please use start.py for custom configurations.');
    //     return;
    // }

    // Disable start button
    startButton.disabled = true;
    startButton.textContent = 'Starting...';

    // Get configuration
    const userMode = document.querySelector('input[name="userMode"]:checked').value;
    const apiKey = document.getElementById('apiKey').value.trim();

    const config = {
        user_mode: userMode,
        api_key: apiKey
    };

    try {
        const response = await fetch('/api/start_game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to start game');
        }

        // Start polling for status
        startStatusPolling();

    } catch (error) {
        alert('Error starting game: ' + error.message);
        startButton.disabled = false;
        startButton.textContent = 'Start Game';
    }
}

// Start polling for game status
function startStatusPolling() {
    if (statusInterval) {
        clearInterval(statusInterval);
    }

    statusInterval = setInterval(updateGameStatus, 500);
    updateGameStatus(); // Initial update
    connectToStream();
}

// Connect to SSE stream
let eventSource = null;

function connectToStream() {
    if (eventSource) {
        eventSource.close();
    }

    eventSource = new EventSource('/api/stream');

    eventSource.onmessage = function (event) {
        // Generic log message
        try {
            const data = JSON.parse(event.data);
            appendLog(data.message);
        } catch (e) {
            console.error('Error parsing log:', e);
        }
    };

    eventSource.addEventListener('log', function (event) {
        const data = JSON.parse(event.data);
        appendLog(data.message);
    });

    eventSource.addEventListener('reasoning', function (event) {
        const data = JSON.parse(event.data);
        appendReasoning(data.player, data.content);
    });

    eventSource.addEventListener('discussion', function (event) {
        const data = JSON.parse(event.data);
        appendLog(`<strong>${data.player}</strong>: ${data.content}`, 'discussion');
    });

    eventSource.addEventListener('vote', function (event) {
        const data = JSON.parse(event.data);
        appendLog(`${data.player} voted <strong>${data.vote}</strong>`, data.vote.toLowerCase());
    });

    eventSource.addEventListener('phase', function (event) {
        const data = JSON.parse(event.data);
        appendLog(`--- ${data.name} ---`, 'phase');
    });

    eventSource.onerror = function (err) {
        console.error("EventSource failed:", err);
        eventSource.close();
        // Retry after a delay if game is still running
        setTimeout(() => {
            if (statusInterval) connectToStream();
        }, 5000);
    };
}

function appendLog(message, type = 'info') {
    const logContainer = document.getElementById('gameLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="timestamp">[${new Date().toLocaleTimeString()}]</span> ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;

    // Remove placeholder if present
    const placeholder = logContainer.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();
}

function appendReasoning(player, content) {
    const container = document.getElementById('aiReasoning');
    const entry = document.createElement('div');
    entry.className = 'reasoning-entry';
    entry.innerHTML = `
        <div class="reasoning-header">${player} is thinking...</div>
        <div class="reasoning-content">${content}</div>
    `;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;

    // Remove placeholder if present
    const placeholder = container.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();
}

// Update game status display
async function updateGameStatus() {
    try {
        const response = await fetch('/api/game_status');
        const status = await response.json();

        const statusDisplay = document.getElementById('gameStatus');
        const statusBadge = statusDisplay.querySelector('.status-badge');
        const statusMessage = document.getElementById('statusMessage');
        const startButton = document.getElementById('startButton');

        // Update badge
        statusBadge.className = 'status-badge ' + status.status;
        statusBadge.textContent = status.status.replace('_', ' ');

        // Update action text
        const actionText = document.getElementById('gameAction');
        if (status.current_action && status.status === 'running') {
            actionText.textContent = status.current_action;
            actionText.style.display = 'block';
        } else {
            actionText.style.display = 'none';
        }

        // Update message
        if (status.status === 'idle') {
            statusMessage.textContent = 'Ready to start a new game';
            startButton.disabled = false;
            startButton.textContent = 'Start Game';
            document.getElementById('interactionCard').style.display = 'none';
            if (statusInterval) {
                clearInterval(statusInterval);
                statusInterval = null;
            }
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
        } else if (status.status === 'starting' || status.status === 'initializing') {
            statusMessage.textContent = 'Game is starting...';
            document.getElementById('interactionCard').style.display = 'none';
        } else if (status.status === 'running') {
            statusMessage.textContent = 'Game is running...';

            // Check for pending input
            if (status.pending_input) {
                showInputForm(status.pending_input);
            } else {
                document.getElementById('interactionCard').style.display = 'none';
            }

        } else if (status.status === 'completed') {
            statusMessage.innerHTML = `Game completed! <a href="/viewer?game=${status.game_id}">View results</a>`;
            startButton.disabled = false;
            startButton.textContent = 'Start Another Game';
            document.getElementById('interactionCard').style.display = 'none';
            if (statusInterval) {
                clearInterval(statusInterval);
                statusInterval = null;
            }
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            loadRecentGames(); // Refresh game list
        } else if (status.status === 'error') {
            statusMessage.textContent = 'Error: ' + (status.error || 'Unknown error');
            startButton.disabled = false;
            startButton.textContent = 'Try Again';
            document.getElementById('interactionCard').style.display = 'none';
            if (statusInterval) {
                clearInterval(statusInterval);
                statusInterval = null;
            }
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
        }

    } catch (error) {
        console.error('Failed to update status:', error);
    }
}

function showInputForm(inputRequest) {
    const card = document.getElementById('interactionCard');
    const playerSpan = document.getElementById('interactionPlayer');
    const promptP = document.getElementById('interactionPrompt');
    const contentDiv = document.getElementById('interactionContent');

    card.style.display = 'block';
    playerSpan.textContent = inputRequest.player;

    const type = inputRequest.type;
    const data = inputRequest.data;

    let html = '';

    if (type === 'discussion') {
        promptP.textContent = `Discussion Phase: What do you want to say about the proposed team(${data.proposed_team.join(', ')}) ? `;
        html = `
    < div class="form-group" >
                <textarea id="discussionInput" rows="3" placeholder="Enter your comment..."></textarea>
                <button class="btn-primary" onclick="submitAction(document.getElementById('discussionInput').value)">Submit Comment</button>
            </div >
    <div class="info-box">
        <p><strong>Role Info:</strong> ${data.role_info}</p>
        <p><strong>Game State:</strong> ${data.game_state}</p>
    </div>
`;
    } else if (type === 'team_proposal') {
        promptP.textContent = `You are the Leader! Select ${data.team_size} players for the mission.`;

        const playersHtml = data.player_names.map(name => `
    < label class= "checkbox-label" >
    <input type="checkbox" name="teamSelect" value="${name}">
        ${name}
    </label>
        `).join('');

        html = `
        < div class="form-group" >
                <div class="checkbox-group">
                    ${playersHtml}
                </div>
                <button class="btn-primary" onclick="submitTeamProposal(${data.team_size})">Propose Team</button>
            </div >
    <div class="info-box">
        <p><strong>Role Info:</strong> ${data.role_info}</p>
    </div>
`;
    } else if (type === 'leader_final_proposal') {
        promptP.textContent = `Final Decision: Confirm or change your team proposal.`;

        const playersHtml = data.player_names.map(name => `
    < label class="checkbox-label" >
        <input type="checkbox" name="teamSelect" value="${name}" ${data.initial_team.includes(name) ? 'checked' : ''}>
            ${name}
        </label>
`).join('');

        html = `
    < div class="form-group" >
                <div class="checkbox-group">
                    ${playersHtml}
                </div>
                <button class="btn-primary" onclick="submitTeamProposal(${data.team_size})">Confirm Team</button>
            </div >
    <div class="info-box">
        <p><strong>Role Info:</strong> ${data.role_info}</p>
    </div>
`;
    } else if (type === 'vote') {
        promptP.textContent = `Vote on the proposed team: ${data.proposed_team.join(', ')} `;
        html = `
    < div class="action-buttons" >
                <button class="btn-success" onclick="submitAction('APPROVE')">APPROVE</button>
                <button class="btn-danger" onclick="submitAction('REJECT')">REJECT</button>
            </div >
    <div class="info-box">
        <p><strong>Role Info:</strong> ${data.role_info}</p>
    </div>
`;
    } else if (type === 'mission_action') {
        promptP.textContent = `Mission Phase: Choose your action.`;
        html = `
    < div class="action-buttons" >
                <button class="btn-success" onclick="submitAction('SUCCESS')">SUCCESS</button>
                <button class="btn-danger" onclick="submitAction('FAIL')">FAIL</button>
            </div >
    <div class="info-box">
        <p><strong>Role Info:</strong> ${data.role_info}</p>
        <p class="warning-text">Note: Good players MUST choose SUCCESS.</p>
    </div>
`;
    } else if (type === 'assassination') {
        promptP.textContent = `Assassin Phase: Identify Merlin!`;

        const playersHtml = data.good_players.map(name => `
    < label class="radio-label" >
        <input type="radio" name="assassinTarget" value="${name}">
            ${name}
        </label>
`).join('');

        html = `
    < div class="form-group" >
                <div class="radio-group">
                    ${playersHtml}
                </div>
                <button class="btn-danger" onclick="submitAssassinTarget()">Assassinate</button>
            </div >
    <div class="info-box">
        <p><strong>Role Info:</strong> ${data.role_info}</p>
    </div>
`;
    }

    contentDiv.innerHTML = html;
}

async function submitAction(action) {
    try {
        await fetch('/api/submit_action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action })
        });
        // Hide card immediately to prevent double submission
        document.getElementById('interactionCard').style.display = 'none';
    } catch (error) {
        console.error('Failed to submit action:', error);
        alert('Failed to submit action');
    }
}

function submitTeamProposal(teamSize) {
    const checkboxes = document.querySelectorAll('input[name="teamSelect"]:checked');
    if (checkboxes.length !== teamSize) {
        alert(`Please select exactly ${teamSize} players.`);
        return;
    }
    const selected = Array.from(checkboxes).map(cb => cb.value);
    submitAction(selected.join(', '));
}

function submitAssassinTarget() {
    const selected = document.querySelector('input[name="assassinTarget"]:checked');
    if (!selected) {
        alert('Please select a target.');
        return;
    }
    submitAction(selected.value);
}

// Load recent games list
async function loadRecentGames() {
    const gamesContainer = document.getElementById('recentGames');

    try {
        const response = await fetch('/api/logs');
        const data = await response.json();

        if (data.logs.length === 0) {
            gamesContainer.innerHTML = '<p class="info-text">No games played yet. Start a game to see results here!</p>';
            return;
        }

        // Display recent games (limit to 10)
        const recentGames = data.logs.slice(0, 10);
        gamesContainer.innerHTML = recentGames.map(game => `
    < div class="game-item" onclick = "viewGame('${game.game_id}')" >
                <div class="game-item-header">
                    <span class="game-id">${game.game_id}</span>
                    <span class="winner-badge ${game.winner.toLowerCase()}">${game.winner}</span>
                </div>
                <div class="game-timestamp">${formatTimestamp(game.timestamp)}</div>
            </div >
    `).join('');

    } catch (error) {
        console.error('Failed to load games:', error);
        gamesContainer.innerHTML = '<p class="loading">Failed to load games</p>';
    }
}

// View a specific game
function viewGame(gameId) {
    window.location.href = `/ viewer ? game = ${gameId} `;
}

// Format timestamp for display
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
