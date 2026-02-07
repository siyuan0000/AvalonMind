// Avalon AI Game Web UI - JavaScript

// Global state
let statusInterval = null;
let currentUser = null;
let lastPendingInput = null;  // Track last pending input to avoid unnecessary re-renders
let currentPlayerRole = null;  // Track current player's role
let gameStarted = false;  // Track if game has started

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    checkAuthStatus();
    startStatusPolling();
});

// ============== Authentication ==============

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data.user;
            updateUIForLoggedInUser(data.user);
        } else {
            currentUser = null;
            updateUIForLoggedOutUser();
        }
    } catch (error) {
        console.error('Failed to check auth status:', error);
        currentUser = null;
        updateUIForLoggedOutUser();
    }
}

function updateUIForLoggedInUser(user) {
    // Update nav email
    const navEmail = document.getElementById('navUserEmail');
    if (navEmail) {
        navEmail.textContent = user.email.split('@')[0];
        navEmail.classList.remove('hidden');
    }
    
    // Update weekly games info
    const weeklyInfo = document.getElementById('weeklyGamesInfo');
    const weeklyText = document.getElementById('weeklyGamesText');
    if (weeklyInfo && weeklyText) {
        if (user.is_vip) {
            weeklyInfo.classList.add('hidden');
        } else {
            weeklyInfo.classList.remove('hidden');
            weeklyText.textContent = `Games this week: ${user.weekly_games}/1`;
        }
    }
    
    // Update modal user info
    document.getElementById('authForm').classList.add('hidden');
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('userEmail').textContent = user.email;
    
    const vipBadge = document.getElementById('vipBadge');
    const userWeeklyGames = document.getElementById('userWeeklyGames');
    
    if (user.is_vip) {
        vipBadge.classList.remove('hidden');
        userWeeklyGames.textContent = 'Unlimited games';
    } else {
        vipBadge.classList.add('hidden');
        userWeeklyGames.textContent = `${user.weekly_games}/1 games this week`;
    }
}

function updateUIForLoggedOutUser() {
    // Hide nav email
    const navEmail = document.getElementById('navUserEmail');
    if (navEmail) {
        navEmail.classList.add('hidden');
    }
    
    // Hide weekly games info
    const weeklyInfo = document.getElementById('weeklyGamesInfo');
    if (weeklyInfo) {
        weeklyInfo.classList.add('hidden');
    }
    
    // Update modal
    document.getElementById('authForm').classList.remove('hidden');
    document.getElementById('userInfo').classList.add('hidden');
}

function openSettingsModal() {
    document.getElementById('settingsModal').classList.remove('hidden');
    document.getElementById('authError').classList.add('hidden');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.add('hidden');
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('settingsModal');
    if (e.target === modal) {
        closeSettingsModal();
    }
});

async function handleLogin() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');
    
    if (!email || !password) {
        errorEl.textContent = 'Please enter email and password';
        errorEl.classList.remove('hidden');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            errorEl.classList.add('hidden');
            await checkAuthStatus();
            closeSettingsModal();
        } else {
            errorEl.textContent = data.error || 'Login failed';
            errorEl.classList.remove('hidden');
        }
    } catch (error) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.classList.remove('hidden');
    }
}

async function handleRegister() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');
    
    if (!email || !password) {
        errorEl.textContent = 'Please enter email and password';
        errorEl.classList.remove('hidden');
        return;
    }
    
    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.classList.remove('hidden');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            errorEl.classList.add('hidden');
            await checkAuthStatus();
            closeSettingsModal();
        } else {
            errorEl.textContent = data.error || 'Registration failed';
            errorEl.classList.remove('hidden');
        }
    } catch (error) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.classList.remove('hidden');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        updateUIForLoggedOutUser();
        closeSettingsModal();
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

function handleSwitchAccount() {
    handleLogout();
    setTimeout(() => {
        openSettingsModal();
    }, 100);
}

// ============== Game Control ==============

async function startGame() {
    const startButton = document.getElementById('startButton');
    const statusMessage = document.getElementById('configStatusMessage');

    startButton.disabled = true;
    statusMessage.textContent = 'Starting game...';

    try {
        const response = await fetch('/api/start_game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
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
            
            // Fetch player role when game starts
            setTimeout(fetchPlayerRole, 1000);
        } else if (response.status === 401) {
            // Not authenticated
            statusMessage.textContent = 'Please login to play';
            startButton.disabled = false;
            openSettingsModal();
        } else if (response.status === 403 && data.weekly_limit_reached) {
            // Weekly limit reached
            statusMessage.textContent = 'Weekly game limit reached';
            startButton.disabled = false;
            alert('You have reached your weekly game limit (1 game per week).\n\nUpgrade to VIP for unlimited games!');
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
    if (statusMessage) statusMessage.textContent = 'Stopping game...';

    try {
        const response = await fetch('/api/stop_game', {
            method: 'POST',
        });
        const data = await response.json();

        if (response.ok) {
            if (statusMessage) statusMessage.textContent = 'Game stopped';
        } else {
            if (statusMessage) statusMessage.textContent = 'Error: ' + data.error;
            stopButton.disabled = false;
        }
    } catch (error) {
        if (statusMessage) statusMessage.textContent = 'Failed to stop game';
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

    eventSource.addEventListener('suspicion', function (event) {
        const data = JSON.parse(event.data);
        updateSuspicionHeatmap(data.player, data.scores);
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

// ============== Improved Suspicion Heatmap ==============

function updateSuspicionHeatmap(observer, scores) {
    const container = document.getElementById('suspicionHeatmap');
    container.innerHTML = ''; // Clear waiting message

    // Sort scores by value (descending)
    const sortedEntries = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    sortedEntries.forEach(([target, score], index) => {
        // Determine color based on score
        let barColorClass = 'from-emerald-500 to-emerald-400';
        let textColorClass = 'text-emerald-400';
        let bgColorClass = 'bg-emerald-500/10';
        let borderColorClass = 'border-emerald-500/30';
        
        if (score > 70) {
            barColorClass = 'from-red-500 to-red-400';
            textColorClass = 'text-red-400';
            bgColorClass = 'bg-red-500/10';
            borderColorClass = 'border-red-500/30';
        } else if (score > 30) {
            barColorClass = 'from-amber-500 to-amber-400';
            textColorClass = 'text-amber-400';
            bgColorClass = 'bg-amber-500/10';
            borderColorClass = 'border-amber-500/30';
        }

        const card = document.createElement('div');
        card.className = `${bgColorClass} border ${borderColorClass} rounded-lg p-4 transition-all duration-300 hover:scale-[1.02]`;
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm">
                    ${target.charAt(0)}
                </div>
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-semibold text-white">${target}</span>
                        <span class="text-lg font-bold ${textColorClass}">${score}%</span>
                    </div>
                    <div class="w-full bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
                        <div class="bg-gradient-to-r ${barColorClass} h-2.5 rounded-full transition-all duration-700 ease-out" style="width: ${score}%"></div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    // Add observer label
    const label = document.createElement('div');
    label.className = 'text-xs text-center text-slate-500 mt-4 pt-3 border-t border-slate-700';
    label.innerHTML = `Viewing suspicion from <strong class="text-indigo-400">${observer}</strong>'s perspective`;
    container.appendChild(label);
}

// ============== Game Log ==============

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
    const placeholder = logContainer.querySelector('p.text-slate-500');
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
    const placeholder = container.querySelector('p.text-slate-600');
    if (placeholder && placeholder.textContent.includes('AI internal')) placeholder.remove();
}

// ============== Game Status ==============

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
            if (statusMessage) statusMessage.textContent = 'Ready to start a new game';
            startButton.disabled = false;
            startButton.textContent = 'Start New Game';
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
            
            // Reset game state
            gameStarted = false;
            updateSeatingChart('idle');
        } else if (status.status === 'starting' || status.status === 'initializing') {
            if (statusMessage) statusMessage.textContent = 'Game is starting...';
            document.getElementById('interactionCard').style.display = 'none';
            document.getElementById('stopButton').classList.remove('hidden');
            
            // Game is starting
            gameStarted = true;
            updateSeatingChart('starting');
        } else if (status.status === 'running') {
            if (statusMessage) statusMessage.textContent = 'Game is running...';
            document.getElementById('stopButton').classList.remove('hidden');
            
            // Game is running
            gameStarted = true;
            updateSeatingChart('running', status.current_action);

            // Check for pending input - only re-render if input type/data has changed
            if (status.pending_input) {
                // Compare with last pending input to avoid unnecessary re-renders
                const shouldRender = !lastPendingInput || 
                                   lastPendingInput.type !== status.pending_input.type ||
                                   JSON.stringify(lastPendingInput.data) !== JSON.stringify(status.pending_input.data);
                            
                if (shouldRender) {
                    showInputForm(status.pending_input);
                    lastPendingInput = status.pending_input;
                }
            } else {
                document.getElementById('interactionCard').style.display = 'none';
                lastPendingInput = null;
            }

        } else if (status.status === 'completed') {
            if (statusMessage) statusMessage.innerHTML = `Game completed! <a href="/record" class="text-indigo-400 hover:underline">View records</a>`;
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
            document.getElementById('stopButton').classList.add('hidden');
            
            // Game completed
            updateSeatingChart('completed');
            
            // Refresh auth status to update weekly count
            checkAuthStatus();
        } else if (status.status === 'error') {
            if (statusMessage) statusMessage.textContent = 'Error: ' + (status.error || 'Unknown error');
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
            
            // Show error in seating chart
            updateSeatingChart('error');
        }

    } catch (error) {
        console.error('Failed to update status:', error);
    }
}

// ============== Player Input Forms ==============

function showInputForm(inputRequest) {
    const card = document.getElementById('interactionCard');
    const promptP = document.getElementById('interactionPrompt');
    const contentDiv = document.getElementById('interactionContent');

    card.style.display = 'block';

    const type = inputRequest.type;
    const data = inputRequest.data;

    let html = '';

    if (type === 'discussion') {
        promptP.textContent = `Discussion Phase: What do you want to say about the proposed team (${data.proposed_team.join(', ')})?`;
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
        promptP.textContent = `Vote on the proposed team: ${data.proposed_team.join(', ')}`;
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

// ============== Utilities ==============

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

// ============== Seating Chart Functions ==============

function updateSeatingChart(gameStatus, currentAction = '') {
    const phaseElement = document.getElementById('currentPhase');
    
    // Update phase text
    switch (gameStatus) {
        case 'idle':
            phaseElement.textContent = 'Waiting to start';
            phaseElement.className = 'text-amber-400 font-medium';
            break;
        case 'starting':
        case 'initializing':
            phaseElement.textContent = 'Game Starting...';
            phaseElement.className = 'text-amber-400 font-medium animate-pulse';
            break;
        case 'running':
            phaseElement.textContent = currentAction || 'Game in Progress';
            phaseElement.className = 'text-indigo-400 font-medium';
            break;
        case 'completed':
            phaseElement.textContent = 'Game Completed!';
            phaseElement.className = 'text-emerald-400 font-medium';
            break;
        case 'error':
            phaseElement.textContent = 'Error Occurred';
            phaseElement.className = 'text-red-400 font-medium';
            break;
        default:
            phaseElement.textContent = 'Unknown';
            phaseElement.className = 'text-slate-400 font-medium';
    }
    
    // Update player indicators based on game state
    const seatElements = [
        document.getElementById('seat1'),
        document.getElementById('seat2'),
        document.getElementById('seat3'),
        document.getElementById('seat4'),
        document.getElementById('seat5'),
        document.getElementById('seat6')
    ];
    
    // Reset all seats to default state
    seatElements.forEach((seat, index) => {
        if (seat) {
            const parent = seat.parentElement;
            if (parent) {
                if (index === 0) {
                    // Player 1 (Human) - special styling
                    parent.className = 'absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg border-2 border-indigo-300';
                } else {
                    // AI players
                    parent.className = 'absolute w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-600';
                }
            }
        }
    });
    
    // Add active indicators based on game status
    if (gameStatus === 'running' || gameStatus === 'starting' || gameStatus === 'initializing') {
        // Add active indicator to Player 1 (you)
        const player1Indicator = document.querySelector('#seat1').parentElement.querySelector('div:last-child');
        if (player1Indicator) {
            player1Indicator.className = 'absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white animate-pulse';
        }
    }
}

// Fetch and display player role when game starts
async function fetchPlayerRole() {
    try {
        // In a real implementation, this would fetch the actual role from the game state
        // For now, we'll simulate it
        currentPlayerRole = 'Merlin'; // Default role
        
        // Update player name display with role
        const playerNameElement = document.getElementById('playerName');
        if (playerNameElement) {
            playerNameElement.textContent = `Alice (${currentPlayerRole})`;
        }
        
        console.log(`[INFO] Player role: ${currentPlayerRole}`);
    } catch (error) {
        console.error('Failed to fetch player role:', error);
    }
}
