#!/bin/bash

# fancy-wallet 图标创建脚本
# 用于创建 Tauri 应用所需的各种图标格式

set -e

ICON_DIR="src-tauri/icons"
SOURCE_ICON=""

# 检查是否提供了源图标文件
if [ -z "$1" ]; then
    echo "用法: ./create-icon.sh <源图标文件路径>"
    echo "示例: ./create-icon.sh my-icon.png"
    echo ""
    echo "请确保源图标文件是正方形，建议尺寸至少 1024x1024 像素"
    exit 1
fi

SOURCE_ICON="$1"

# 检查源文件是否存在
if [ ! -f "$SOURCE_ICON" ]; then
    echo "错误: 源图标文件不存在: $SOURCE_ICON"
    exit 1
fi

# 确保图标目录存在
mkdir -p "$ICON_DIR"

echo "开始创建图标..."

# 创建不同尺寸的 PNG 图标（使用 Python 确保 RGBA 格式和圆角）
echo "创建 PNG 图标（RGBA 格式，圆角）..."
python3 << EOF
from PIL import Image, ImageDraw

def add_corners(img, radius):
    """为图片添加圆角"""
    mask = Image.new('L', img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), img.size], radius=radius, fill=255)
    output = Image.new('RGBA', img.size, (0, 0, 0, 0))
    output.paste(img, (0, 0))
    output.putalpha(mask)
    return output

source = Image.open("$SOURCE_ICON").convert('RGBA')
icons = [
    (32, "$ICON_DIR/32x32.png", 6),    # 32x32 使用 6px 圆角
    (128, "$ICON_DIR/128x128.png", 25),  # 128x128 使用 25px 圆角
    (256, "$ICON_DIR/128x128@2x.png", 50),  # 256x256 使用 50px 圆角
]

for size, path, radius in icons:
    img = source.resize((size, size), Image.Resampling.LANCZOS)
    img = add_corners(img, radius)  # 添加圆角并确保 RGBA 格式
    img.save(path)
    print(f"✓ 已创建 {path} ({size}x{size}, RGBA, 圆角 {radius}px)")

# 创建通用 PNG 图标（512x512，带圆角 - Tauri 标准尺寸）
img = source.resize((512, 512), Image.Resampling.LANCZOS)
radius = 102  # 512x512 图标使用 102px 圆角（约为宽度的 20%）
img = add_corners(img, radius)
img.save("$ICON_DIR/icon.png")
print(f"✓ 已创建 $ICON_DIR/icon.png (512x512, RGBA, 圆角 {radius}px)")
EOF

if [ $? -ne 0 ]; then
    echo "警告: Python PIL 不可用，尝试使用 sips..."
    sips -z 32 32 "$SOURCE_ICON" --out "$ICON_DIR/32x32.png" 2>/dev/null || convert "$SOURCE_ICON" -resize 32x32 "$ICON_DIR/32x32.png"
    sips -z 128 128 "$SOURCE_ICON" --out "$ICON_DIR/128x128.png" 2>/dev/null || convert "$SOURCE_ICON" -resize 128x128 "$ICON_DIR/128x128.png"
    sips -z 256 256 "$SOURCE_ICON" --out "$ICON_DIR/128x128@2x.png" 2>/dev/null || convert "$SOURCE_ICON" -resize 256x256 "$ICON_DIR/128x128@2x.png"
    cp "$SOURCE_ICON" "$ICON_DIR/icon.png" 2>/dev/null || true
    echo "⚠ 注意: 请确保生成的 PNG 图标是 RGBA 格式（Tauri 要求）"
fi

# 创建 Mac 图标集 (.icns) - 使用圆角图标
echo "创建 Mac 图标集 (.icns)（圆角）..."
ICONSET_DIR="$ICON_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"

python3 << ICONSET_EOF
from PIL import Image, ImageDraw

def add_corners(img, radius):
    """为图片添加圆角"""
    mask = Image.new('L', img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), img.size], radius=radius, fill=255)
    output = Image.new('RGBA', img.size, (0, 0, 0, 0))
    output.paste(img, (0, 0))
    output.putalpha(mask)
    return output

source = Image.open("$SOURCE_ICON").convert('RGBA')

# macOS 需要的各种尺寸（尺寸，文件名，圆角半径）
sizes = [
    (16, "icon_16x16.png", 3),
    (32, "icon_16x16@2x.png", 6),
    (32, "icon_32x32.png", 6),
    (64, "icon_32x32@2x.png", 12),
    (128, "icon_128x128.png", 25),
    (256, "icon_128x128@2x.png", 50),
    (256, "icon_256x256.png", 50),
    (512, "icon_256x256@2x.png", 100),
    (512, "icon_512x512.png", 100),
    (1024, "icon_512x512@2x.png", 204),
]

for size, filename, radius in sizes:
    img = source.resize((size, size), Image.Resampling.LANCZOS)
    img = add_corners(img, radius)
    img.save(f"{ICONSET_DIR}/{filename}")
    print(f"✓ {filename} ({size}x{size}, 圆角 {radius}px)")

ICONSET_EOF

# 使用 iconutil 创建 .icns 文件（macOS 专用）
if command -v iconutil &> /dev/null; then
    iconutil -c icns "$ICONSET_DIR" -o "$ICON_DIR/icon.icns"
    echo "✓ 已创建 icon.icns"
else
    echo "警告: iconutil 命令未找到，无法创建 .icns 文件"
    echo "请手动使用以下命令创建:"
    echo "  iconutil -c icns $ICONSET_DIR -o $ICON_DIR/icon.icns"
fi

# 创建 Windows 图标 (.ico) - 需要 ImageMagick
if command -v convert &> /dev/null; then
    convert "$ICON_DIR/32x32.png" "$ICON_DIR/128x128.png" "$ICON_DIR/icon.png" "$ICON_DIR/icon.ico" 2>/dev/null && echo "✓ 已创建 icon.ico" || echo "警告: 无法创建 .ico 文件"
fi

# 清理临时 iconset 目录
rm -rf "$ICONSET_DIR"

echo ""
echo "✓ 图标创建完成！"
echo "图标文件已保存在: $ICON_DIR"
echo ""
echo "接下来请确保 tauri.conf.json 中的图标配置正确，然后运行打包命令"

