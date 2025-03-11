from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import os
# 修改导入语句，使用正确的包名
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.decorator import cache

app = FastAPI()

# 使用连接池并设置超时
client = MongoClient(
    "mongodb+srv://Viper3:ShadowZed666@pythonproject.1rxku.mongodb.net/?retryWrites=true&w=majority&appName=PythonProject",
    maxPoolSize=10,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000
)
db = client["XOVideos"]
collection = db["pornhub"]

# 初始化缓存，增加缓存时间到24小时
# 注意：FastAPICache.init 需要在应用启动事件中调用
# 所以我们将这行移到startup_event函数中

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
