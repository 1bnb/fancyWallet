# fancy-wallet Mac 打包指南

本文档说明如何为 fancy-wallet 创建新图标并打包成 Mac 版本。

## 📋 前置要求

1. **macOS 系统**（打包 Mac 版本需要在 macOS 上运行）
2. **Node.js 和 pnpm**（用于构建前端）
3. **Rust 工具链**（用于构建后端）
4. **Tauri CLI**（已包含在项目依赖中）

## 🎨 第一步：创建新图标

### 方法 1：使用自动脚本（推荐）

1. 准备一个源图标文件（建议 1024x1024 像素的正方形 PNG 图片）

2. 运行图标创建脚本：

```bash
chmod +x create-icon.sh
./create-icon.sh path/to/your-icon.png
```

脚本会自动创建以下图标文件：
- `32x32.png` - 32x32 像素图标
- `128x128.png` - 128x128 像素图标
- `128x128@2x.png` - 256x256 像素（高分辨率）
- `icon.png` - 原始图标
- `icon.icns` - Mac 图标集（用于 macOS）
- `icon.ico` - Windows 图标（如果安装了 ImageMagick）

### 方法 2：手动创建图标

如果需要手动创建图标，请按以下步骤操作：

#### 创建 .icns 文件（Mac 专用）

1. 创建一个临时目录：
```bash
mkdir -p src-tauri/icons/icon.iconset
```

2. 创建各种尺寸的图标文件：
```bash
# 使用 sips（macOS 自带）或 ImageMagick 的 convert 命令
sips -z 16 16 your-icon.png --out src-tauri/icons/icon.iconset/icon_16x16.png
sips -z 32 32 your-icon.png --out src-tauri/icons/icon.iconset/icon_16x16@2x.png
sips -z 32 32 your-icon.png --out src-tauri/icons/icon.iconset/icon_32x32.png
sips -z 64 64 your-icon.png --out src-tauri/icons/icon.iconset/icon_32x32@2x.png
sips -z 128 128 your-icon.png --out src-tauri/icons/icon.iconset/icon_128x128.png
sips -z 256 256 your-icon.png --out src-tauri/icons/icon.iconset/icon_128x128@2x.png
sips -z 256 256 your-icon.png --out src-tauri/icons/icon.iconset/icon_256x256.png
sips -z 512 512 your-icon.png --out src-tauri/icons/icon.iconset/icon_256x256@2x.png
sips -z 512 512 your-icon.png --out src-tauri/icons/icon.iconset/icon_512x512.png
sips -z 1024 1024 your-icon.png --out src-tauri/icons/icon.iconset/icon_512x512@2x.png
```

3. 使用 iconutil 创建 .icns 文件：
```bash
iconutil -c icns src-tauri/icons/icon.iconset -o src-tauri/icons/icon.icns
```

4. 清理临时目录：
```bash
rm -rf src-tauri/icons/icon.iconset
```

#### 创建其他格式

```bash
# PNG 格式
sips -z 32 32 your-icon.png --out src-tauri/icons/32x32.png
sips -z 128 128 your-icon.png --out src-tauri/icons/128x128.png
sips -z 256 256 your-icon.png --out src-tauri/icons/128x128@2x.png
cp your-icon.png src-tauri/icons/icon.png

# Windows ICO 格式（需要 ImageMagick）
convert src-tauri/icons/32x32.png src-tauri/icons/128x128.png src-tauri/icons/icon.png src-tauri/icons/icon.ico
```

## ⚙️ 第二步：验证图标配置

确保 `src-tauri/tauri.conf.json` 中的图标配置正确：

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ]
}
```

## 🚀 第三步：打包 Mac 版本

### 开发模式运行

```bash
# 安装依赖（如果还没安装）
pnpm install

# 运行开发模式
pnpm tauri dev
```

### 构建生产版本

#### 仅构建 Mac 版本

```bash
pnpm tauri build
```

默认会构建所有平台。如果只想构建 Mac 版本，可以指定目标：

```bash
pnpm tauri build --target universal-apple-darwin
```

或者构建特定架构：

```bash
# Intel Mac
pnpm tauri build --target x86_64-apple-darwin

# Apple Silicon (M1/M2/M3)
pnpm tauri build --target aarch64-apple-darwin

# 通用二进制（同时支持 Intel 和 Apple Silicon）
pnpm tauri build --target universal-apple-darwin
```

### 构建产物位置

打包完成后，构建产物位于：

```
src-tauri/target/[target-triple]/release/bundle/
```

其中 `target-triple` 可能是：
- `x86_64-apple-darwin` (Intel Mac)
- `aarch64-apple-darwin` (Apple Silicon)
- `universal-apple-darwin` (通用二进制)

在 `bundle/` 目录下会有：
- `macos/` - macOS 应用包
  - `fancy-wallet.app` - 可执行的应用包
  - `fancy-wallet_*.dmg` - DMG 安装镜像（如果启用了 DMG 打包）

## 📦 打包选项配置

可以在 `tauri.conf.json` 中配置打包选项：

```json
{
  "bundle": {
    "active": true,
    "targets": ["dmg", "app"],  // 可选: "app", "dmg", "zip"
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOSPrivateApi": false,
    "copyright": "",
    "category": "public.app-category.utilities"
  }
}
```

### DMG 配置（可选）

要生成 DMG 安装镜像，确保配置中包含：

```json
{
  "bundle": {
    "targets": ["dmg"],
    // ... 其他配置
  }
}
```

## 🔧 常见问题

### 1. 图标显示不正确

- 确保所有图标文件存在于 `src-tauri/icons/` 目录
- 检查 `tauri.conf.json` 中的图标路径是否正确
- 删除 `src-tauri/target/` 目录并重新构建

### 2. 构建失败

- 确保 Rust 工具链已正确安装：`rustc --version`
- 确保所有依赖已安装：`pnpm install`
- 检查是否有编译错误：`pnpm tauri build --verbose`

### 3. 应用无法运行

- 检查 macOS 安全设置（可能需要在"系统设置 > 隐私与安全性"中允许应用运行）
- 使用控制台查看错误信息：`Console.app`

### 4. 创建 .icns 文件失败

如果 `iconutil` 命令不可用，可以：
- 使用在线工具：[icnsconverter](https://cloudconvert.com/png-to-icns) 或 [iconverticons](https://iconverticons.com/)
- 安装 ImageMagick：`brew install imagemagick`

## 📚 参考资料

- [Tauri 官方文档](https://tauri.app/)
- [Tauri 打包指南](https://tauri.app/v1/guides/building/)
- [macOS 图标制作指南](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/OptimizingforHighResolution/OptimizingforHighResolution.html)

