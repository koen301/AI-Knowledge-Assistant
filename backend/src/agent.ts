import { generateText, streamText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { config } from './config.js';
import { retrieveContext } from './rag.js';

/**
 * Agent 核心：ReAct 模式实现
 * 
 * 包含两个 Tool：
 * 1. searchKnowledgeBase - 检索个人知识库
 * 2. calculator - 简单计算器
 * 
 * LLM 自主决策：先思考需要什么信息 → 调用 Tool → 观察结果 → 再思考 → 给出答案
 */

// 自定义 OpenAI provider（支持 DeepSeek / 硅基流动等兼容端点）
const openai = createOpenAI({
  baseURL: config.llm.baseURL,
  apiKey: config.llm.apiKey,
});

const customModel = openai(config.llm.model);

/**
 * Tool 1: 知识库检索
 * LLM 遇到关于上传文档的问题时，会调用此工具
 */
const searchKnowledgeBase = tool({
  description: '从个人知识库中检索与用户问题相关的文档片段。当问题涉及已上传的文档、技术资料、产品说明时使用此工具。',
  parameters: z.object({
    query: z.string().describe('用于检索的关键词或问题，建议提取核心实体'),
  }),
  execute: async ({ query }) => {
    console.log(`[Tool] searchKnowledgeBase query="${query}"`);
    const { context, sources } = await retrieveContext(query);
    return {
      found: sources.length > 0,
      context,
      sources: sources.map(s => ({
        content: s.content.slice(0, 200) + '...',
        source: s.metadata.source,
      })),
    };
  },
});

/**
 * Tool 2: 计算器
 * LLM 遇到数值计算时调用，避免算错
 */
const calculator = tool({
  description: '执行数学计算。当问题涉及加减乘除、百分比、统计计算时使用此工具。',
  parameters: z.object({
    expression: z.string().describe('数学表达式，例如 "15 * 23 + 100"'),
  }),
  execute: async ({ expression }) => {
    console.log(`[Tool] calculator expression="${expression}"`);
    try {
      // 安全计算：只允许数字和运算符
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
      const result = Function('"use strict"; return (' + sanitized + ')')();
      return { result, expression: sanitized };
    } catch {
      return { error: '计算失败，请检查表达式', result: null };
    }
  },
});

/**
 * 运行 Agent（多轮 Tool Calling）
 */
export async function runAgent(question: string, chatHistory: { role: string; content: string }[] = []) {
  const systemPrompt = `你是一位专业的 AI 助手，擅长结合知识库检索和精确计算来回答问题。

工作原则：
1. 如果用户问题涉及已上传的文档内容，优先调用 searchKnowledgeBase 工具检索相关知识。
2. 如果涉及数值计算，必须调用 calculator 工具，不要心算。
3. 基于检索到的信息给出准确、简洁的回答。
4. 如果知识库中没有相关信息，坦诚告知用户。

当前对话历史：
${chatHistory.slice(-6).map(h => `${h.role}: ${h.content}`).join('\n')}`;

  const result = await generateText({
    model: customModel,
    system: systemPrompt,
    prompt: question,
    tools: {
      searchKnowledgeBase,
      calculator,
    },
    maxSteps: 5, // 最多允许 5 轮 Tool Calling
    temperature: 0.3,
  });

  return {
    answer: result.text,
    toolCalls: result.toolCalls,
    toolResults: result.toolResults,
    usage: result.usage,
  };
}

/**
 * 纯 RAG 模式（不调用 Agent，直接检索 + 生成）
 * 用于简单问答场景，减少 Token 消耗
 */
export async function runRAG(question: string) {
  const { context } = await retrieveContext(question);

  if (!context) {
    return { answer: '知识库中暂无相关内容，请先上传文档。', sources: [] };
  }

  const result = await generateText({
    model: customModel,
    system: '你是一位基于知识库文档回答问题的助手。请严格根据提供的参考资料回答，不要编造。',
    prompt: `参考资料：\n${context}\n\n用户问题：${question}\n\n请根据参考资料回答。`,
    temperature: 0.2,
  });

  return { answer: result.text };
}

/**
 * 流式 RAG 模式 - 返回可流式输出的结果
 */
export async function streamRAG(question: string) {
  const { context } = await retrieveContext(question);

  if (!context) {
    return {
      answer: '知识库中暂无相关内容，请先上传文档。',
      sources: [],
      stream: null
    };
  }

  const result = streamText({
    model: customModel,
    system: '你是一位基于知识库文档回答问题的助手。请严格根据提供的参考资料回答，不要编造。',
    prompt: `参考资料：\n${context}\n\n用户问题：${question}\n\n请根据参考资料回答。`,
    temperature: 0.2,
  });

  return {
    answer: '',
    sources: [],
    stream: result,
  };
}

/**
 * 流式 Agent 模式 - 返回可流式输出的结果
 */
export async function streamAgent(question: string, chatHistory: { role: string; content: string }[] = []) {
  const systemPrompt = `你是一位专业的 AI 助手，擅长结合知识库检索和精确计算来回答问题。

工作原则：
1. 如果用户问题涉及已上传的文档内容，优先调用 searchKnowledgeBase 工具检索相关知识。
2. 如果涉及数值计算，必须调用 calculator 工具，不要心算。
3. 基于检索到的信息给出准确、简洁的回答。
4. 如果知识库中没有相关信息，坦诚告知用户。

当前对话历史：
${chatHistory.slice(-6).map(h => `${h.role}: ${h.content}`).join('\n')}`;

  const result = streamText({
    model: customModel,
    system: systemPrompt,
    prompt: question,
    tools: {
      searchKnowledgeBase,
      calculator,
    },
    maxSteps: 5,
    temperature: 0.3,
  });

  return {
    answer: '',
    stream: result,
    toolCalls: [],
  };
}
