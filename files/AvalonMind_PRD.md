# 🧠 AvalonMind: Embodied Social Intelligence Demo (CHI 2026)

## 1. Project Overview

**AvalonMind** (formerly AvalonRL) is an interactive research platform designed to demonstrate **Theory of Mind (ToM)** in Large Language Models (LLMs) within the context of the social deduction game *The Resistance: Avalon*.

Unlike traditional game AI that focuses on winning via mathematical optimization, AvalonMind focuses on **human-like social reasoning**, **natural language negotiation**, and **transparent cognitive modeling**.

**Key Novelty for CHI:**
- **Suspicion Heatmap**: A real-time visualization of the AI's internal trust state (Who does it suspect? Why?).
- **Cognitive Dissonance**: The ability to see the difference between an AI's *private thought* (e.g., "I know he is Merlin") and *public action* (e.g., "I trust him").

---

## 2. Objectives & Scope

### 🎯 CHI Demo Goals
- **Visualize "The Mind of AI"**: Show spectators exactly what the LLM is thinking via the **Suspicion Heatmap**.
- **Interactive Experience**: Allow a human ("Alice") to play a full game alongside 5 AI agents (DeepSeek-R1).
- **Seamless "God View"**: Provide a spectator mode where all roles are revealed, allowing the audience to appreciate the AI's deception skills.

### 🚫 Out of Scope (for Demo)
- **Arena Mode**: Large-scale batch testing is disabled for the demo to focus on the single-game interactive experience.
- **Complex Stats**: Long-term win-rate tracking is secondary to the immediate "Wow" factor of the live gameplay.

---

## 3. Core Features

### 🧠 1. Structured AI Reasoning
The AI (DeepSeek-R1) does not just output text. It follows a strict cognitive architecture:
1.  **Perception**: Reads game history and dialogue.
2.  **Reflection (Private)**: Updates `suspicion_scores` (0-100) for every other player.
3.  **Action (Public)**: Generates a vote or chat message based on its Role and Suspicion.

### 🔥 2. Suspicion Heatmap (The "Wow" Factor)
- **Visual**: A dynamic grid of progress bars next to each player's avatar.
- **Logic**:
    - **Green**: High Trust (Low Suspicion).
    - **Red**: High Suspicion (Likely Evil).
- **Update Frequency**: Updates in real-time after every Discussion turn and Vote.

### 🗣️ 3. Discussion Phase
- Agents engage in multi-turn natural language debate *before* voting.
- They can accuse, defend, and lie.
- **CHI Feature**: The "Reasoning Log" displays the raw JSON thought process, proving the AI isn't just hallucinating but following a strategy.

---

## 4. Game Rules (6-Player Setup)

| Role | Count | Ability |
| :--- | :--- | :--- |
| **Merlin** (Good) | 1 | Knows all Evil players. Must remain hidden. |
| **Percival** (Good) | 1 | Sees Merlin & Morgana (unknown which is which). |
| **Servant** (Good) | 2 | Standard good player. |
| **Morgana** (Evil) | 1 | Appears as Merlin to Percival. |
| **Assassin** (Evil) | 1 | Kills Merlin at the end if Good wins 3 missions. |

**Flow**:
1.  **Proposal**: Leader picks a team.
2.  **Discussion**: Players debate (AI updates Heatmap).
3.  **Vote**: Approve/Reject.
4.  **Mission**: Success/Fail.
5.  **Endgame**: Assassin shot (if Good wins).

---

## 5. UI / UX Design (Demo Focused)

### 🎨 Visual Style
- **Theme**: Dark, futuristic, "Glassmorphism".
- **Palette**: Slate/Indigo background, Neon Green (Good), Neon Red (Evil).
- **Layout**:
    - **Left**: Game Controls & Status.
    - **Center**: Chat & Action Log.
    - **Right**: **Suspicion Heatmap** & AI Reasoning (The focus area).

### 🧭 Screen Flow
1.  **Landing Page**: Simple "Start Game" (Play as Alice) or "Watch Bot Battle" (God View).
2.  **Gameplay**:
    - **Human Turn**: "Action Required" card pulses.
    - **AI Turn**: "Thinking..." indicator with streaming token output.
3.  **Game Over**: Clear "Good Wins" / "Evil Wins" banner with full role reveal.

---

## 6. Technical Stack
- **Frontend**: HTML5, TailwindCSS, Vanilla JS (for lightweight speed).
- **Backend**: Python (Flask).
- **AI**: DeepSeek-R1 (via Ollama or API).
- **Data**: JSON logs (for replayability).

---

**Version**: 2.0 (CHI Demo)
**Project**: AvalonMind
**Date**: Jan 2026
