// Avalon AI Game Web UI - JavaScript

// Global state
let statusInterval = null;
let currentUser = null;
let lastPendingInput = null;  // Track last pending input to avoid unnecessary re-renders
let currentPlayerRole = null;  // Track current player's role
let gameStarted = false;  // Track if game has started
let lastPolledAction = ""; // Track last polled action to mix with SSE updates

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    checkAuthStatus();
    startStatusPolling();
    // Initialize role info display
    initializeRoleInfo();
});

// Initialize role info display
async function initializeRoleInfo() {
    try {
        // Try to get current game status to see if there's an active game
        const response = await fetch('/api/game_status');
        if (response.ok) {
            const gameStatus = await response.json();
            if (gameStatus.status === 'running' && gameStatus.game_id) {
                // Game is running, fetch role info
                await fetchPlayerRole();
            }
        }
    } catch (error) {
        console.log('No active game found, using default role display');
    }
}

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
        vipBadge.classList.add('hidden');
        userWeeklyGames.textContent = `${user.weekly_games}/1 games this week`;
    }

    // Populate display name
    const displayNameInput = document.getElementById('userDisplayName');
    if (displayNameInput) {
        displayNameInput.value = user.display_name || '';
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
document.addEventListener('click', function (e) {
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

async function updateProfile() {
    const displayName = document.getElementById('userDisplayName').value;
    const saveBtn = document.querySelector('button[onclick="updateProfile()"]');
    const originalText = saveBtn.textContent;

    if (!displayName) {
        alert('Please enter a display name');
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const response = await fetch('/api/auth/update_profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_name: displayName })
        });

        const data = await response.json();

        if (response.ok) {
            saveBtn.textContent = 'Saved!';
            saveBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500');
            saveBtn.classList.add('bg-green-600', 'hover:bg-green-500');

            // Refresh auth status to update UI
            await checkAuthStatus();

            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-500');
                saveBtn.classList.remove('bg-green-600', 'hover:bg-green-500');
                saveBtn.disabled = false;
            }, 2000);
        } else {
            alert('Error: ' + data.error);
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    } catch (error) {
        console.error('Update profile error:', error);
        alert('Failed to update profile');
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
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

function updateInteractionStatus(text) {
    const actionText = document.getElementById('gameAction');
    if (actionText) {
        actionText.textContent = text;
        actionText.style.display = 'block';
        // Add highlight animation
        actionText.classList.remove('animate-pulse-fast');
        void actionText.offsetWidth; // trigger reflow
        actionText.classList.add('animate-pulse-fast');
    }
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
        if (data.message) updateInteractionStatus(data.message);

        // Manga FX for Mission Outcomes
        if (data.message && data.message.includes('Mission')) {
            if (data.message.includes('Succeeded')) showOnomatopoeia('SUCCESS!', 'success');
            if (data.message.includes('Failed')) showOnomatopoeia('FAIL!', 'fail');
            // Force update to show mission result on track immediately
            updateGameStatus();
        }
    });

    eventSource.addEventListener('reasoning', function (event) {
        const data = JSON.parse(event.data);
        appendReasoning(data.player, data.content);
    });

    eventSource.addEventListener('discussion', function (event) {
        const data = JSON.parse(event.data);
        appendLog(`<strong>${data.player}</strong>: ${data.content}`, 'discussion');
        updateInteractionStatus(`${data.player}: ${data.content}`);
        showSpeechBubble(data.player, data.content);
    });

    eventSource.addEventListener('vote', function (event) {
        const data = JSON.parse(event.data);
        appendLog(`${data.player} voted <strong>${data.vote}</strong>`, data.vote.toLowerCase());
        updateInteractionStatus(`${data.player} voted ${data.vote}`);
        showSpeechBubble(data.player, (data.vote === 'APPROVE' ? 'I Approve!' : 'I Reject!'));
        if (data.vote === 'REJECT') showOnomatopoeia('SLAM!', 'fail');
        // Force update to show vote on track (if revealed) or just generic state
        updateGameStatus();
    });

    eventSource.addEventListener('phase', function (event) {
        const data = JSON.parse(event.data);
        appendLog(`--- ${data.name} ---`, 'phase');
        updateInteractionStatus(`--- ${data.name} ---`);
        // Force update to reflect new phase on board
        updateGameStatus();
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
    if (container) {
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

    // --- MANGA BOARD UPDATE ---
    Object.entries(scores).forEach(([player, score]) => {
        // Find slot logic similar to showSpeechBubble
        let slotIndex = -1;
        for (let i = 0; i < 6; i++) {
            const slot = document.getElementById(`slot-${i}`);
            if (slot) {
                const nameTag = slot.querySelector('.bg-slate-800\\/90');
                if (nameTag) {
                    const currentName = nameTag.textContent;
                    if (currentName === player || (player === 'You' && currentName === 'YOU')) {
                        slotIndex = i;
                        break;
                    }
                }
            }
        }

        if (slotIndex !== -1) {
            const slot = document.getElementById(`slot-${slotIndex}`);
            const avatarFrame = slot.querySelector('.avatar-frame');

            // Remove old classes
            slot.classList.remove('shake');
            slot.classList.remove('high-suspicion');

            // Add Sweat Drop if not exists
            if (avatarFrame && !avatarFrame.querySelector('.sweat-drop')) {
                const drop = document.createElement('div');
                drop.className = 'sweat-drop';
                avatarFrame.appendChild(drop);
            }

            if (score > 60) {
                slot.classList.add('high-suspicion'); // Red glow + sweat
            }
            if (score > 75) {
                slot.classList.add('shake'); // Shake effect
            }

            // Update Crystal Color
            const crystal = slot.querySelector('.sus-crystal');
            if (crystal) {
                if (score < 40) crystal.className = 'sus-crystal bg-emerald-500';
                else if (score < 70) crystal.className = 'sus-crystal bg-amber-500';
                else crystal.className = 'sus-crystal bg-red-600';
            }
        }
    });
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
        // Update action text ONLY if changed (to avoid overwriting real-time SSE updates)
        if (status.current_action && status.status === 'running') {
            if (status.current_action !== lastPolledAction) {
                updateInteractionStatus(status.current_action);
                lastPolledAction = status.current_action;
            }
        } else {
            // For non-running states, force update or hide
            const actionText = document.getElementById('gameAction');
            if (!status.current_action) {
                actionText.style.display = 'none';
            } else {
                actionText.textContent = status.current_action;
                actionText.style.display = 'block';
            }
        }

        // Toggle Role Info Visibility
        const roleInfoContainer = document.getElementById('roleInfoContainer');
        if (status.status === 'running' || status.status === 'starting' || status.status === 'initializing') {
            if (roleInfoContainer.classList.contains('hidden')) {
                roleInfoContainer.classList.remove('hidden');
                roleInfoContainer.classList.add('animate-pulse-glow');
                // Remove animation after a few seconds
                setTimeout(() => roleInfoContainer.classList.remove('animate-pulse-glow'), 3000);
            }
        } else if (status.status === 'idle') {
            roleInfoContainer.classList.add('hidden');
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

        // Update Proposed Team Display
        const proposedTeamContainer = document.getElementById('proposedTeamContainer');
        const proposedTeamText = document.getElementById('proposedTeamText');

        if (proposedTeamContainer && proposedTeamText) {
            const team = status.current_team_proposal;
            if (team && team.length > 0) {
                proposedTeamText.textContent = team.join(', ');
                proposedTeamContainer.classList.remove('hidden');
                // Small delay to allow display:block to apply before opacity transition
                setTimeout(() => proposedTeamContainer.classList.remove('opacity-0'), 10);
            } else {
                proposedTeamContainer.classList.add('hidden');
                proposedTeamContainer.classList.add('opacity-0');
            }
        }

        // Update Visual Tracks
        updateGameTracks(status);

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

    // Disable the button to prevent double submission
    const button = document.querySelector('button[onclick^="submitTeamProposal"]');
    if (button) {
        button.disabled = true;
        button.textContent = 'Submitting...';
        button.classList.add('opacity-50', 'cursor-not-allowed');
    }

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


// ============== Seating Chart Functions (Manga Board) ==============

function updateSeatingChart(status, currentAction = '') {
    // Update Phase Text
    const phaseText = document.getElementById('visualPhaseText');
    if (phaseText && status.status) {
        phaseText.textContent = `${status.status.toUpperCase()} - ${currentAction || 'Waiting'}`;
    }

    if (!status.players || status.players.length === 0) return;

    // Helper to find player index
    const players = status.players; // Array of names

    // Determine rotation to put "Me" at slot 0 (if playing)
    // Note: This requires knowing "my" player name in the game. 
    // Usually currentUser.email -> mapped to player name. 
    // For simplicity, we'll map strictly by index for now.

    players.forEach((name, index) => {
        const slotId = `slot-${index}`;
        const slot = document.getElementById(slotId);
        if (!slot) return;

        // Update Name Tag
        const nameTag = slot.querySelector('.bg-slate-800\\/90');
        if (nameTag) {
            nameTag.textContent = name;
            if (name === 'You' || (currentUser && name === currentUser.email.split('@')[0])) {
                nameTag.textContent = 'YOU';
                nameTag.classList.add('text-white', 'font-bold');
            }
        }

        // Update Avatar Seed (Consistency)
        const img = slot.querySelector('img');
        if (img) {
            img.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}`;
        }

        // Active Turn Highlight
        // Logic: Try to detect if this player is "active" based on logs or state
        // status.current_player might be available?
        // If not, we might need to rely on logs. 
        // Assuming status has 'current_player' or we parse it from currentAction.

        // Simple heuristic: if action starts with name
        const isActive = currentAction.startsWith(name) || (status.current_player === name);

        if (isActive) {
            slot.classList.add('active-turn');
        } else {
            slot.classList.remove('active-turn');
        }
    });
}

// ============== Visual Tracks (Manga Board) ==============

function updateGameTracks(status) {
    // 1. Update Manga Quest Track
    const visualQuestTrack = document.getElementById('visualQuestTrack');
    if (visualQuestTrack) {
        const teamSizes = [2, 3, 4, 3, 4];
        let questHtml = '';

        teamSizes.forEach((size, index) => {
            let stateClass = 'border-slate-600 bg-slate-800/50 text-slate-500'; // Default

            if (status.status === 'idle') {
                // Reset
            } else if (index < status.current_round) {
                // Completed
                if (status.mission_results && status.mission_results[index]) {
                    stateClass = 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'; // Success
                } else {
                    stateClass = 'border-red-500 bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]'; // Fail
                }
            } else if (index === status.current_round && status.status !== 'completed') {
                // Current
                stateClass = 'border-amber-400 bg-amber-500/20 text-amber-200 scale-110 shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-pulse';
            }

            questHtml += `
                <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300 ${stateClass}">
                    ${size}
                </div>
            `;
        });
        visualQuestTrack.innerHTML = questHtml;
    }

    // 2. Update Manga Vote Track
    const visualVoteTrack = document.getElementById('visualVoteTrack');
    if (visualVoteTrack) {
        let voteHtml = '<div class="absolute top-1/2 left-0 w-full h-0.5 bg-slate-700 -translate-y-1/2 z-0"></div>';

        const rejections = status.rejection_count || 0;

        for (let i = 0; i < 5; i++) {
            let markerClass = 'bg-slate-700';
            let sizeClass = 'w-2 h-2';

            if (i < rejections) {
                markerClass = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-110';
            }
            if (i === 4) { // The Fail Node
                markerClass = i < rejections ? 'bg-red-600 border border-red-400' : 'bg-red-900/50 border border-red-900';
                sizeClass = 'w-3 h-3';
            }

            voteHtml += `<div class="rounded-full ${sizeClass} ${markerClass} z-10 transition-all duration-300"></div>`;
        }
        visualVoteTrack.innerHTML = voteHtml;
    }
}



// Fetch and display player role when game starts
async function fetchPlayerRole() {
    try {
        // Fetch actual game data to get player role
        const response = await fetch('/api/game_status');
        const gameStatus = await response.json();

        // 1. Try to get role from direct game state (preferred)
        if (gameStatus.player_roles && gameStatus.player_roles['Alice']) {
            const alice = gameStatus.player_roles['Alice'];
            currentPlayerRole = alice.role;

            // Update player name display with role
            const playerNameElement = document.getElementById('playerName');
            if (playerNameElement) {
                playerNameElement.textContent = `Alice (${currentPlayerRole})`;
            }

            // Update role info text with detailed information from backend
            const roleInfoElement = document.getElementById('roleInfoText');
            if (roleInfoElement) {
                roleInfoElement.textContent = alice.description;
                // Remove placeholder styling if any
                roleInfoElement.classList.remove('italic', 'text-slate-500');
                roleInfoElement.classList.add('text-slate-300');
            }
            return;
        }

        // 2. Fallback: Fetch from log file (legacy method)
        if (gameStatus.log_path) {
            // Fetch the game log to get role information
            const logResponse = await fetch(`/api/log/${gameStatus.game_id}`);
            if (logResponse.ok) {
                const logData = await logResponse.json();

                // Find Alice's role in the player list
                const players = logData.players || [];
                const alice = players.find(p => p.name === 'Alice');

                if (alice) {
                    currentPlayerRole = alice.role;

                    // Update player name display with role
                    const playerNameElement = document.getElementById('playerName');
                    if (playerNameElement) {
                        playerNameElement.textContent = `Alice (${currentPlayerRole})`;
                    }

                    // Update role info text with detailed information
                    const roleInfoElement = document.getElementById('roleInfoText');
                    if (roleInfoElement) {
                        let roleDescription = `You are Alice. You are ${currentPlayerRole}.`;

                        // Add role-specific information
                        if (currentPlayerRole === 'Merlin') {
                            // Find evil players
                            const evilPlayers = players.filter(p => p.is_evil).map(p => p.name);
                            roleDescription += ` You see the following Evil players: ${JSON.stringify(evilPlayers)}`;
                        } else if (currentPlayerRole === 'Percival') {
                            // Find Merlin and Morgana
                            const merlinMorgana = players.filter(p => p.role === 'Merlin' || p.role === 'Morgana').map(p => p.name);
                            roleDescription += ` You see these as possible Merlins: ${JSON.stringify(merlinMorgana)}`;
                        } else if (currentPlayerRole === 'Loyal Servant') {
                            roleDescription += ` You have no special information.`;
                        } else if (alice.is_evil) {
                            // Evil roles
                            const evilTeammates = players.filter(p => p.is_evil && p.name !== 'Alice').map(p => p.name);
                            roleDescription += ` Your evil teammates are: ${JSON.stringify(evilTeammates)}`;
                        }

                        roleInfoElement.textContent = roleDescription;
                    }

                    console.log(`[INFO] Player role: ${currentPlayerRole}`);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching player role:', error);
    }
}


// ============== Narrative Visuals (Manga) ==============

function showSpeechBubble(playerName, text) {
    if (!text) return;

    // Find player slot by checking name tags
    let slotIndex = -1;

    for (let i = 0; i < 6; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if (slot) {
            const nameTag = slot.querySelector('.bg-slate-800\\/90');
            if (nameTag) {
                const currentName = nameTag.textContent;
                // Handle "YOU" case or direct match
                if (currentName === playerName || (playerName === 'You' && currentName === 'YOU')) {
                    slotIndex = i;
                    break;
                }
            }
        }
    }

    if (slotIndex !== -1) {
        const bubble = document.getElementById(`bubble-${slotIndex}`);
        if (bubble) {
            bubble.textContent = text;
            bubble.classList.add('visible');
            setTimeout(() => { bubble.classList.remove('visible'); }, 5000);
        }
    }
}

function showOnomatopoeia(text, type = 'neutral') {
    const fxLayer = document.getElementById('fxLayer');
    if (!fxLayer) return;

    const fx = document.createElement('div');
    fx.className = 'fx-text fx-animate';
    fx.textContent = text;

    if (type === 'success') {
        fx.style.color = '#34d399';
        fx.style.textShadow = '3px 3px 0 #064e3b';
    }
    else if (type === 'fail') {
        fx.style.color = '#f87171';
        fx.style.textShadow = '3px 3px 0 #7f1d1d';
    }

    fxLayer.appendChild(fx);
    setTimeout(() => { fx.remove(); }, 1500);
}
