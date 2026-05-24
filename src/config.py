"""项目配置管理"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # LLM API 配置（OpenAI 兼容格式）
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

    # 默认模型（可切换）
    # DeepSeek: deepseek-chat
    # 通义千问: qwen-plus
    # GPT-4: gpt-4
    # GPT-3.5: gpt-3.5-turbo
    LLM_MODEL = os.getenv("LLM_MODEL", "gpt-3.5-turbo")

    # Embedding 模型
    # 如果用 OpenAI: text-embedding-ada-002
    # 如果用硅基流动: BAAI/bge-large-zh-v1.5（中文更好）
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-ada-002")

    # 向量存储路径
    VECTOR_STORE_PATH = "./chroma_db"

    # 文档目录
    DATA_DIR = "./data"

    # 文本分割参数
    CHUNK_SIZE = 500
    CHUNK_OVERLAP = 50

    # 检索参数
    TOP_K = 4

    @classmethod
    def validate(cls):
        if not cls.OPENAI_API_KEY:
            raise ValueError("请配置 OPENAI_API_KEY，复制 .env.example 为 .env 并填写")
