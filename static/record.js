// Record Page JavaScript

let currentUser = null;
let currentGameData = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    checkAuthStatus();
});

// ============== Authentication ==============

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (data.authenticated) {
            currentUser = data.user;
            updateUIForLoggedInUser(data.user);
            loadUserGames();
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

    // Show games container, hide login required
    document.getElementById('loginRequired').classList.add('hidden');
    document.getElementById('gamesContainer').classList.remove('hidden');

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

    // Show login required, hide games container
    document.getElementById('loginRequired').classList.remove('hidden');
    document.getElementById('gamesContainer').classList.add('hidden');

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
    const detailModal = document.getElementById('gameDetailModal');
    if (e.target === detailModal) {
        closeGameDetail();
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

// ============== Game Records ==============

async function loadUserGames() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const gamesList = document.getElementById('gamesList');

    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    gamesList.innerHTML = '';

    try {
        const response = await fetch('/api/user_games');
        const data = await response.json();

        loadingState.classList.add('hidden');

        if (!data.games || data.games.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        // Render games
        data.games.forEach(game => {
            const card = createGameCard(game);
            gamesList.appendChild(card);
        });

    } catch (error) {
        console.error('Failed to load games:', error);
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
    }
}

function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'glass-panel rounded-xl p-4 hover:bg-slate-800/50 transition-all cursor-pointer';
    card.onclick = () => openGameDetail(game.game_id);

    const winnerClass = game.winner === 'Good' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30';
    const roleClass = ['Merlin', 'Percival', 'Loyal Servant'].includes(game.user_role) ? 'text-blue-400' : 'text-red-400';

    card.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
                    <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                </div>
                <div>
                    <p class="text-white font-medium">${game.game_id}</p>
                    <p class="text-slate-400 text-sm">${formatTimestamp(game.timestamp)}</p>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <div class="text-right">
                    <p class="text-slate-400 text-xs uppercase tracking-wide">Your Role</p>
                    <p class="${roleClass} font-medium">${game.user_role || 'Unknown'}</p>
                </div>
                <div class="px-3 py-1.5 rounded-lg border ${winnerClass} font-bold text-sm">
                    ${game.winner} Wins
                </div>
                <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </div>
        </div>
    `;

    return card;
}

async function openGameDetail(gameId) {
    const modal = document.getElementById('gameDetailModal');
    modal.classList.remove('hidden');

    // Reset tabs
    showDetailTab('log');

    // Load game data
    try {
        const response = await fetch(`/api/log/${gameId}`);
        const data = await response.json();

        if (response.ok) {
            currentGameData = data;
            renderGameDetail(data);
        } else {
            document.getElementById('detailLog').innerHTML = '<p class="text-red-400">Failed to load game data</p>';
        }
    } catch (error) {
        console.error('Failed to load game detail:', error);
        document.getElementById('detailLog').innerHTML = '<p class="text-red-400">Failed to load game data</p>';
    }
}

function closeGameDetail() {
    document.getElementById('gameDetailModal').classList.add('hidden');
    currentGameData = null;
}

function showDetailTab(tab) {
    const tabLog = document.getElementById('tabLog');
    const tabReasoning = document.getElementById('tabReasoning');
    const contentLog = document.getElementById('tabContentLog');
    const contentReasoning = document.getElementById('tabContentReasoning');

    if (tab === 'log') {
        tabLog.className = 'px-4 py-2 text-sm font-medium text-indigo-400 border-b-2 border-indigo-500';
        tabReasoning.className = 'px-4 py-2 text-sm font-medium text-slate-400 hover:text-white border-b-2 border-transparent';
        contentLog.classList.remove('hidden');
        contentReasoning.classList.add('hidden');
    } else {
        tabLog.className = 'px-4 py-2 text-sm font-medium text-slate-400 hover:text-white border-b-2 border-transparent';
        tabReasoning.className = 'px-4 py-2 text-sm font-medium text-indigo-400 border-b-2 border-indigo-500';
        contentLog.classList.add('hidden');
        contentReasoning.classList.remove('hidden');
    }
}

function renderGameDetail(data) {
    // Update header
    document.getElementById('detailGameId').textContent = `Game: ${data.game_id}`;
    document.getElementById('detailGameTime').textContent = formatTimestamp(data.timestamp);

    // Update summary
    const winner = data.final_result?.winner || 'Unknown';
    document.getElementById('detailWinner').textContent = winner;
    document.getElementById('detailWinner').className = `text-lg font-bold ${winner === 'Good' ? 'text-emerald-400' : 'text-red-400'}`;

    // Find user's role (Alice)
    const players = data.players || [];
    const alice = players.find(p => p.name === 'Alice');
    document.getElementById('detailUserRole').textContent = alice?.role || 'Unknown';

    // Count missions
    const rounds = data.rounds || [];
    let goodMissions = 0;
    let evilMissions = 0;
    rounds.forEach(r => {
        if (r.mission_result === 'Success') goodMissions++;
        else if (r.mission_result === 'Fail') evilMissions++;
    });
    document.getElementById('detailMissions').textContent = `${goodMissions} - ${evilMissions}`;
    document.getElementById('detailRounds').textContent = rounds.length;

    // Render log
    renderDetailLog(data);

    // Render reasoning
    renderDetailReasoning(data);
}

function renderDetailLog(data) {
    const container = document.getElementById('detailLog');
    container.innerHTML = '';

    // Players
    const playersDiv = document.createElement('div');
    playersDiv.className = 'mb-4 p-3 bg-slate-800/50 rounded-lg';
    playersDiv.innerHTML = `
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Players</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            ${(data.players || []).map(p => {
        const roleClass = ['Merlin', 'Percival', 'Loyal Servant'].includes(p.role) ? 'text-blue-400' : 'text-red-400';
        return `<div class="text-sm"><span class="text-white">${p.name}</span>: <span class="${roleClass}">${p.role}</span></div>`;
    }).join('')}
        </div>
    `;
    container.appendChild(playersDiv);

    // Rounds
    (data.rounds || []).forEach((round, index) => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'mb-4 border-l-2 border-indigo-500/30 pl-4';

        // Find approved proposal (or last parsing attempt)
        const proposals = round.proposals || [];
        const approvedProposal = proposals.find(p => p.approved) || proposals[proposals.length - 1] || {};

        // Get Mission Data
        const mission = round.mission || {};
        const leader = approvedProposal.leader || 'Unknown';
        
        // Get team members - prioritize mission team, then fall back to proposal teams
        let team = [];
        if (mission.team && Array.isArray(mission.team) && mission.team.length > 0) {
            team = mission.team;
        } else if (round.mission_team && Array.isArray(round.mission_team) && round.mission_team.length > 0) {
            team = round.mission_team;
        } else if (approvedProposal.final_team && Array.isArray(approvedProposal.final_team) && approvedProposal.final_team.length > 0) {
            team = approvedProposal.final_team;
        } else if (approvedProposal.initial_team && Array.isArray(approvedProposal.initial_team) && approvedProposal.initial_team.length > 0) {
            team = approvedProposal.initial_team;
        }
        const votes = approvedProposal.votes || {};

        let resultStr = '';
        let resultClass = '';

        if (mission.success !== undefined) {
            resultStr = mission.success ? 'Success' : 'Fail';
            resultClass = mission.success ? 'text-emerald-400' : 'text-red-400';
        } else if (round.mission_result) {
            resultStr = round.mission_result;
            resultClass = resultStr === 'Success' ? 'text-emerald-400' : 'text-red-400';
        }

        roundDiv.innerHTML = `
            <p class="text-sm font-bold text-amber-400 mb-2">Round ${index + 1}</p>
            <div class="space-y-1 text-xs text-slate-300">
                <p>Leader: <span class="text-white">${leader}</span></p>
                <p>Team: <span class="text-white">${team.join(', ')}</span></p>
                ${Object.keys(votes).length > 0 ? `<p>Votes: ${Object.entries(votes).map(([p, v]) => `<span class="${v === true || v === 'APPROVE' ? 'text-emerald-400' : 'text-red-400'}">${p}</span>`).join(', ')}</p>` : ''}
                ${resultStr ? `<p>Result: <span class="${resultClass} font-bold">${resultStr}</span></p>` : ''}
            </div>
        `;
        container.appendChild(roundDiv);
    });

    // Final result
    if (data.final_result) {
        const finalDiv = document.createElement('div');
        finalDiv.className = 'p-3 bg-slate-800/50 rounded-lg';
        const winnerClass = data.final_result.winner === 'Good' ? 'text-emerald-400' : 'text-red-400';
        finalDiv.innerHTML = `
            <p class="text-sm font-bold ${winnerClass}">Game Over: ${data.final_result.winner} Wins!</p>
            ${data.final_result.assassination_target ? `<p class="text-xs text-slate-400 mt-1">Assassination target: ${data.final_result.assassination_target}</p>` : ''}
        `;
        container.appendChild(finalDiv);
    }
}

function renderDetailReasoning(data) {
    const container = document.getElementById('detailReasoning');
    container.innerHTML = '';

    let hasReasoning = false;

    // Helper to add reasoning entry
    const addEntry = (player, context, text) => {
        hasReasoning = true;
        const entry = document.createElement('div');
        entry.className = 'mb-4 bg-slate-800/30 border border-slate-700/50 rounded p-3';
        entry.innerHTML = `
            <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-bold text-indigo-400 uppercase tracking-wider">${player}</span>
                <span class="text-xs text-slate-500">${context}</span>
            </div>
            <div class="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">${text}</div>
        `;
        container.appendChild(entry);
    };

    // Extract reasoning from rounds -> proposals
    (data.rounds || []).forEach((round, roundIndex) => {
        const proposals = round.proposals || [];

        proposals.forEach((proposal, propIndex) => {
            // 1. Leader Initial Reasoning
            if (proposal.leader_reasoning) {
                addEntry(proposal.leader || 'Unknown', `Round ${roundIndex + 1} Proposal ${propIndex + 1} (Initial)`, proposal.leader_reasoning);
            }

            // 2. Discussion Reasoning (if any)
            if (proposal.discussion && Array.isArray(proposal.discussion)) {
                proposal.discussion.forEach(comment => {
                    if (comment.reasoning) {
                        addEntry(comment.player, `Round ${roundIndex + 1} Discussion`, comment.reasoning);
                    }
                });
            }

            // 3. Leader Final Reasoning
            if (proposal.leader_final_reasoning) {
                addEntry(proposal.leader || 'Unknown', `Round ${roundIndex + 1} Proposal ${propIndex + 1} (Final)`, proposal.leader_final_reasoning);
            }

            // 4. Vote Reasoning
            if (proposal.vote_reasoning) {
                Object.entries(proposal.vote_reasoning).forEach(([player, reasoning]) => {
                    if (reasoning) {
                        addEntry(player, `Round ${roundIndex + 1} Vote`, reasoning);
                    }
                });
            }
        });
    });

    if (!hasReasoning) {
        container.innerHTML = '<p class="text-slate-500 text-center italic py-8">No AI reasoning data available for this game</p>';
    }
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
