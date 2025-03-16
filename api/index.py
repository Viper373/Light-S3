from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.decorator import cache
from pymongo import MongoClient
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

app = FastAPI()

# 添加CORS中间件，允许所有来源的请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 连接MongoDB
try:
    mongodb_uri = os.getenv("VUE_APP_MONGODB_URI")
    client = MongoClient(
        mongodb_uri,
        maxPoolSize=10,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=5000
    )
    db = client[os.getenv("VUE_APP_DB_NAME")]
    collection = db[os.getenv("VUE_APP_COL_NAME")]
    print("MongoDB连接成功")
except Exception as e:
    print(f"MongoDB连接失败: {str(e)}")
    # 创建一个空字典作为备用
    collection = None

# 存储视频元数据的字典
video_metadata = {}

@app.on_event("startup")
async def startup_event():
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
    try:
        print("开始加载视频元数据...")
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
            print(f"从MongoDB加载了 {len(data)} 条视频元数据")
            
            for item in data:
                author = item.get("author", "")
                title = item.get("video_title", "")
                key = f"{author}/{title}"
                video_metadata[key] = {
                    "views": item.get("video_views"),
                    "duration": item.get("duration")
                }
            print(f"成功加载 {len(video_metadata)} 条视频元数据")
        else:
            print("MongoDB未连接，使用空元数据")
    except Exception as e:
        print(f"预加载元数据失败: {str(e)}")

@app.get("/xovideos")
@cache(expire=7200)
async def get_videos(author: str = Query(None)):
    try:
        print(f"收到请求: author={author}")
        
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
            print(f"返回 {len(filtered_data)} 条作者 {author} 的数据")
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
        print(f"返回所有 {len(all_data)} 条数据")
        return {"status": "success", "data": all_data}
    except Exception as e:
        error_msg = str(e)
        print(f"处理请求时出错: {error_msg}")
        return {"status": "error", "message": error_msg}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
