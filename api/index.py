from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from pymongo import MongoClient
import os
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.decorator import cache
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

mongodb_uri = os.getenv("VUE_APP_MONGODB_URI")
client = MongoClient(
    mongodb_uri,
    maxPoolSize=10,
    serverSelectionTimeoutMS=10000,
    connectTimeoutMS=5000
)
db = client[os.getenv("VUE_APP_DB_NAME")]
collection = db[os.getenv("VUE_APP_COL_NAME")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

video_metadata = {}


@app.on_event("startup")
async def startup_event():
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
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
        print(f"处理请求时出错: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# 添加文档端点
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url="/api/openapi.json",
        title="FastAPI - Swagger UI"
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
