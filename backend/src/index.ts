import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { config } from './config.js';
import { vectorStore } from './vector-store.js';
import { processPDF, processText } from './rag.js';
import { runAgent, runRAG, streamAgent, streamRAG } from './agent.js';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ===== 健康检查 =====
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', vectorCount: vectorStore.count });
});

// ===== 文档上传 =====
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const results = [];
    for (const file of files) {
      const ext = file.originalname.split('.').pop()?.toLowerCase();

      if (ext === 'pdf') {
        const info = await processPDF(file.buffer, file.originalname);
        results.push({ name: file.originalname, ...info });
      } else if (['txt', 'md', 'json', 'js', 'ts', 'py'].includes(ext || '')) {
        const text = file.buffer.toString('utf-8');
        const info = await processText(text, file.originalname);
        results.push({ name: file.originalname, ...info });
      } else {
        results.push({ name: file.originalname, error: '不支持的格式' });
      }
    }

    res.json({ success: true, results, totalVectors: vectorStore.count });
  } catch (err: any) {
    console.error('[Upload Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 对话（RAG 模式） =====
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: '消息不能为空' });

    const result = await runRAG(message);
    res.json({ answer: result.answer, mode: 'rag' });
  } catch (err: any) {
    console.error('[Chat Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 对话（Agent 模式） =====
app.post('/api/agent', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: '消息不能为空' });

    const result = await runAgent(message, history);
    res.json({
      answer: result.answer,
      mode: 'agent',
      toolCalls: result.toolCalls,
      usage: result.usage,
    });
  } catch (err: any) {
    console.error('[Agent Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 流式对话（RAG 模式） =====
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: '消息不能为空' });

    const { stream, answer } = await streamRAG(message);

    if (!stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ chunk: answer })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    for await (const chunk of stream.textStream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('[Stream Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 流式对话（Agent 模式） =====
app.post('/api/agent/stream', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: '消息不能为空' });

    const { stream, answer } = await streamAgent(message, history);

    if (!stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ chunk: answer })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    for await (const chunk of stream.textStream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('[Agent Stream Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 清除知识库 =====
app.post('/api/clear', (_req, res) => {
  vectorStore.clear();
  res.json({ success: true, message: '知识库已清空' });
});

app.listen(config.port, () => {
  console.log(`🚀 AI Knowledge Assistant API 运行在 http://localhost:${config.port}`);
  console.log(`📚 当前向量库片段数: ${vectorStore.count}`);
});
