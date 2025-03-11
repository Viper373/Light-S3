from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import os
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.decorator import cache
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

app = FastAPI()

# 从环境变量获取MongoDB连接字符串
mongodb_uri = os.getenv("MONGODB_URI")

# 使用连接池并设置超时
client = MongoClient(
    mongodb_uri,
    maxPoolSize=10,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000
)
db = client["XOVideos"]
collection = db["pornhub"]

# 配置CORS - 允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http:127.0.0.1:8888"],  # 在生产环境中，应该限制为您的前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 预加载数据到内存
video_metadata = {}


@app.on_event("startup")
async def startup_event():
    # 初始化缓存
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")

    # 预加载所有元数据到内存
    try:
        pipeline = [
            {"$unwind": "$作者视频列表"},
            {"$project": {
                "_id": 0,
                "author": "$作者名称",
                "video_title": "$作者视频列表.视频标题",
                "video_views": "$作者视频列表.视频观看次数",
                "duration": "$作者视频列表.视频时长"
            }}
        ]
        data = list(collection.aggregate(pipeline))

        # 构建查找索引
        for item in data:
            author = item.get("author", "")
            title = item.get("video_title", "")
            key = f"{author}/{title}"
            video_metadata[key] = {
                "views": item.get("video_views"),
                "duration": item.get("duration")
            }
    except Exception as e:
        print(f"预加载元数据失败: {str(e)}")


@app.get("/xovideos")
@cache(expire=86400)  # 24小时缓存
async def get_videos(author: str = Query(None)):
    try:
        # 如果请求特定作者，则过滤数据
        if author:
            filtered_data = []
            for key, value in video_metadata.items():
                if key.startswith(f"{author}/"):
                    parts = key.split("/", 1)
                    if len(parts) == 2:
                        filtered_data.append({
                            "author": author,
                            "video_title": parts[1],
                            "video_views": value.get("views"),
                            "duration": value.get("duration")
                        })
            return {"status": "success", "data": filtered_data}

        # 否则返回所有数据的转换版本
        all_data = []
        for key, value in video_metadata.items():
            parts = key.split("/", 1)
            if len(parts) == 2:
                all_data.append({
                    "author": parts[0],
                    "video_title": parts[1],
                    "video_views": value.get("views"),
                    "duration": value.get("duration")
                })
        return {"status": "success", "data": all_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 添加健康检查端点
@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
