// Avalon AI Game - Log Viewer JavaScript

let currentGameId = null;
let gameData = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadGamesList();

    // Check if a specific game ID is in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('game');
    if (gameId) {
        currentGameId = gameId;
    }
});

// Load list of available games
async function loadGamesList() {
    try {
        const response = await fetch('/api/logs');
        const data = await response.json();

        const select = document.getElementById('gameSelect');

        if (data.logs.length === 0) {
            select.innerHTML = '<option value="">No games available</option>';
            return;
        }

        select.innerHTML = '<option value="">Select a game...</option>';

        data.logs.forEach(game => {
            const option = document.createElement('option');
            option.value = game.game_id;
            option.textContent = `${game.game_id} - ${game.winner} (${formatTimestamp(game.timestamp)})`;
            select.appendChild(option);
        });

        // If we have a game ID from URL, select it
        if (currentGameId) {
            select.value = currentGameId;
            loadGame();
        }

    } catch (error) {
        console.error('Failed to load games list:', error);
    }
}

// Load and display a specific game
async function loadGame() {
    const select = document.getElementById('gameSelect');
    const gameId = select.value;

    if (!gameId) {
        hideAllSections();
        return;
    }

    currentGameId = gameId;

    // Update URL without reloading page
    const url = new URL(window.location);
    url.searchParams.set('game', gameId);
    window.history.pushState({}, '', url);

    try {
        const response = await fetch(`/api/log/${gameId}`);
        gameData = await response.json();

        displayGameOverview();
        displayPlayers();
        displayRounds();
        displayAssassination();

        // Show download section
        document.getElementById('downloadSection').style.display = 'block';

    } catch (error) {
        console.error('Failed to load game:', error);
        alert('Failed to load game log');
    }
}

// Display game overview
function displayGameOverview() {
    const section = document.getElementById('gameOverview');
    section.style.display = 'block';

    document.getElementById('gameId').textContent = gameData.game_id;
    document.getElementById('gameTimestamp').textContent = formatTimestamp(gameData.timestamp);

    const winner = gameData.final_result.winner;
    const winnerSpan = document.getElementById('gameWinner');
    winnerSpan.textContent = winner;
    winnerSpan.className = `winner-badge ${winner.toLowerCase()}`;

    const results = gameData.final_result.mission_results;
    const resultsHTML = results.map(result =>
        `<span class="result-badge ${result.toLowerCase()}">${result}</span>`
    ).join(' ');
    document.getElementById('missionResults').innerHTML = resultsHTML;
}

// Display players
function displayPlayers() {
    const section = document.getElementById('playersSection');
    section.style.display = 'block';

    const playersList = document.getElementById('playersList');
    playersList.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75rem;">
            ${gameData.players.map(player => `
                <div style="padding: 0.75rem; background-color: #f8fafc; border-radius: 6px; border-left: 3px solid ${player.faction === 'Good' ? '#10b981' : '#ef4444'};">
                    <div style="font-weight: 600; color: var(--text-primary);">
                        ${player.name} - ${player.role}
                        <span style="color: ${player.faction === 'Good' ? '#10b981' : '#ef4444'};">(${player.faction})</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        ${player.ai_type}: ${player.ai_config}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Display rounds
function displayRounds() {
    const section = document.getElementById('roundsSection');
    section.style.display = 'block';

    const roundsList = document.getElementById('roundsList');
    roundsList.innerHTML = gameData.rounds.map(round => {
        const lastProposal = round.proposals[round.proposals.length - 1];
        const missionResult = round.mission ? round.mission.success : false;

        return `
            <div class="round-card">
                <div class="round-header">
                    <span class="round-title">Round ${round.round_number}</span>
                    <span class="result-badge ${missionResult ? 'success' : 'fail'}">
                        ${missionResult ? 'SUCCESS' : 'FAIL'}
                    </span>
                </div>

                <p><strong>Team Size:</strong> ${round.team_size}</p>

                ${round.proposals.map((proposal, idx) => `
                    <div class="proposal">
                        <div class="proposal-header">
                            Proposal ${idx + 1} by ${proposal.leader}
                            ${proposal.forced_mission ? ' <span class="result-badge fail" style="display: inline-block; margin-left: 0.5rem;">FORCED MISSION</span>' : ''}
                        </div>

                        ${proposal.forced_mission ? `
                            <div style="margin-top: 0.75rem; padding: 0.75rem; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                                <strong>⚠️ 5th Vote - Forced Mission</strong>
                                <p style="margin: 0.5rem 0 0 0; color: #92400e;">After 4 rejections, this team proceeds without discussion or voting.</p>
                            </div>
                        ` : ''}

                        <div style="margin-top: 0.75rem;">
                            <strong>Initial Team Proposal:</strong>
                            <div class="team-list">
                                ${proposal.initial_team.map(name => `<span class="player-tag">${name}</span>`).join('')}
                            </div>
                        </div>

                        ${proposal.leader_reasoning ? `
                            <div class="reasoning-block">
                                <div class="reasoning-title">Leader's Initial Reasoning</div>
                                <div class="reasoning-body">${proposal.leader_reasoning}</div>
                            </div>
                        ` : ''}

                        ${!proposal.forced_mission && proposal.discussion && proposal.discussion.length > 0 ? `
                            <div style="margin-top: 0.75rem;">
                                <strong>Discussion Phase:</strong>
                                <div class="discussion-list">
                                    ${proposal.discussion.map(comment => `
                                        <div class="discussion-item">
                                            <div class="discussion-player">
                                                ${comment.player}
                                                ${comment.tag ? `<span class="discussion-tag">${comment.tag}</span>` : ''}
                                            </div>
                                            <div style="white-space: pre-wrap; word-wrap: break-word;">${comment.comment}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : (!proposal.forced_mission ? `
                            <div style="margin-top: 0.75rem;">
                                <p style="color: var(--text-secondary); font-style: italic;">No discussion in this proposal</p>
                            </div>
                        ` : '')}

                        ${proposal.leader_final_reasoning ? `
                            <div class="reasoning-block" style="margin-top: 0.75rem;">
                                <div class="reasoning-title">Leader's Final Decision Notes</div>
                                <div class="reasoning-body">${proposal.leader_final_reasoning}</div>
                            </div>
                        ` : ''}

                        ${!proposal.forced_mission && proposal.votes && Object.keys(proposal.votes).length > 0 ? `
                            <div style="margin-top: 0.75rem;">
                                <strong>Votes:</strong>
                                <div class="vote-grid">
                                    ${Object.entries(proposal.votes).map(([player, vote]) => `
                                        <div class="vote-item ${vote ? 'approve' : 'reject'}">
                                            ${player}: ${vote ? 'APPROVE' : 'REJECT'}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <div style="margin-top: 0.75rem;">
                                <strong>Result:</strong>
                                <span class="result-badge ${proposal.approved ? 'success' : 'fail'}">
                                    ${proposal.approved ? 'APPROVED' : 'REJECTED'}
                                </span>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}

                ${round.mission ? `
                    <div class="proposal">
                        <div class="proposal-header">Mission Execution</div>

                        <div style="margin-top: 0.75rem;">
                            <strong>Team:</strong>
                            <div class="team-list">
                                ${(round.mission.team || round.mission_team || []).map(name => `<span class="player-tag">${name}</span>`).join('')}
                            </div>
                        </div>

                        <div style="margin-top: 0.75rem;">
                            <strong>Actions:</strong>
                            <div class="vote-grid">
                                ${Object.entries(round.mission.actions).map(([player, action]) => `
                                    <div class="vote-item ${action ? 'approve' : 'reject'}">
                                        ${player}: ${action ? 'SUCCESS' : 'FAIL'}
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div style="margin-top: 0.75rem;">
                            <strong>Mission Result:</strong>
                            <span class="result-badge ${round.mission.success ? 'success' : 'fail'}">
                                ${round.mission.success ? 'SUCCESS' : 'FAIL'}
                            </span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Display assassination phase
function displayAssassination() {
    if (!gameData.assassination) {
        document.getElementById('assassinationSection').style.display = 'none';
        return;
    }

    const section = document.getElementById('assassinationSection');
    section.style.display = 'block';

    const details = document.getElementById('assassinationDetails');
    const assassination = gameData.assassination;

    details.innerHTML = `
        <div class="proposal">
            <p><strong>Assassin:</strong> ${assassination.assassin}</p>
            <p><strong>Target:</strong> ${assassination.target}</p>
            <p><strong>Target was Merlin:</strong> ${assassination.target_was_merlin ? 'Yes' : 'No'}</p>
            <p style="margin-top: 1rem;">
                <strong>Result:</strong>
                <span class="result-badge ${assassination.result === 'GOOD WINS' ? 'success' : 'fail'}">
                    ${assassination.result}
                </span>
            </p>
        </div>
    `;
}

// Download log as JSON
function downloadLog() {
    if (!currentGameId) return;

    window.location.href = `/api/log/${currentGameId}/download`;
}

// Hide all game sections
function hideAllSections() {
    document.getElementById('gameOverview').style.display = 'none';
    document.getElementById('playersSection').style.display = 'none';
    document.getElementById('roundsSection').style.display = 'none';
    document.getElementById('assassinationSection').style.display = 'none';
    document.getElementById('downloadSection').style.display = 'none';
}

// Format timestamp for display
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
