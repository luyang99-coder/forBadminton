# 羽毛球打转 - 羽毛球均衡轮转微信小程序

一款基于微信云开发的羽毛球活动管理小程序，自动生成公平轮转赛程。

## 🏸 功能

- **活动管理**: 发起羽毛球活动，管理报名名单
- **自动排阵**: 根据人数、场地数自动生成公平轮转，支持多种约束条件
- **让分机制**: 男双vs混双、男双vs女双、混双vs女双自动让分
- **比分录入**: 轮转队员或管理员可实时录入比分
- **统计复盘**: 胜率、净胜分、最佳搭档、最均衡对局等全面统计
- **云端同步**: 数据自动同步至微信云开发，多设备共享
- **报名码/海报**: 生成活动二维码分享给球友

## 🚀 快速开始

### 前置条件

1. [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 
2. 注册微信小程序并获取 AppID（当前配置：`wx46db5d61e7b61d45`）
3. 开通微信云开发（CloudBase）

### 本地运行

```bash
# 打开项目
C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat open --project ./
```

或在开发者工具中：**导入项目** → 选择本项目目录

### 云函数部署

```bash
cd cloudfunctions/activityService
npm install
```

在开发者工具中右键 `cloudfunctions/activityService` → **上传并部署**

## 📁 项目结构

```
forBadminton/
├── app.js                    # 应用入口
├── app.json                  # 应用配置
├── app.wxss                  # 全局样式
├── project.config.json       # 项目配置
├── pages/
│   └── index/
│       ├── index.js          # 主页面逻辑（约2000行）
│       ├── index.wxml        # 主页面模板
│       ├── index.wxss        # 主页面样式（全局复用）
│       ├── index.json        # 页面配置
│       └── modules/
│           ├── config.js     # 配置常量
│           ├── player.js     # 玩家工具函数
│           ├── roster.js     # 名单管理
│           ├── schedule.js   # 排阵算法（核心）
│           ├── system.js     # 系统信息
│           └── qr.js         # 二维码生成
├── cloudfunctions/
│   └── activityService/      # 云函数
│       ├── index.js
│       ├── package.json
│       └── roster.js
└── sitemap.json
```

## 🧠 排阵算法

基于贪心搜索的轮转排阵，核心特点：

- **公平性优先**: 每位队员上场次数尽可能均衡
- **重复最小化**: 减少相同搭档、相同对手重复出现
- **技能平衡**: 强弱搭配，避免实力悬殊
- **多重约束**: 支持固定搭档、避免搭档、指定休息等
- **让分配置**: 根据组合类型自动计算让分

算法执行多次（10-14次）随机搜索，选取最优解。

## 🛠️ 技术栈

- **前端**: 微信小程序原生框架 (WXML + WXSS + JS)
- **后端**: 微信云开发 (CloudBase)
- **云函数**: Node.js (wx-server-sdk)
- **数据库**: CloudBase Document Database

## 🐛 已知问题

- 无（欢迎提交 Issue）

## 📄 许可

MIT
