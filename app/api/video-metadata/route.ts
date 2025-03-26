import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";

// MongoDB 连接
const uri = process.env.MONGODB_URI || "mongodb+srv://Viper3:ShadowZed666@pythonproject.1rxku.mongodb.net/?retryWrites=true&w=majority&appName=PythonProject";
const dbName = process.env.DB_NAME || "XOVideos";
const colName = process.env.COL_NAME || "pornhub";

// 为全局变量添加类型定义
declare global {
  var _mongoClientPromise: Promise<MongoClient>;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri);
  global._mongoClientPromise = client.connect();
}

clientPromise = global._mongoClientPromise;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const title = searchParams.get("title");

  if (!title) {
    return NextResponse.json(
      { error: "Title parameter is required" },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const collection = db.collection(colName);

    // 使用正则表达式进行模糊匹配，不区分大小写
    const video = await collection.findOne({
      title: { $regex: title, $options: "i" },
    });

    if (!video) {
      // 如果没有找到视频，返回模拟数据
      return NextResponse.json({
        duration: formatDuration(Math.floor(Math.random() * 3600)),
        views: Math.floor(Math.random() * 100000),
      });
    }

    return NextResponse.json({
      duration: video.duration || formatDuration(Math.floor(Math.random() * 3600)),
      views: video.views || Math.floor(Math.random() * 100000),
    });
  } catch (error) {
    console.error("Error fetching video metadata:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 将秒数格式化为 MM:SS 格式
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}
