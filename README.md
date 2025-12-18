# 改图工匠 / PConverter

<div align="center">

![React](https://img.shields.io/badge/React-19.2.1-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

**一款功能强大、界面精美的在线图片处理工具**

[简体中文](#简体中文) | [English](#english)

</div>

---

## 简体中文

### ✨ 功能特性

#### 🎨 图片编辑
- **智能裁切** - 支持自由裁切和锁定比例裁切，实时预览
- **旋转变换** - 90° 快速旋转，精确到像素
- **镜像翻转** - 水平/垂直翻转，轻松实现对称效果
- **撤销重做** - 支持最多 50 步历史记录，快捷键 Ctrl+Z / Ctrl+Shift+Z

#### 💧 水印功能
- **文字水印** - 平铺式水印布局，防止盗图
- **自定义样式** - 可调整颜色、透明度、旋转角度
- **灵活间距** - 支持横向和纵向间距独立调节
- **实时预览** - 所见即所得的水印效果预览

#### 🎯 智能导出
- **多格式支持** - JPEG、PNG、WebP 多种格式任选
- **质量控制** - 精确调整图片质量，平衡文件大小与画质
- **目标尺寸** - 智能压缩至指定文件大小（支持 KB/MB）
- **分辨率调整** - 自定义输出宽高，智能保持比例

#### 🖼️ 用户体验
- **拖拽上传** - 支持批量拖拽上传图片
- **触摸优化** - 完美支持移动端触摸缩放和拖拽
- **画布缩放** - 鼠标滚轮或触摸捏合缩放（0.5x - 3x）
- **精美背景** - 渐变背景配合点阵装饰，视觉体验出色
- **双语支持** - 中文/英文界面无缝切换

### 🚀 快速开始

#### 安装依赖

```bash
npm install
```

#### 启动开发服务器

```bash
npm run dev
```

#### 构建生产版本

```bash
npm run build
```

#### 预览构建结果

```bash
npm run preview
```

### 📦 技术栈

- **React 19.2** - 现代化的 UI 框架
- **TypeScript** - 类型安全的开发体验
- **Vite** - 极速的构建工具
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Canvas API** - 高性能图像处理

### 🎮 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Z` | 撤销 |
| `Ctrl + Shift + Z` | 重做 |

### 📱 浏览器支持

- Chrome / Edge (推荐)
- Firefox
- Safari
- 移动端浏览器

### 🔧 项目结构

```
collagepro-converter/
├── components/          # React 组件
│   ├── CanvasEditor.tsx    # 画布编辑器
│   ├── Dropzone.tsx        # 文件拖拽区
│   ├── Icon.tsx            # 图标组件
│   └── SettingsPanel.tsx   # 设置面板
├── services/           # 服务层
│   └── imageUtils.ts      # 图片处理工具
├── App.tsx             # 主应用组件
├── types.ts            # TypeScript 类型定义
├── locales.ts          # 国际化配置
└── index.html          # HTML 入口
```

### 📄 许可证

MIT License

---

## English

### ✨ Features

#### 🎨 Image Editing
- **Smart Cropping** - Free crop with aspect ratio lock support and real-time preview
- **Rotation** - Quick 90° rotation with pixel-perfect precision
- **Flip** - Horizontal/Vertical flipping for symmetrical effects
- **Undo/Redo** - Support up to 50 history steps with Ctrl+Z / Ctrl+Shift+Z

#### 💧 Watermark
- **Text Watermark** - Tiled watermark layout for image protection
- **Custom Styling** - Adjustable color, opacity, and rotation angle
- **Flexible Spacing** - Independent horizontal and vertical spacing control
- **Live Preview** - WYSIWYG watermark effect preview

#### 🎯 Smart Export
- **Multi-Format** - JPEG, PNG, WebP formats available
- **Quality Control** - Fine-tune image quality to balance size and clarity
- **Target Size** - Smart compression to specified file size (KB/MB)
- **Resolution Adjustment** - Custom output dimensions with aspect ratio lock

#### 🖼️ User Experience
- **Drag & Drop** - Batch upload with drag and drop support
- **Touch Optimized** - Perfect mobile touch zoom and pan support
- **Canvas Zoom** - Mouse wheel or pinch-to-zoom (0.5x - 3x)
- **Beautiful UI** - Gradient background with dot pattern decoration
- **Bilingual** - Seamless switching between Chinese and English

### 🚀 Quick Start

#### Install Dependencies

```bash
npm install
```

#### Start Development Server

```bash
npm run dev
```

#### Build for Production

```bash
npm run build
```

#### Preview Build

```bash
npm run preview
```

### 📦 Tech Stack

- **React 19.2** - Modern UI framework
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Canvas API** - High-performance image processing

### 🎮 Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` | Redo |

### 📱 Browser Support

- Chrome / Edge (Recommended)
- Firefox
- Safari
- Mobile browsers

### 🔧 Project Structure

```
collagepro-converter/
├── components/          # React components
│   ├── CanvasEditor.tsx    # Canvas editor
│   ├── Dropzone.tsx        # File drop zone
│   ├── Icon.tsx            # Icon components
│   └── SettingsPanel.tsx   # Settings panel
├── services/           # Services
│   └── imageUtils.ts      # Image utilities
├── App.tsx             # Main app component
├── types.ts            # TypeScript definitions
├── locales.ts          # i18n configuration
└── index.html          # HTML entry
```

### 📄 License

MIT License

---

<div align="center">

**Made with ❤️ using React & TypeScript**

Version 1.3.0

</div>
