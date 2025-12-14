// Avalon AI Game Web UI - JavaScript

// Global state
let statusInterval = null;
let currentUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    loadRecentGames();
    setupAuth();
    startStatusPolling();

    // Check for stored user
    const storedUser = localStorage.getItem('avalon_user');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        updateAuthUI();
        fetchTokenUsage();
    }
});

function setupAuth() {
    const modal = document.getElementById('authModal');
    const loginBtn = document.getElementById('loginBtn');
    const closeBtn = document.querySelector('.close');
    const logoutBtn = document.getElementById('logoutBtn');
    const submitLogin = document.getElementById('submitLogin');
    const submitSignup = document.getElementById('submitSignup');

    loginBtn.onclick = () => modal.style.display = 'flex';
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = 'none';
    };

    logoutBtn.onclick = () => {
        currentUser = null;
        localStorage.removeItem('avalon_user');
        updateAuthUI();
    };

    submitLogin.onclick = (e) => {
        e.preventDefault();
        console.log('Login clicked');
        handleAuth('/api/login');
    };

    submitSignup.onclick = (e) => {
        e.preventDefault();
        console.log('Signup clicked');
        handleAuth('/api/signup');
    };
}

async function handleAuth(endpoint) {
    console.log('Handling auth for:', endpoint);
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('authMessage');

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        console.log('Auth response:', data);

        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('avalon_user', JSON.stringify(currentUser));
            document.getElementById('authModal').style.display = 'none';
            updateAuthUI();
            fetchTokenUsage();
            messageEl.textContent = '';
        } else {
            messageEl.textContent = data.error || 'Authentication failed';
        }
    } catch (error) {
        messageEl.textContent = 'Network error';
    }
}

function updateAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    const dashboard = document.getElementById('userDashboard');
    const userEmail = document.getElementById('userEmail');

    if (currentUser) {
        loginBtn.style.display = 'none';
        dashboard.style.display = 'flex';
        userEmail.textContent = currentUser.email;
    } else {
        loginBtn.style.display = 'block';
        dashboard.style.display = 'none';
    }
}

async function fetchTokenUsage() {
    if (!currentUser) return;
    try {
        const response = await fetch(`/api/user/${currentUser.id}/usage`);
        const data = await response.json();
        document.getElementById('tokenCount').textContent = data.total_tokens;
    } catch (error) {
        console.error('Failed to fetch usage:', error);
    }
}

async function startGame() {
    const startButton = document.getElementById('startButton');
    const statusMessage = document.getElementById('statusMessage');
    const userModeSelect = document.querySelector('input[name="userMode"]:checked');
    const userMode = userModeSelect ? userModeSelect.value : 'watch';

    startButton.disabled = true;
    statusMessage.textContent = 'Starting game...';

    try {
        const response = await fetch('/api/start_game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_mode: userMode,
                user_id: currentUser ? currentUser.id : null
            }),
        });

        const data = await response.json();

        if (response.ok) {
            statusMessage.textContent = 'Game started!';
            updateGameStatus();
            // Start polling
            if (!statusInterval) {
                statusInterval = setInterval(updateGameStatus, 1000);
            }
            connectToStream();
        } else {
            statusMessage.textContent = 'Error: ' + data.error;
            startButton.disabled = false;
        }
    } catch (error) {
        statusMessage.textContent = 'Failed to start game';
        startButton.disabled = false;
        console.error('Start game error:', error);
    }
}

async function stopGame() {
    const stopButton = document.getElementById('stopButton');
    const statusMessage = document.getElementById('statusMessage');

    if (!confirm('Are you sure you want to stop the current game?')) {
        return;
    }

    stopButton.disabled = true;
    statusMessage.textContent = 'Stopping game...';

    try {
        const response = await fetch('/api/stop_game', {
            method: 'POST',
        });
        const data = await response.json();

        if (response.ok) {
            statusMessage.textContent = 'Game stopped';
        } else {
            statusMessage.textContent = 'Error: ' + data.error;
            stopButton.disabled = false;
        }
    } catch (error) {
        statusMessage.textContent = 'Failed to stop game';
        stopButton.disabled = false;
        console.error('Stop game error:', error);
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

    let colorClass = 'text-slate-300';
    if (type === 'discussion') colorClass = 'text-indigo-300';
    if (type === 'approve') colorClass = 'text-emerald-400';
    if (type === 'reject') colorClass = 'text-red-400';
    if (type === 'phase') colorClass = 'text-amber-400 font-bold border-b border-amber-500/20 pb-1 mb-2 mt-4 text-center uppercase tracking-wider text-xs';

    entry.className = `mb-2 pb-2 border-b border-slate-800/50 last:border-0 ${colorClass}`;

    if (type === 'phase') {
        entry.innerHTML = message;
    } else {
        entry.innerHTML = `<span class="text-slate-500 text-xs mr-2 font-mono">[${new Date().toLocaleTimeString()}]</span> ${message}`;
    }

    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;

    // Remove placeholder if present
    const placeholder = logContainer.querySelector('p.text-slate-500'); // Updated selector for placeholder
    if (placeholder && placeholder.textContent.includes('Waiting')) placeholder.remove();
}

function appendReasoning(player, content) {
    const container = document.getElementById('aiReasoning');
    const entry = document.createElement('div');
    entry.className = 'mb-4 bg-slate-800/30 border border-slate-700/50 rounded p-3';
    entry.innerHTML = `
        <div class="text-xs font-bold text-indigo-400 mb-1 uppercase tracking-wider flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            ${player}
        </div>
        <div class="text-slate-300 whitespace-pre-wrap leading-relaxed">${content}</div>
    `;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;

    // Remove placeholder if present
    const placeholder = container.querySelector('p.text-slate-600'); // Updated selector
    if (placeholder && placeholder.textContent.includes('AI internal')) placeholder.remove();
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
        statusBadge.className = 'status-badge px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ' + getStatusClasses(status.status);
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
            document.getElementById('stopButton').classList.add('hidden');
            document.getElementById('stopButton').disabled = false;
        } else if (status.status === 'starting' || status.status === 'initializing') {
            statusMessage.textContent = 'Game is starting...';
            document.getElementById('interactionCard').style.display = 'none';
            document.getElementById('stopButton').classList.remove('hidden');
        } else if (status.status === 'running') {
            statusMessage.textContent = 'Game is running...';
            document.getElementById('stopButton').classList.remove('hidden');

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
            document.getElementById('stopButton').classList.add('hidden');
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
            document.getElementById('stopButton').classList.add('hidden');
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
            <div class="space-y-4">
                <textarea id="discussionInput" rows="3" class="input-dark w-full" placeholder="Enter your comment..."></textarea>
                <button class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors" onclick="submitAction(document.getElementById('discussionInput').value)">Submit Comment</button>
            </div>
            <div class="mt-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400 border border-slate-700">
                <p class="mb-1"><strong class="text-slate-300">Role Info:</strong> ${data.role_info}</p>
                <p><strong class="text-slate-300">Game State:</strong> ${data.game_state}</p>
            </div>
        `;
    } else if (type === 'team_proposal') {
        promptP.textContent = `You are the Leader! Select ${data.team_size} players for the mission.`;

        const playersHtml = data.player_names.map(name => `
            <label class="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 cursor-pointer transition-colors">
                <input type="checkbox" name="teamSelect" value="${name}" class="w-4 h-4 text-indigo-600 rounded border-slate-600 focus:ring-indigo-500 bg-slate-700">
                <span class="text-sm font-medium text-slate-200">${name}</span>
            </label>
        `).join('');

        html = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    ${playersHtml}
                </div>
                <button class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors" onclick="submitTeamProposal(${data.team_size})">Propose Team</button>
            </div>
            <div class="mt-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400 border border-slate-700">
                <p><strong class="text-slate-300">Role Info:</strong> ${data.role_info}</p>
            </div>
        `;
    } else if (type === 'leader_final_proposal') {
        promptP.textContent = `Final Decision: Confirm or change your team proposal.`;

        const playersHtml = data.player_names.map(name => `
            <label class="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 cursor-pointer transition-colors">
                <input type="checkbox" name="teamSelect" value="${name}" ${data.initial_team.includes(name) ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded border-slate-600 focus:ring-indigo-500 bg-slate-700">
                <span class="text-sm font-medium text-slate-200">${name}</span>
            </label>
        `).join('');

        html = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    ${playersHtml}
                </div>
                <button class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors" onclick="submitTeamProposal(${data.team_size})">Confirm Team</button>
            </div>
            <div class="mt-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400 border border-slate-700">
                <p><strong class="text-slate-300">Role Info:</strong> ${data.role_info}</p>
            </div>
        `;
    } else if (type === 'vote') {
        promptP.textContent = `Vote on the proposed team: ${data.proposed_team.join(', ')} `;
        html = `
            <div class="flex gap-4">
                <button class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors" onclick="submitAction('APPROVE')">APPROVE</button>
                <button class="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors" onclick="submitAction('REJECT')">REJECT</button>
            </div>
            <div class="mt-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400 border border-slate-700">
                <p><strong class="text-slate-300">Role Info:</strong> ${data.role_info}</p>
            </div>
        `;
    } else if (type === 'mission_action') {
        promptP.textContent = `Mission Phase: Choose your action.`;
        html = `
            <div class="flex gap-4">
                <button class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors" onclick="submitAction('SUCCESS')">SUCCESS</button>
                <button class="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors" onclick="submitAction('FAIL')">FAIL</button>
            </div>
            <div class="mt-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400 border border-slate-700">
                <p><strong class="text-slate-300">Role Info:</strong> ${data.role_info}</p>
                <p class="text-amber-400 mt-1">Note: Good players MUST choose SUCCESS.</p>
            </div>
        `;
    } else if (type === 'assassination') {
        promptP.textContent = `Assassin Phase: Identify Merlin!`;

        const playersHtml = data.good_players.map(name => `
            <label class="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 cursor-pointer transition-colors">
                <input type="radio" name="assassinTarget" value="${name}" class="w-4 h-4 text-red-600 border-slate-600 focus:ring-red-500 bg-slate-700">
                <span class="text-sm font-medium text-slate-200">${name}</span>
            </label>
        `).join('');

        html = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    ${playersHtml}
                </div>
                <button class="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors" onclick="submitAssassinTarget()">Assassinate</button>
            </div>
            <div class="mt-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400 border border-slate-700">
                <p><strong class="text-slate-300">Role Info:</strong> ${data.role_info}</p>
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
function getStatusClasses(status) {
    switch (status) {
        case 'idle': return 'bg-slate-800 text-slate-400 border-slate-700';
        case 'starting': return 'bg-amber-900/30 text-amber-400 border-amber-500/30 animate-pulse';
        case 'initializing': return 'bg-amber-900/30 text-amber-400 border-amber-500/30 animate-pulse';
        case 'running': return 'bg-indigo-900/30 text-indigo-400 border-indigo-500/30 animate-pulse';
        case 'completed': return 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30';
        case 'error': return 'bg-red-900/30 text-red-400 border-red-500/30';
        default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
}
