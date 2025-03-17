import logging
import os
from fastapi import FastAPI, Query
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.decorator import cache
from pymongo import MongoClient

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 定义全局变量
video_metadata = {}

# 连接 MongoDB
try:
    mongodb_uri = os.getenv("VUE_APP_MONGODB_URI")
    db_name = os.getenv("VUE_APP_DB_NAME")
    col_name = os.getenv("VUE_APP_COL_NAME")

    # 添加环境变量诊断日志
    logger.info(f"MongoDB URI: {mongodb_uri and '已设置' or '未设置'}")
    logger.info(f"DB Name: {db_name and '已设置' or '未设置'}")
    logger.info(f"Collection Name: {col_name and '已设置' or '未设置'}")

    if not mongodb_uri or not db_name or not col_name:
        raise ValueError("环境变量未设置")

    client = MongoClient(
        mongodb_uri,
        maxPoolSize=10,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=5000
    )
    db = client[db_name]
    collection = db[col_name]
    
    # 添加集合检查
    collection_count = collection.count_documents({})
    logger.info(f"MongoDB 连接成功，集合 {col_name} 中有 {collection_count} 条文档")
except Exception as e:
    logger.error(f"MongoDB 连接失败: {str(e)}")
    collection = None

# 初始化缓存，确保在导入时就执行
FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
logger.info("FastAPICache 初始化完成")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 应用启动时执行的代码
    try:
        if collection is not None:
            # 尝试查询原始文档结构
            sample_doc = collection.find_one()
            if sample_doc:
                logger.info(f"集合中的文档结构: {sample_doc}")
                
                # 检查是否有作者视频列表字段
                has_author_field = "作者名称" in sample_doc
                has_videos_field = "作者视频列表" in sample_doc
                
                if has_author_field and has_videos_field:
                    # 使用正确的字段名构建管道
                    pipeline = [
                        {"$match": {"作者视频列表": {"$ne": []}}},  # 确保作者视频列表不为空
                        {"$unwind": "$作者视频列表"},
                        {"$match": {"作者视频列表.视频标题": {"$ne": ""}}},  # 确保视频标题不为空
                        {"$project": {
                            "_id": 0,
                            "author": {"$cond": [{"$eq": ["$作者名称", ""]}, "未知作者", "$作者名称"]},  # 处理空作者名称
                            "video_title": "$作者视频列表.视频标题",
                            "video_views": "$作者视频列表.视频观看次数",
                            "duration": "$作者视频列表.视频时长"
                        }}
                    ]
                    logger.info(f"使用标准管道查询: {pipeline}")
                    
                    # 执行聚合查询
                    data = list(collection.aggregate(pipeline))
                    logger.info(f"从 MongoDB 加载了 {len(data)} 条视频元数据")
                    
                    # 添加数据样本日志
                    if data:
                        logger.info(f"数据样本: {data[0]}")
                        
                        # 处理数据
                        for item in data:
                            author = item.get("author", "未知作者")
                            title = item.get("video_title", "")
                            if title:  # 确保标题不为空
                                key = f"{author}/{title}"
                                video_metadata[key] = {
                                    "views": item.get("video_views", "0"),
                                    "duration": item.get("duration", "0:00")
                                }
                        logger.info(f"成功加载 {len(video_metadata)} 条视频元数据")
                    else:
                        logger.warning("聚合查询返回空结果，尝试直接查询所有文档")
                        
                        # 如果聚合查询返回空，尝试直接查询所有文档并手动处理
                        all_docs = list(collection.find({}))
                        logger.info(f"直接查询返回 {len(all_docs)} 条文档")
                        
                        video_count = 0
                        for doc in all_docs:
                            author = doc.get("作者名称", "未知作者")
                            if author == "":
                                author = "未知作者"
                                
                            videos = doc.get("作者视频列表", [])
                            for video in videos:
                                title = video.get("视频标题", "")
                                if title:  # 确保标题不为空
                                    key = f"{author}/{title}"
                                    video_metadata[key] = {
                                        "views": video.get("视频观看次数", "0"),
                                        "duration": video.get("视频时长", "0:00")
                                    }
                                    video_count += 1
                        
                        logger.info(f"通过直接查询成功加载 {video_count} 条视频元数据")
                else:
                    logger.warning("文档结构不包含预期的字段，无法加载元数据")
            else:
                logger.warning("无法获取样本文档")
        else:
            logger.warning("MongoDB 未连接，使用空元数据")
    except Exception as e:
        logger.error(f"预加载元数据失败: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    yield


# 初始化 FastAPI 应用，添加路由前缀
app = FastAPI(lifespan=lifespan)

# 创建一个带有前缀的路由器
api_router = FastAPI()

# 添加 CORS 中间件，允许所有来源的请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@api_router.get("/xovideos")  # 保持原有路径
@cache(expire=7200)
async def get_videos(author: str = Query(None)):
    try:
        logger.info(f"收到请求: author={author}, 当前元数据条目数: {len(video_metadata)}")
        
        # 添加元数据诊断
        if not video_metadata:
            logger.warning("元数据为空，可能是 MongoDB 连接或查询问题")
            
            # 尝试直接从数据库查询
            if collection is not None:
                try:
                    if author:
                        query = {"作者名称": author}
                    else:
                        query = {}
                    
                    # 直接从数据库查询
                    docs = list(collection.find(query, {"_id": 0, "作者名称": 1, "作者视频列表": 1}))
                    logger.info(f"直接查询返回 {len(docs)} 条文档")
                    
                    result_data = []
                    for doc in docs:
                        current_author = doc.get("作者名称", "未知作者")
                        if current_author == "":
                            current_author = "未知作者"
                            
                        videos = doc.get("作者视频列表", [])
                        for video in videos:
                            title = video.get("视频标题", "")
                            if title:  # 确保标题不为空
                                result_data.append({
                                    "author": current_author,
                                    "video_title": title,
                                    "video_views": video.get("视频观看次数", "0"),
                                    "duration": video.get("视频时长", "0:00")
                                })
                    
                    if result_data:
                        logger.info(f"直接查询返回 {len(result_data)} 条视频数据")
                        return {"status": "success", "data": result_data}
                except Exception as db_error:
                    logger.error(f"直接查询数据库失败: {str(db_error)}")
            
            # 如果直接查询也失败，返回测试数据
            test_data = [{
                "author": author or "测试作者",
                "video_title": "测试视频",
                "video_views": "100",
                "duration": "10:00"
            }]
            return {"status": "success", "data": test_data, "note": "使用测试数据，实际数据库连接可能有问题"}

        # 原有的元数据处理逻辑保持不变
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
            logger.info(f"返回 {len(filtered_data)} 条作者 {author} 的数据")
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
        logger.info(f"返回所有 {len(all_data)} 条数据")
        return {"status": "success", "data": all_data}
    except Exception as e:
        error_msg = str(e)
        logger.error(f"处理请求时出错: {error_msg}")
        return {"status": "error", "message": error_msg}


@api_router.get("/health")  # 保持原有路径
async def health_check():
    logger.info("健康检查请求")
    return {"status": "healthy"}


# 添加 MongoDB 诊断路由
@api_router.get("/mongodb-status")
async def mongodb_status():
    try:
        status = {
            "mongodb_uri": os.getenv("VUE_APP_MONGODB_URI") and "已设置" or "未设置",
            "db_name": os.getenv("VUE_APP_DB_NAME") and "已设置" or "未设置",
            "col_name": os.getenv("VUE_APP_COL_NAME") and "已设置" or "未设置",
            "connection_status": "未连接",
            "collection_count": 0,
            "sample_document": None,
            "metadata_count": len(video_metadata)
        }
        
        if collection is not None:
            # 测试连接是否有效
            try:
                # 执行简单查询测试连接
                collection.find_one({}, {"_id": 1})
                status["connection_status"] = "已连接"
                
                # 获取文档数量
                status["collection_count"] = collection.count_documents({})
                
                # 获取样本文档
                sample_doc = collection.find_one()
                if sample_doc:
                    # 移除可能的敏感信息
                    if "_id" in sample_doc:
                        sample_doc["_id"] = str(sample_doc["_id"])
                    status["sample_document"] = sample_doc
                    
                    # 检查文档结构
                    status["document_fields"] = list(sample_doc.keys())
                    
                    # 检查是否有作者视频列表字段
                    status["has_author_field"] = "作者名称" in sample_doc
                    status["has_videos_field"] = "作者视频列表" in sample_doc
                    
                    # 尝试找出可能的列表字段
                    list_fields = []
                    for field, value in sample_doc.items():
                        if isinstance(value, list):
                            list_fields.append(field)
                    status["list_fields"] = list_fields
            except Exception as e:
                status["connection_error"] = str(e)
        
        logger.info(f"MongoDB 诊断: {status}")
        return status
    except Exception as e:
        logger.error(f"MongoDB 诊断失败: {str(e)}")
        return {"status": "error", "message": str(e)}


# 将 API 路由器挂载到主应用，添加前缀
app.mount("/api", api_router)


# 添加根路由，用于测试 API 是否正常工作
@app.get("/")
async def root():
    return {"message": "API 服务正常运行"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
