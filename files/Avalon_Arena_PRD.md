# Avalon Arena 产品需求文档 (PRD)

## 1. 项目背景
AvalonRL 目前是一个基于 LLM 的阿瓦隆游戏框架，支持多种 AI 后端（Ollama, DeepSeek API, Local Transformers）。为了进一步提升框架的实用性和趣味性，我们需要构建一个 **Avalon Arena（阿瓦隆竞技场）**。

竞技场旨在提供一个标准化的评估环境，让用户可以定制自己的 Agent（选择基座模型、调整 Prompt），并与标准 Baseline Agent 进行对战，通过排行榜展示不同 Agent 的能力差异。

## 2. 产品目标
1.  **可定制性**：允许用户灵活配置 Agent 的基座模型和 Prompt 策略。
2.  **竞技性**：提供标准化的对战环境和量化的评分系统（排行榜）。
3.  **易用性**：提供图形化界面，支持一键本地测试和结果查看。
4.  **分析能力**：提供详细的对局日志和胜率分析，帮助用户优化 Agent。

## 3. 核心功能

### 3.1 竞技场配置 (Arena Configuration)
用户进入竞技场页面，可以配置自己的 "Hero Agent"。

*   **模型选择 (Base Model Selection)**:
    *   支持选择当前系统已集成的后端：
        *   Ollama (本地运行的模型，如 deepseek-r1, qwen2.5)
        *   DeepSeek API (deepseek-chat, deepseek-reasoner)
        *   Local Transformers (本地加载的 HuggingFace 模型)
    *   *未来扩展：支持更多 API (OpenAI, Anthropic)*

*   **Prompt 编辑 (Prompt Engineering)**:
    *   提供基于 `AvalonPrompts` 的默认模板。
    *   用户可以自定义各个阶段的 Prompt：
        *   **Team Proposal** (提议阶段)
        *   **Discussion** (讨论阶段)
        *   **Vote** (投票阶段)
        *   **Mission Action** (任务执行阶段)
        *   **Assassination** (刺杀阶段)
    *   支持保存/加载 Prompt 模板。

### 3.2 本地竞技场 (Local Arena)
用户配置好 Hero Agent 后，可以启动本地对战。

*   **对战模式**:
    *   **1 vs 5**: 用户配置的 Hero Agent 扮演其中一个角色（随机或指定），其余 5 个角色由系统默认的 Baseline Agent 填充。
    *   **Baseline Agent**: 系统预设的稳定 Agent（例如使用固定 Prompt 的 Qwen2.5 或 DeepSeek-V3）。
*   **对局设置**:
    *   **对局数量**: 可设置连续运行多少局（例如 10, 50, 100 局）以获取统计显著的结果。
    *   **并发控制**: 根据本地硬件资源设置并发数。
*   **实时进度**: 显示当前对局进度、胜负情况。

### 3.3 排行榜 (Leaderboard)
记录并展示 Agent 的表现。

*   **积分规则**:
    *   **胜率 (Win Rate)**: 总体胜率。
    *   **角色胜率**: 作为好人/坏人的分别胜率。
    *   **Elo 分数**: (可选) 如果支持不同用户 Agent 互殴，可引入 Elo 机制。初期仅支持 vs Baseline，可用胜率作为主要指标。
*   **榜单维度**:
    *   **Model Leaderboard**: 不同基座模型的平均表现。
    *   **Prompt Leaderboard**: 同一模型下不同 Prompt 策略的表现。

### 3.4 结果与分析 (Results & Analysis)
对局结束后提供详细报告。

*   **统计数据**:
    *   总场次、胜场、负场。
    *   作为 Merlin/Assassin/Percival 等不同角色的胜率。
    *   投票准确率（好人投好队，坏人投坏队）。
*   **对局回放**:
    *   支持查看任意一局的详细日志（复用现有的 Log Viewer）。
    *   高亮显示 Hero Agent 的决策过程（Reasoning）。

## 4. 用户流程 (User Flow)

1.  **进入竞技场**: 用户点击 Web UI 的 "Arena" 标签。
2.  **配置 Agent**:
    *   选择 Model: `DeepSeek-R1 (Ollama)`
    *   编辑 Prompt: 修改 "Discussion" 部分，增加更激进的发言策略。
    *   保存配置为 "MyAggressiveAgent"。
3.  **启动测试**:
    *   选择 "Play vs Baseline"。
    *   设置局数: 20 局。
    *   点击 "Start Battle"。
4.  **等待结果**: 界面显示进度条 "Running Game 5/20..."。
5.  **查看报告**:
    *   测试结束，显示胜率 60%。
    *   查看详细数据：作为坏人胜率 80%，作为好人胜率 40%。
    *   点击某一局失败的记录，复盘 Log，发现 Agent 在投票阶段过于保守。
6.  **迭代优化**: 回到配置页，调整 Vote Prompt，再次启动测试。

## 5. 技术方案 (Technical Architecture)

### 5.1 前端 (Web UI)
*   新增 `/arena` 路由和页面。
*   **编辑器**: 集成 Monaco Editor 或简单的 Textarea 用于编辑 Prompt。
*   **图表**: 使用 Chart.js 或 ECharts 展示胜率统计。

### 5.2 后端 (Flask API)
*   **Prompt 管理**:
    *   需要重构 `prompts.py`，使其支持实例化并接受模板字符串，而不是仅作为静态方法。
    *   新增 API `POST /api/arena/start` 接收自定义 Prompt 和配置。
*   **多局并发**:
    *   利用 Python 的 `multiprocessing` 或 `concurrent.futures` 并行运行多场游戏（需注意 Ollama/GPU 显存限制）。
*   **数据存储**:
    *   使用 Supabase 存储 Arena 的对局记录，字段需区分 `is_arena_match` 和 `agent_config_id`。

### 5.3 数据结构
*   **AgentConfig**:
    ```json
    {
      "id": "uuid",
      "name": "MyAgent",
      "base_model": "ollama/deepseek-r1",
      "prompts": {
        "discussion": "...",
        "vote": "..."
      }
    }
    ```
*   **ArenaMatch**:
    ```json
    {
      "id": "uuid",
      "agent_config_id": "uuid",
      "result": "win/loss",
      "role": "Merlin",
      "timestamp": "..."
    }
    ```

## 6. 开发计划 (Development Plan)

*   **Phase 1: 基础架构改造**
    *   重构 `prompts.py` 支持动态 Prompt。
    *   实现 Agent 配置的保存与读取。
*   **Phase 2: 竞技场核心逻辑**
    *   实现 "1 vs 5" 的对局启动逻辑。
    *   实现多局批量运行脚本。
*   **Phase 3: Web UI 实现**
    *   开发 Arena 配置页面。
    *   开发结果统计页面。
*   **Phase 4: 排行榜与持久化**
    *   接入 Supabase 记录 Arena 数据。
    *   实现排行榜展示。
