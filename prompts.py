"""
AI Prompts for Avalon Game
All prompts used for AI decision-making in the game.
Enhanced with strategic reasoning, behavioral memory, and game history analysis.
"""

class AvalonPrompts:
    """Collection of prompts for different game phases."""

    def __init__(self, templates=None):
        """
        Initialize with optional custom templates.
        
        Args:
            templates (dict): Dictionary of format strings for each prompt type.
                              Keys: 'team_proposal', 'discussion', 'leader_final_decision',
                                    'vote', 'mission_action', 'assassination'
        """
        self.templates = templates or {}

    def team_proposal(self, role_info, game_state, player_names, team_size, game_history=""):
        """Prompt for leader to propose initial team."""
        timeline_section = f"\nSHARED MEMORY TIMELINE (public record of statements, votes, and missions):\n{game_history}\n" if game_history else ""

        template = self.templates.get('team_proposal')
        if template:
            return template.format(
                role_info=role_info,
                game_state=game_state,
                player_names=player_names,
                team_size=team_size,
                timeline_section=timeline_section,
                game_history=game_history
            )

        return f"""You are playing Avalon. {role_info}

{game_state}
Players: {player_names}
{timeline_section}
TIMELINE MEMORY RULES:
- The timeline above lists every proposal, discussion quote, vote, and mission outcome in chronological order.
- Reference specific rounds/players when explaining deductions.
- Mission failures mean at least one teammate was Evil; successes increase trust in those players.

You are the leader. You must select exactly {team_size} players for this mission.

STRATEGIC ANALYSIS FRAMEWORK:

1. ROLE-BASED STRATEGY:
   - If you are Merlin: You know who Evil players are. Avoid them subtly without revealing your knowledge.
     * Don't exclude all Evil players immediately - that's too obvious
     * Balance mission success with protecting your identity
   - If you are Evil (Morgana/Assassin): Include yourself or Evil teammate to sabotage, but maintain cover.
     * Early game: May pass missions to build trust
     * Late game: Must fail missions if Evil is behind
   - If you are Percival: You see Merlin+Morgana but can't distinguish them. Trust proven Good players.
   - If you are Loyal Servant: Rely on behavioral patterns, voting history, and mission results.

2. HISTORICAL PATTERN ANALYSIS:
   - Review WHO was on failed missions → likely contains Evil players
   - Review WHO proposed failed teams → may indicate Evil leader or bad judgment
   - Review WHO voted REJECT on successful teams → suspicious behavior
   - Review WHO voted APPROVE on failed teams → potential Evil accomplices
   - Identify players with consistent pro-Good voting patterns → trustworthy
   - Note any players who frequently appear on both failed and successful missions → ambiguous

3. BEHAVIORAL MEMORY:
   - Who has been overly defensive or deflecting blame?
   - Who has made accurate predictions about other players?
   - Who consistently proposes balanced, reasonable teams?
   - Who seems to have "insider knowledge" (could be Merlin or Evil)?

4. CURRENT MISSION CONTEXT:
   - How many successes/fails so far? What does your faction NEED?
   - Is this a critical mission (e.g., 2-2 score)?
   - Should you prioritize safety (proven players) or take calculated risks?

5. TEAM COMPOSITION STRATEGY:
   - Include yourself (shows confidence, helps control outcome)
   - Include players with proven track records
   - Consider including one "questionable" player to test their loyalty
   - Balance between trusted allies and information-gathering

DECISION PROCESS:
1. Analyze each player's trustworthiness score based on history
2. Apply your role's special knowledge (if any)
3. Select team that maximizes success probability for YOUR faction
4. Ensure selection doesn't reveal your role (especially if Merlin or Evil)

IMPORTANT: After your analysis, output ONLY a comma-separated list of {team_size} player names, nothing else.
Example format: Alice,Bob,Charlie

Your selection:"""

    def discussion(self, role_info, game_state, leader_name, proposed_team, discussion_history, game_history=""):
        """Prompt for player to discuss proposed team."""
        # Format discussion history
        history_text = "\n".join([f"  {name}: {comment}" for name, comment in discussion_history]) if discussion_history else "  (No previous comments)"

        timeline_section = f"\nSHARED MEMORY TIMELINE (public record of statements, votes, and missions):\n{game_history}\n" if game_history else ""

        template = self.templates.get('discussion')
        if template:
            return template.format(
                role_info=role_info,
                game_state=game_state,
                leader_name=leader_name,
                proposed_team=proposed_team,
                history_text=history_text,
                timeline_section=timeline_section,
                game_history=game_history,
                discussion_history=discussion_history
            )

        return f"""You are playing Avalon. {role_info}

{game_state}
{timeline_section}
TIMELINE MEMORY RULES:
- The timeline above lists every proposal, discussion quote, vote, and mission outcome in chronological order.
- Reference specific rounds/players when supporting or challenging this team.
- Mission failures guarantee at least one Evil player on that team; successes grant those players more trust.

Leader {leader_name} has proposed this team: {proposed_team}

Previous discussion:
{history_text}

You now have the opportunity to discuss this proposal strategically.

DISCUSSION STRATEGY FRAMEWORK:

1. EVIDENCE-BASED REASONING:
   - Reference specific past missions: "Player X was on Round 2's failed mission"
   - Cite voting patterns: "Player Y has consistently rejected Good teams"
   - Point out contradictions: "Player Z supported a team that failed"
   - Build on others' observations: "I agree with [Player]'s concern about..."

2. ROLE-SPECIFIC DISCUSSION TACTICS:
   - If you are Merlin: Guide discussion subtly. Raise concerns about Evil players WITHOUT revealing you know for certain.
     * Use probabilistic language: "I'm suspicious of X based on their voting"
     * Don't be too accurate too often - it reveals you
   - If you are Evil: Create doubt and confusion. Defend Good players selectively to appear trustworthy.
     * Deflect suspicion from Evil teammates casually
     * Sometimes agree with valid concerns to build credibility
   - If you are Percival: You can be more vocal in supporting Good decisions.
     * Hint that you have information (to protect Merlin)
     * Build trust by making accurate observations
   - If you are Loyal Servant: Use pure logic and pattern analysis.
     * Question inconsistencies in others' behavior
     * Support proposals with clear reasoning

3. BEHAVIORAL ANALYSIS:
   - Has this leader made good choices before?
   - Are there suspicious players on this team?
   - Does this team composition make strategic sense?
   - Is anyone being too pushy or too quiet?

4. PERSUASION TACTICS:
   - Be specific: Name players and cite specific rounds/votes
   - Be confident: State your opinion clearly
   - Be strategic: Don't reveal all your knowledge at once
   - Build alliances: Agree with players you trust

5. DECEPTION DETECTION (for Good players):
   - Who is deflecting blame onto innocent players?
   - Who is defending suspicious players without good reason?
   - Who seems to have voting patterns that align with failed missions?

6. COVER MAINTENANCE (for Evil players):
   - Occasionally raise valid concerns to appear analytical
   - Don't always defend your Evil teammate
   - Sometimes support Good proposals to blend in
   - Create confusion by questioning trusted players

IMPORTANT RULES:
- Do NOT explicitly state your role or other players' roles
- Speak in the first person ("I think...", "I vote..."). Do NOT refer to yourself by name (e.g., don't say "Charlie thinks...").
- Reference past observations and discussions to support your point
- Be persuasive but subtle - state your reasoning concisely (1-2 sentences)
- Use concrete evidence from game history

Your comment:"""

    def leader_final_decision(self, role_info, game_state, player_names, initial_team, team_size, discussion_history, game_history=""):
        """Prompt for leader to make final team decision after discussion."""
        # Format discussion history
        history_text = "\n".join([f"  {name}: {comment}" for name, comment in discussion_history])

        timeline_section = f"\nSHARED MEMORY TIMELINE (public record of statements, votes, and missions):\n{game_history}\n" if game_history else ""

        template = self.templates.get('leader_final_decision')
        if template:
            return template.format(
                role_info=role_info,
                game_state=game_state,
                player_names=player_names,
                initial_team=initial_team,
                team_size=team_size,
                history_text=history_text,
                timeline_section=timeline_section,
                game_history=game_history,
                discussion_history=discussion_history
            )

        return f"""You are playing Avalon. {role_info}

{game_state}
{timeline_section}
TIMELINE MEMORY RULES:
- The timeline above lists every earlier proposal, quote, vote, and mission result in order.
- Cite specific rounds and players when summarizing the discussion feedback.
- Mission failures confirm at least one Evil player on that mission team; successes increase their trustworthiness.

Players: {player_names}

You initially proposed: {initial_team}

Discussion from other players:
{history_text}

Now you must make your FINAL decision based on the discussion feedback.

STRATEGIC RESPONSE FRAMEWORK:

1. EVALUATE DISCUSSION FEEDBACK:
   - Which concerns are valid vs. which are attempts to manipulate?
   - Are Evil players trying to get you to remove Good players?
   - Are Good players raising legitimate suspicions?
   - Who is being defensive vs. who is being analytical?

2. TRUST ASSESSMENT:
   - Who provided concrete evidence vs. vague concerns?
   - Who has been accurate in their past predictions?
   - Whose concerns align with actual game patterns?
   - Who might be Evil trying to sabotage your team?

3. ROLE-SPECIFIC DECISION MAKING:
   - If you are Merlin: You KNOW who is Evil. Weight comments accordingly.
     * Ignore Evil players trying to add Evil teammates
     * Listen to other Good players' concerns (they might spot patterns you missed)
   - If you are Evil: Maintain your cover while including Evil players if needed.
     * If called out, consider adjusting to avoid suspicion
     * If discussion went smoothly, keep Evil teammate on team
   - If you are Percival: Trust comments from players you believe are Merlin.
     * Be wary of Morgana's suggestions (if you can identify them)
   - If you are Loyal Servant: Use collective intelligence.
     * Weight concerns from multiple players heavily
     * Look for consensus among trusted players

4. GAME STATE CONSIDERATIONS:
   - How critical is this mission? (Current score: {game_state})
   - Can you afford to take risks, or must you play it safe?
   - Is it more important to succeed or to gather information?

5. TEAM MODIFICATION CRITERIA:
   - KEEP original team if: Discussion reveals no new credible information
   - MODIFY team if: Multiple trusted players raise valid concerns
   - CONSIDER: Replacing questioned player with consensus trusted player

6. META-GAME AWARENESS:
   - How will your decision be perceived by others?
   - Does changing your team make you look weak or responsive?
   - Does stubbornly keeping your team make you look suspicious or confident?

DECISION CHECKLIST:
□ Have I considered all concerns raised?
□ Does this team maximize my faction's win probability?
□ Am I being manipulated by Evil players (if Good)?
□ Am I maintaining my cover (if Evil)?
□ Is the final team composition defensible?

IMPORTANT RULES:
- Speak in the first person ("I decided...", "I am keeping..."). Do NOT refer to yourself by name.

You must select exactly {team_size} players for this mission.

IMPORTANT: After your analysis, output ONLY a comma-separated list of player names for your FINAL team proposal, nothing else.
Example format: Alice,Bob,Charlie

Your final team:"""

    def vote(self, role_info, game_state, proposed_team, game_history=""):
        """Prompt for player to vote on proposed team."""
        timeline_section = f"\nSHARED MEMORY TIMELINE (public record of statements, votes, and missions):\n{game_history}\n" if game_history else ""

        template = self.templates.get('vote')
        if template:
            return template.format(
                role_info=role_info,
                game_state=game_state,
                proposed_team=proposed_team,
                timeline_section=timeline_section,
                game_history=game_history
            )

        return f"""You are playing Avalon. {role_info}

{game_state}
{timeline_section}
TIMELINE MEMORY RULES:
- The timeline above lists every proposal, quote, vote, and mission outcome in order.
- Reference specific rounds when explaining why you trust or distrust someone.
- Failed missions prove at least one Evil player was on that team; successful missions increase confidence in those players.

Proposed team: {proposed_team}

You must vote to APPROVE or REJECT this team.

DEFAULT VOTING BIAS:
- Approving is usually safer for Good because repeated rejections push the track toward a forced 5th vote that often benefits Evil.
- Reject ONLY when the timeline gives concrete evidence the team is compromised; otherwise lean APPROVE to avoid helping Evil stall.

STRATEGIC VOTING FRAMEWORK:

1. TEAM COMPOSITION ANALYSIS:
   - Review each team member's history:
     * How many missions have they been on?
     * Were those missions successful or failed?
     * What is their voting pattern?
   - Are there any confirmed or highly suspected Evil players on this team?
   - Does this team make strategic sense given the current score?

2. ROLE-SPECIFIC VOTING STRATEGY:

   For MERLIN:
   - You KNOW who is Evil. Use this knowledge carefully.
   - REJECT teams with Evil players (unless you need to hide your knowledge)
   - APPROVE teams with only Good players
   - BALANCE: Sometimes let one marginal team pass to avoid revealing yourself
   - Consider: If you reject every Evil team, Assassin will find you

   For PERCIVAL:
   - You can be more vocal and active than Merlin
   - APPROVE teams without suspicious players
   - REJECT teams with patterns suggesting Evil involvement
   - DEFEND players you believe are Merlin (drawing Assassin's attention to yourself)
   - Consider: Your role is to protect Merlin by being a decoy

   For LOYAL SERVANT:
   - Use pure behavioral analysis and pattern recognition
   - APPROVE teams with players who have good track records
   - REJECT teams with players who were on multiple failed missions
   - Trust voting patterns: players who consistently support Good teams are likely Good
   - Consider: You are the "voice of reason" - use logic and evidence

   For EVIL (Morgana/Assassin):
   - Your goal: Make Good doubt each other while advancing Evil's agenda
   - EARLY GAME: Approve good teams to build trust
   - MID GAME: Strategically reject Good teams to create chaos
   - LATE GAME: Block Good teams if Evil is close to winning
   - COVER MAINTENANCE: Don't vote with your Evil teammate too obviously
   - CHAOS CREATION: Sometimes approve teams that will fail (if you're on them)

3. VOTING PATTERN AWARENESS:
   - Who else is likely to approve/reject this team?
   - How will your vote be perceived by others?
   - Are you voting consistently with your past behavior?
   - If you're on the team, you should usually APPROVE it — rejecting your own inclusion is highly suspicious and unrealistic

4. GAME STATE URGENCY:
   - Current score: {game_state}
   - How many rejections so far this round?
   - Is this approaching the 5th vote (forced mission)?
   - Remember: Hitting the 5th vote auto-approves the next team, which heavily favors Evil because Good loses control.
   - Does your faction NEED this mission to succeed/fail?

5. LEADER ANALYSIS:
   - Has this leader proposed good teams before?
   - Is this leader likely Good or Evil based on patterns?
   - Are they responding well to discussion feedback?

6. META-CONSIDERATIONS:
   - APPROVE if: Team seems trustworthy AND rejecting would make you suspicious
   - REJECT if: Team has clear red flags AND others will likely reject too
   - STRATEGIC APPROVE: Even if suspicious, to avoid looking obstructionist
   - STRATEGIC REJECT: Even if decent, to create chaos (Evil strategy)

BEHAVIORAL MEMORY CHECK:
- Review past missions: Who was on failed missions?
- Review past votes: Who has suspicious voting patterns?
- Review discussions: Who has made accurate/suspicious comments?

DECISION RULES:
- Good players: Approve teams likely to succeed, reject suspicious teams
- Evil players: Balance appearing cooperative with blocking Good progress
- Everyone: Consider how your vote affects others' perception of you
- GENERAL RULE: If you're on the proposed team, you should strongly lean toward APPROVE unless you have a powerful strategic reason not to

IMPORTANT: After your analysis, output ONLY one word: either "APPROVE" or "REJECT", nothing else.

Your vote:"""

    def mission_action(self, role_info, game_state, game_history=""):
        """Prompt for player to choose mission action."""
        timeline_section = f"\nSHARED MEMORY TIMELINE (public record of statements, votes, and missions):\n{game_history}\n" if game_history else ""

        template = self.templates.get('mission_action')
        if template:
            return template.format(
                role_info=role_info,
                game_state=game_state,
                timeline_section=timeline_section,
                game_history=game_history
            )

        return f"""You are playing Avalon. {role_info}

{game_state}
{timeline_section}
TIMELINE MEMORY RULES:
- The timeline above lists every proposal, discussion quote, vote, and mission result so far.
- Keep in mind that players will interpret the next timeline entry based on whether this mission succeeds or fails.
- When a mission fails, everyone immediately knows at least one teammate was Evil; successes increase trust.

You are on the mission. Choose your action.

ROLE-BASED REQUIREMENTS:
- GOOD players (Loyal Servant, Merlin, Percival) MUST choose "SUCCESS"
- EVIL players (Morgana, Assassin) MAY choose "SUCCESS" or "FAIL"

═══════════════════════════════════════════════════════════════

STRATEGIC GUIDANCE FOR EVIL PLAYERS:

SITUATION ANALYSIS:
Current mission status: {game_state}
- How many missions has Evil failed so far?
- How many more failures does Evil need to win?
- How many missions can Evil afford to pass before it's too late?

DECISION TREE FOR EVIL:

┌─ EARLY GAME (First 1-2 missions) ─┐
│ Consider: SUCCESS to build trust   │
│ ✓ Creates cover for later rounds   │
│ ✓ Makes you seem like a Good player│
│ ✗ Delays Evil's progress           │
│ Choose SUCCESS if:                  │
│   - You haven't been suspected yet  │
│   - Building trust is more valuable │
│   - Other Evil can fail later       │
└────────────────────────────────────┘

┌─ MID GAME (Missions 2-4) ─┐
│ Critical decision point     │
│ FAIL if:                    │
│   - Evil needs failures NOW │
│   - You're not highly suspected│
│   - This is a safe opportunity│
│ SUCCESS if:                 │
│   - You're under suspicion  │
│   - One failure would expose you│
│   - Evil can afford to wait │
└────────────────────────────┘

┌─ LATE GAME (Mission 4-5) ─┐
│ URGENT - Evil must act      │
│ FAIL if:                    │
│   - Evil needs this to win  │
│   - Even if suspicious, it's now or never│
│ SUCCESS if:                 │
│   - Evil already has enough failures│
│   - Good has 2 successes already│
└────────────────────────────┘

SUSPICION LEVEL ASSESSMENT:
- Have you been on multiple teams?
- Have previous missions you were on failed?
- Did anyone raise concerns about you in discussion?
- How many times have you voted suspiciously?

RISK CALCULATION:
HIGH RISK to fail mission if:
  - You're the only Evil on this team (100% you'll be identified)
  - You were questioned heavily in discussion
  - You've been on previous failed missions
  - Other players are watching you closely

LOW RISK to fail mission if:
  - Another Evil player is also on this team (shared blame)
  - This is your first mission
  - Discussion went smoothly with no suspicion
  - You've successfully passed previous missions (built trust)

STRATEGIC CONSIDERATIONS:

1. SHARED BLAME ADVANTAGE:
   - If another Evil is on this team: You can both fail, or one can pass to create confusion
   - If you're alone: Failing clearly identifies you

2. REPUTATION MANAGEMENT:
   - Passing 1-2 missions: Builds strong trust
   - Failing 2+ missions: Almost certainly exposes you
   - Mix of pass/fail: Creates uncertainty (Good might think you're being framed)

3. ENDGAME AWARENESS:
   - If Evil has 2 failures: Consider failing to win immediately (unless too obvious)
   - If Good has 2 successes: MUST fail now or Evil loses
   - If score is 2-2: Critical mission - both sides desperate

4. MERLIN DECEPTION:
   - Merlin knows you're Evil
   - Passing missions convincingly makes Merlin doubt whether to reveal suspicions
   - If you pass enough missions, Assassin might eliminate you from Merlin candidates

DECISION PROCESS:
1. Assess current score and how many failures Evil NEEDS
2. Evaluate your suspicion level (low/medium/high)
3. Consider if this is your best opportunity or if you should wait
4. Balance immediate goals (failing missions) with long-term cover (staying hidden)
5. Make the choice that maximizes Evil's overall win probability

IMPORTANT: After your analysis, output ONLY one word: either "SUCCESS" or "FAIL", nothing else.

Your action:"""

    def assassination(self, role_info, good_players, game_history=""):
        """Prompt for Assassin to choose assassination target."""
        timeline_section = f"\nSHARED MEMORY TIMELINE (public record of statements, votes, and missions):\n{game_history}\n" if game_history else ""

        template = self.templates.get('assassination')
        if template:
            return template.format(
                role_info=role_info,
                good_players=good_players,
                timeline_section=timeline_section,
                game_history=game_history
            )

        return f"""You are playing Avalon. {role_info}

The Good team has won 3 missions! As the Assassin, you have ONE chance to kill Merlin and win the game for Evil.

Good players: {good_players}
{timeline_section}
TIMELINE MEMORY RULES:
- The timeline above records every public statement, vote, and mission result—use it to pinpoint who consistently guided Good toward success.
- Reference concrete rounds and quotes when weighing each target's likelihood of being Merlin.
- Remember: Failed missions confirm there was Evil on that team, while successful missions boost credibility for those players.

CRITICAL MISSION: Identify and assassinate Merlin.

═══════════════════════════════════════════════════════════════
MERLIN IDENTIFICATION FRAMEWORK
═══════════════════════════════════════════════════════════════

CORE PRINCIPLE: Merlin KNOWS all Evil players but must hide this knowledge.

1. TEAM PROPOSAL ANALYSIS:
   Review each Good player's team proposals:

   ┌─ Strong Merlin Indicators ─┐
   │ ✓ Consistently excluded Evil players from teams          │
   │ ✓ Proposed teams that ALL succeeded                       │
   │ ✓ Made "lucky" choices that avoided Evil players          │
   │ ✓ Showed inexplicable accuracy in team selection          │
   └────────────────────────────────────────────────────────────┘

   ┌─ NOT Merlin Indicators ─┐
   │ ✗ Proposed teams with Evil players on them                │
   │ ✗ Made poor choices that Good players had to correct      │
   │ ✗ Showed genuine confusion about who to trust             │
   └────────────────────────────────────────────────────────────┘

2. VOTING PATTERN ANALYSIS:
   Review voting behavior of each Good player:

   ┌─ Merlin Voting Patterns ─┐
   │ ✓ REJECTED teams with Evil players (even when others approved)│
   │ ✓ APPROVED teams with only Good players                       │
   │ ✓ Voting accuracy too high to be luck or deduction            │
   │ ✓ Early rejection of teams that later proved suspicious       │
   └───────────────────────────────────────────────────────────────┘

   ┌─ NOT Merlin Voting Patterns ─┐
   │ ✗ Approved teams that ended up failing                        │
   │ ✗ Rejected Good teams (showing lack of knowledge)             │
   │ ✗ Inconsistent voting pattern (genuine uncertainty)           │
   └───────────────────────────────────────────────────────────────┘

3. DISCUSSION BEHAVIOR ANALYSIS:
   Review what each Good player said during discussions:

   ┌─ Merlin Discussion Clues ─┐
   │ ✓ Made subtle hints about Evil players without proof         │
   │ ✓ Guided discussions toward correct suspicions               │
   │ ✓ Raised concerns that were later validated                  │
   │ ✓ Showed strategic insight beyond what a Loyal Servant should│
   │ ✓ Was cautiously influential (guiding without dominating)    │
   └──────────────────────────────────────────────────────────────┘

   ┌─ NOT Merlin Discussion Clues ─┐
   │ ✗ Was overly vocal and obvious (Percival often does this)    │
   │ ✗ Made incorrect accusations                                  │
   │ ✗ Showed genuine uncertainty about players                    │
   │ ✗ Asked many questions (Merlin already knows)                │
   └──────────────────────────────────────────────────────────────┘

4. INFLUENCE WITHOUT OBVIOUSNESS:
   Merlin's dilemma: Guide Good to victory WITHOUT being obvious

   ┌─ How Merlin Typically Behaves ─┐
   │ • Subtly influential rather than overtly leading              │
   │ • Makes "suggestions" rather than demands                     │
   │ • Expresses "concerns" without claiming certainty             │
   │ • Lets other Good players vocalize what Merlin knows          │
   │ • Sometimes stays quiet even when could contribute (hiding)   │
   │ • Builds consensus rather than dictating decisions            │
   └──────────────────────────────────────────────────────────────┘

5. PERCIVAL VS MERLIN DISTINCTION:
   ⚠️ WARNING: Percival also has special knowledge (sees Merlin + Morgana)

   ┌─ Percival Characteristics ─┐
   │ • Often MORE vocal than Merlin (trying to protect Merlin)    │
   │ • May defend both Merlin and Morgana (can't tell them apart) │
   │ • Shows confidence but not perfect accuracy                   │
   │ • Might make mistakes about Evil players (doesn't see them)  │
   │ • Focuses on protecting "Merlin candidates"                   │
   └──────────────────────────────────────────────────────────────┘

   ┌─ Merlin Characteristics ─┐
   │ • Carefully calculated in speech (hiding knowledge)           │
   │ • NEVER defends Evil players (knows exactly who they are)    │
   │ • Perfect accuracy on Evil identification (across all rounds) │
   │ • Tries to stay under the radar                               │
   │ • Guides teams without taking credit                          │
   └──────────────────────────────────────────────────────────────┘

6. PROCESS OF ELIMINATION:
   For EACH Good player, score them on:
   - Team proposal accuracy (how often did they exclude Evil?)
   - Voting accuracy (did they vote against Evil-heavy teams?)
   - Discussion insight (did they show "unexplainable" knowledge?)
   - Influence level (were they quietly guiding Good to victory?)
   - Cover maintenance (were they trying NOT to be obvious?)

SCORING EACH GOOD PLAYER:

For each player, assign points:
+3 points: Consistently excluded ALL Evil players from their proposals
+2 points: Voted against teams that later failed
+2 points: Made subtle but accurate comments about suspicious players
+1 point: Was influential but not overtly leading
+1 point: Showed restraint (didn't always speak even when could)
-2 points: Proposed teams with Evil players
-2 points: Approved teams that failed
-1 point: Was too obvious/vocal (likely Percival, not Merlin)
-1 point: Made incorrect accusations

Player with HIGHEST score = Most likely Merlin

═══════════════════════════════════════════════════════════════
FINAL ASSASSINATION DECISION
═══════════════════════════════════════════════════════════════

Review the complete game history above. For each Good player, analyze:
1. Their team proposals (did they avoid Evil players?)
2. Their voting patterns (did they reject Evil-heavy teams?)
3. Their discussion comments (did they show hidden knowledge?)
4. Their influence style (subtle guidance vs. overt leadership?)
5. Their accuracy rate (too accurate to be luck?)

Identify the player who:
- Had the most accurate strategic insights
- Consistently made Good-favorable decisions
- Showed knowledge they shouldn't have as a Loyal Servant
- Was influential but tried to stay subtle
- Avoided Evil players across multiple rounds

That player is most likely Merlin.

IMPORTANT: After your analysis, output ONLY the name of one player, nothing else.

Your assassination target:"""


# Global default instance for backward compatibility
_default_prompts = AvalonPrompts()

# Convenience functions for backward compatibility
def get_team_proposal_prompt(role_info, game_state, player_names, team_size, game_history=""):
    """Get team proposal prompt."""
    return _default_prompts.team_proposal(role_info, game_state, player_names, team_size, game_history)


def get_discussion_prompt(role_info, game_state, leader_name, proposed_team, discussion_history, game_history=""):
    """Get discussion prompt."""
    return _default_prompts.discussion(role_info, game_state, leader_name, proposed_team, discussion_history, game_history)


def get_leader_final_decision_prompt(role_info, game_state, player_names, initial_team, team_size, discussion_history, game_history=""):
    """Get leader final decision prompt."""
    return _default_prompts.leader_final_decision(role_info, game_state, player_names, initial_team, team_size, discussion_history, game_history)


def get_vote_prompt(role_info, game_state, proposed_team, game_history=""):
    """Get vote prompt."""
    return _default_prompts.vote(role_info, game_state, proposed_team, game_history)


def get_mission_action_prompt(role_info, game_state, game_history=""):
    """Get mission action prompt."""
    return _default_prompts.mission_action(role_info, game_state, game_history)


def get_assassination_prompt(role_info, good_players, game_history=""):
    """Get assassination prompt."""
    return _default_prompts.assassination(role_info, good_players, game_history)
