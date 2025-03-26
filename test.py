import os
import subprocess

def get_video_files(directory):
    """获取目录下所有视频文件，并按修改时间排序"""
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv']
    files = [
        f for f in os.listdir(directory)
        if os.path.isfile(os.path.join(directory, f)) and
           os.path.splitext(f)[1].lower() in video_extensions
    ]
    files_with_mtime = [(f, os.path.getmtime(os.path.join(directory, f))) for f in files]
    sorted_files = sorted(files_with_mtime, key=lambda x: x[1])
    return [os.path.join(directory, f[0]) for f in sorted_files]

def generate_ffmpeg_command(video_files, output_file, resolution=(1280, 960)):
    """生成FFmpeg命令，将视频文件合成为4:3比例的单个视频，使用GPU加速"""
    inputs = []
    filter_chains = []
    concat_parts = []
    
    # 为每个视频生成输入参数和滤镜链
    for i, video in enumerate(video_files):
        inputs.extend(['-i', video])
        # 先裁剪视频为4:3比例，然后缩放到目标分辨率
        filter_chains.append(
            f'[{i}:v]crop=ih*(4/3):ih,scale={resolution[0]}:{resolution[1]}[v{i}]'
        )
        concat_parts.extend([f'[v{i}]', f'[{i}:a]'])
    
    # 构建filter_complex字符串，拼接视频和音频
    filter_complex = (
        '; '.join(filter_chains) + '; ' +
        ''.join(concat_parts) + f'concat=n={len(video_files)}:v=1:a=1[outv][outa]'
    )
    
    # 构造FFmpeg命令，使用GPU加速（h264_nvenc）
    command = (
        ['ffmpeg'] + inputs +
        ['-filter_complex', filter_complex, '-map', '[outv]', '-map', '[outa]'] +
        ['-c:v', 'h264_nvenc', '-b:v', '10M', '-c:a', 'aac', '-b:a', '192k', output_file]
    )
    return command

def main():
    """主函数，执行视频合成"""
    directory = r"D:\Best\TikTokDownloader_V5.5_Windows_X64\_internal\Download"
    output_file = os.path.join(r"C:\Users\Viper3\Downloads", 'chiikawa.mp4')
    
    # 获取按日期排序的视频文件列表
    video_files = get_video_files(directory)
    if not video_files:
        print('目录中未找到视频文件。')
        return
    
    # 生成并执行FFmpeg命令
    command = generate_ffmpeg_command(video_files, output_file)
    print('执行命令:', ' '.join(command))
    try:
        subprocess.run(command, check=True)
        print('视频合成成功完成。')
    except subprocess.CalledProcessError as e:
        print('发生错误:', e)

if __name__ == '__main__':
    main()