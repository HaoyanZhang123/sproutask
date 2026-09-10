import os
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI

from prompts import SYSTEM_PROMPT

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

app = FastAPI(title="BioBuddy 生物学习伙伴")


# 请求体：学生发来什么
class ChatRequest(BaseModel):
    message: str                 # 学生这轮说的话
    history: list[dict] = []     # 之前的对话记录 [{"role":"user","content":"..."}, ...]


# 响应体：我们返回什么
class ChatResponse(BaseModel):
    reply: str


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    # 组装发给大模型的消息：系统提示词 + 历史对话 + 本轮问题
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(req.history)
    messages.append({"role": "user", "content": req.message})

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        temperature=0.3,   # 低温度=回答更稳定、少跑偏（教学场景要稳不要飘）
    )
    return ChatResponse(reply=response.choices[0].message.content)


@app.get("/")
def root():
    return {"status": "BioBuddy is running 🌱"}
