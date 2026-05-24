# 🤖 AI Knowledge Assistant - TypeScript 全栈版

基于 **TypeScript + Vercel AI SDK + React** 的个人知识库问答助手，支持 RAG 检索增强生成与 Agent 工具调用。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + Vite + TypeScript | 现代化 Chat UI，流式输出、拖拽上传 |
| 后端 | Express + TypeScript | RESTful API，SSE 流式响应 |
| AI 编排 | Vercel AI SDK (`ai` + `@ai-sdk/openai`) | Tool Calling、流式生成、Agent 编排 |
| 向量检索 | ChromaDB + OpenAI Embedding | 持久化向量存储，余弦相似度 Top-K 检索 |
| 文档处理 | `pdf-parse` + 递归文本分割 | 支持 PDF / TXT / MD / 代码文件 |

## 项目亮点

- **全 TypeScript 技术栈**：前后端统一类型定义，端到端类型安全
- **双模式切换**：RAG 模式（纯检索生成）/ Agent 模式（工具自主决策）
- **ReAct Agent**：LLM 自主调用知识库检索和计算器工具，支持多轮 Tool Calling
- **流式输出**：Server-Sent Events (SSE) 实时推送 AI 响应，体验更流畅
- **持久化向量库**：ChromaDB 本地存储，重启服务不丢失数据
- **模块化架构**：VectorStore → RAG → Agent 三层解耦
- **工程化实践**：Zod Schema 验证、错误处理、日志追踪

## 快速开始

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端（新开终端）
cd frontend
npm install
```

### 2. 启动 ChromaDB 服务（可选）

如需持久化向量存储，需先启动 ChromaDB 服务：

```bash
# 全局安装 chromadb（只需一次）
npm install -g chromadb

# 启动服务（数据保存在 ./chroma_db）
chroma run --path ./chroma_db
```

> 不启动 ChromaDB 时，项目会自动使用内存向量库（重启后数据丢失）

### 3. 配置 API Key

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入你的 API Key
```

推荐使用 **SiliconFlow**（国内直连、性价比高）：
```
OPENAI_API_KEY=sk-your-key
OPENAI_BASE_URL=https://api.siliconflow.cn/v1
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
EMBEDDING_MODEL=baai/bge-m3
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
```

### 4. 启动服务

```bash
# 后端（端口 3001）
cd backend
npm run dev

# 前端（端口 5173，自动代理 /api 到后端）
cd frontend
npm run dev
```

浏览器访问 `http://localhost:5173`

## 使用指南

### 1. 上传文档
- 拖拽或点击上传 PDF / TXT / MD / 代码文件
- 系统自动提取文本 → 分割 → 向量化 → 存入知识库

### 2. RAG 模式
- 直接基于检索到的文档片段生成答案
- 适合："这份文档讲了什么？"、"总结第三章内容"
- 支持流式输出，答案逐字实时显示

### 3. Agent 模式（推荐）
- AI 自主决策调用工具：
  - `searchKnowledgeBase`：检索知识库
  - `calculator`：执行数学计算
- 适合："这份文档里的预算总和是多少？"（先检索再计算）
- 支持流式输出，思考过程实时可见

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查，返回向量数量 |
| POST | `/api/upload` | 上传文档，返回处理结果 |
| POST | `/api/chat` | RAG 对话（非流式） |
| POST | `/api/chat/stream` | RAG 对话（流式输出） |
| POST | `/api/agent` | Agent 对话（非流式） |
| POST | `/api/agent/stream` | Agent 对话（流式输出） |
| POST | `/api/clear` | 清除知识库 |

## 项目结构

```
ai-knowledge-assistant-ts/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express 主入口
│   │   ├── config.ts         # 环境配置
│   │   ├── vector-store.ts   # 向量存储（ChromaDB）
│   │   ├── rag.ts            # RAG 核心（文档处理 + 检索）
│   │   └── agent.ts          # Agent 编排（Tool Calling）
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # 主布局
│   │   ├── DocumentUpload.tsx # 文档上传组件
│   │   └── Chat.tsx          # 对话组件（流式输出）
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## 向量存储说明

- **ChromaDB**（推荐）：持久化存储，重启不丢失，数据保存在 `chroma_db` 目录
- **内存向量库**：不启动 ChromaDB 时自动使用，重启后数据丢失

两种模式代码共存，可根据需求切换。

## 许可证

MIT
