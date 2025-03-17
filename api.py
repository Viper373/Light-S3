from fastapi import FastAPI, Query
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.decorator import cache
from pymongo import MongoClient

# 定义全局变量
video_metadata = {}

# 连接 MongoDB
try:
    mongodb_uri = os.getenv("VUE_APP_MONGODB_URI")
    db_name = os.getenv("VUE_APP_DB_NAME")
    col_name = os.getenv("VUE_APP_COL_NAME")

    client = MongoClient(
        mongodb_uri,
        maxPoolSize=10,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=5000
    )
    db = client[db_name]
    collection = db[col_name]
    print("MongoDB 连接成功")
except Exception as e:
    print(f"MongoDB 连接失败: {str(e)}")
    collection = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 应用启动时执行的代码
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
    try:
        if collection:
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

            for item in data:
                author = item.get("author", "")
                title = item.get("video_title", "")
                key = f"{author}/{title}"
                video_metadata[key] = {
                    "views": item.get("video_views"),
                    "duration": item.get("duration")
                }
        else:
            print("MongoDB 未连接，使用空元数据")
    except Exception as e:
        print(f"预加载元数据失败: {str(e)}")
    yield


# 初始化 FastAPI 应用
app = FastAPI(lifespan=lifespan)

# 添加 CORS 中间件，允许所有来源的请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/xovideos")
@cache(expire=7200)
async def get_videos(author: str = Query(None)):
    try:

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
        error_msg = str(e)
        return {"status": "error", "message": error_msg}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
