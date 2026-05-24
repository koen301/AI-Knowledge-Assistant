"""
RAG 核心引擎：文档加载 -> 分割 -> 向量化 -> 存储 -> 检索 -> 生成
"""
import os
from typing import List, Optional
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain.chains import ConversationalRetrievalChain
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain.schema import Document

from config import Config

class RAGEngine:
    """个人知识库 RAG 引擎"""

    def __init__(self):
        Config.validate()

        # 1. 初始化 LLM
        self.llm = ChatOpenAI(
            api_key=Config.OPENAI_API_KEY,
            base_url=Config.OPENAI_BASE_URL,
            model=Config.LLM_MODEL,
            temperature=0.7,
        )

        # 2. 初始化 Embedding
        self.embeddings = OpenAIEmbeddings(
            api_key=Config.OPENAI_API_KEY,
            base_url=Config.OPENAI_BASE_URL,
            model=Config.EMBEDDING_MODEL,
        )

        # 3. 文本分割器
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=Config.CHUNK_SIZE,
            chunk_overlap=Config.CHUNK_OVERLAP,
            separators=["\n\n", "\n", "。", "；", " ", ""],
        )

        # 4. 对话记忆（多轮对话核心）
        self.chat_history = ChatMessageHistory()

        self.vector_store: Optional[Chroma] = None
        self.qa_chain = None

    def load_documents(self, file_paths: List[str]) -> List[Document]:
        """加载 PDF / TXT / MD 文档"""
        documents = []
        for path in file_paths:
            if not os.path.exists(path):
                continue
            ext = os.path.splitext(path)[1].lower()
            if ext == ".pdf":
                loader = PyPDFLoader(path)
            elif ext in [".txt", ".md", ".py", ".js", ".json"]:
                loader = TextLoader(path, encoding="utf-8")
            else:
                continue
            docs = loader.load()
            documents.extend(docs)
        return documents

    def build_vector_store(self, documents: List[Document]) -> Chroma:
        """文档向量化并存储到 ChromaDB"""
        # 分割文档
        chunks = self.splitter.split_documents(documents)

        # 创建/更新向量存储
        self.vector_store = Chroma.from_documents(
            documents=chunks,
            embedding=self.embeddings,
            persist_directory=Config.VECTOR_STORE_PATH,
        )
        self.vector_store.persist()
        return self.vector_store

    def load_existing_store(self) -> bool:
        """加载已存在的向量数据库"""
        if not os.path.exists(Config.VECTOR_STORE_PATH):
            return False
        self.vector_store = Chroma(
            persist_directory=Config.VECTOR_STORE_PATH,
            embedding_function=self.embeddings,
        )
        return True

    def create_qa_chain(self):
        """创建对话检索链（核心）"""
        if not self.vector_store:
            raise ValueError("请先构建或加载向量存储")

        retriever = self.vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": Config.TOP_K},
        )

        self.qa_chain = ConversationalRetrievalChain.from_llm(
            llm=self.llm,
            retriever=retriever,
            return_source_documents=True,
            verbose=False,
        )
        return self.qa_chain

    def chat(self, question: str) -> dict:
        """多轮对话问答"""
        if not self.qa_chain:
            raise ValueError("请先调用 create_qa_chain()")

        try:
            chat_history = []
            for msg in self.chat_history.messages:
                if hasattr(msg, 'type'):
                    if msg.type == 'human':
                        chat_history.append({"role": "user", "content": msg.content})
                    elif msg.type == 'ai':
                        chat_history.append({"role": "assistant", "content": msg.content})

            print(f"DEBUG: chat_history = {chat_history}")
            print(f"DEBUG: question = {question}")

            result = self.qa_chain.invoke({
                "question": question,
                "chat_history": []
            })

            print(f"DEBUG: result keys = {result.keys()}")

            self.chat_history.add_user_message(question)
            self.chat_history.add_ai_message(result["answer"])

            return {
                "answer": result["answer"],
                "sources": [doc.page_content[:200] + "..." for doc in result.get("source_documents", [])],
            }
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            print(f"ERROR in chat: {error_detail}")
            raise e

    def clear_memory(self):
        """清空对话历史"""
        self.chat_history.clear()
