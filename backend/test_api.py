import os
from dotenv import load_dotenv
from openai import OpenAI

# 从 .env 文件读取 API Key
load_dotenv()

# 创建客户端：注意 base_url 指向 DeepSeek
client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

# 发起一次对话
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": "你是一名初中生物老师，说话亲切简洁。"},
        {"role": "user", "content": "用一句话向初一学生解释什么是细胞。"}
    ]
)

print(response.choices[0].message.content)
