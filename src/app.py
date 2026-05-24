"""
AI Knowledge Assistant - Web 界面
基于 Gradio 的个人知识库问答助手
"""
import os
import sys
import glob
import gradio as gr
from rag_engine import RAGEngine
from config import Config

# 全局引擎实例
engine = RAGEngine()

def init_engine():
    """初始化：尝试加载已有知识库"""
    try:
        if engine.load_existing_store():
            engine.create_qa_chain()
            return "✅ 已加载现有知识库，可直接对话"
    except Exception as e:
        print(f"加载知识库失败: {e}")
    return "⚠️ 尚未构建知识库，请先上传文档"

def upload_and_build(files):
    """上传文档并构建向量库"""
    if not files:
        return "请先上传文件", ""

    try:
        file_paths = [f.name for f in files]

        # 加载文档
        documents = engine.load_documents(file_paths)
        if not documents:
            return "❌ 未能加载任何文档", ""

        # 构建向量库
        engine.build_vector_store(documents)
        engine.create_qa_chain()

        # 保存文件到 data 目录
        os.makedirs(Config.DATA_DIR, exist_ok=True)
        for f in files:
            dst = os.path.join(Config.DATA_DIR, os.path.basename(f.name))
            if not os.path.exists(dst):
                import shutil
                shutil.copy(f.name, dst)

        return f"✅ 成功加载 {len(documents)} 页文档，构建 {len(engine.vector_store.get()['ids'])} 个向量片段", ""
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"构建知识库错误: {error_detail}")
        return f"❌ 错误: {str(e)}", ""

def chat(message, history):
    """多轮对话处理"""
    if not engine.qa_chain:
        return "请先上传文档构建知识库", history

    try:
        result = engine.chat(message)
        answer = result["answer"]
        sources = "\n\n📚 **参考来源**：\n" + "\n".join(
            [f"- {s[:100]}..." for s in result["sources"][:2]]
        ) if result["sources"] else ""

        response = answer + sources

        new_history = []
        if history and isinstance(history, list):
            for item in history:
                if isinstance(item, list) and len(item) == 2:
                    new_history.append({"role": "user", "content": item[0]})
                    new_history.append({"role": "assistant", "content": item[1]})
                elif isinstance(item, dict) and "role" in item:
                    new_history.append(item)

        new_history.append({"role": "user", "content": message})
        new_history.append({"role": "assistant", "content": response})

        return "", new_history
    except Exception as e:
        import traceback
        print(f"Chat error: {traceback.format_exc()}")
        error_history = []
        if history and isinstance(history, list):
            for item in history:
                if isinstance(item, dict) and "role" in item:
                    error_history.append(item)
        error_history.append({"role": "user", "content": message})
        error_history.append({"role": "assistant", "content": f"❌ 错误: {str(e)}"})
        return "", error_history

def clear_chat():
    """清空对话"""
    engine.clear_memory()
    return None, []

def list_docs():
    """列出已加载的文档"""
    docs = glob.glob(os.path.join(Config.DATA_DIR, "*"))
    if not docs:
        return "暂无文档"
    return "\n".join([f"📄 {os.path.basename(d)}" for d in docs])

# ========== Gradio 界面 ==========
with gr.Blocks(title="AI Knowledge Assistant") as demo:
    gr.Markdown("""
    # 🤖 AI 个人知识库助手

    基于 **LangChain + RAG + LLM** 的智能问答系统。
    """)

    with gr.Row():
        with gr.Column(scale=1):
            gr.Markdown("### 📁 文档管理")
            file_upload = gr.File(
                file_count="multiple",
                label="上传文档（PDF/TXT/MD）",
                file_types=[".pdf", ".txt", ".md", ".py", ".js"],
            )
            build_btn = gr.Button("🔨 构建知识库", variant="primary")
            build_status = gr.Textbox(label="状态", value=init_engine, interactive=False)

            gr.Markdown("### 📋 已加载文档")
            doc_list = gr.Textbox(label="文档列表", value=list_docs, interactive=False, lines=5)
            refresh_btn = gr.Button("🔄 刷新列表")

            clear_btn = gr.Button("🗑️ 清空对话记忆")

        with gr.Column(scale=2):
            gr.Markdown("### 💬 对话")
            chatbot = gr.Chatbot(
                height=500,
            )
            msg_input = gr.Textbox(
                placeholder="请输入问题，例如：这份文档主要讲了什么？",
                label="问题",
                lines=2,
            )
            send_btn = gr.Button("🚀 发送", variant="primary")

    # 事件绑定
    build_btn.click(
        upload_and_build,
        inputs=[file_upload],
        outputs=[build_status, doc_list],
    )

    send_btn.click(
        chat,
        inputs=[msg_input, chatbot],
        outputs=[msg_input, chatbot],
    )

    msg_input.submit(
        chat,
        inputs=[msg_input, chatbot],
        outputs=[msg_input, chatbot],
    )

    clear_btn.click(clear_chat, outputs=[msg_input, chatbot])
    refresh_btn.click(list_docs, outputs=doc_list)

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, share=False, theme=gr.themes.Soft())
