# 立直麻将 · 风向盘

四人各自打开、同步看分的立直麻将计分小游戏，规则大体按 M.League。需求草案见：

- [项目概要.md](./项目概要.md)
- [功能需求.md](./功能需求.md)
- [用户流程.md](./用户流程.md)

当前工程仍是空画布，欢迎文字占位。

## 源码目录

```
├── js
│   └── main.js                // 画布初始化与欢迎页绘制
├── game.js                    // 游戏入口
├── game.json                  // 小游戏运行时配置
├── preview.html               // Cursor / 浏览器画面预览
├── project.config.json        // 微信开发者工具项目配置
└── project.private.config.json
```

## 如何预览

- **完整运行（推荐）**：用[微信开发者工具](https://developers.weixin.qq.com/minigame/dev/devtools/download.html)打开本目录。小游戏依赖 `wx`、`GameGlobal` 等微信运行时，真机能力、登录、分享等都只能在这里调试。
- **Cursor 里看画面**：用 Live Preview / Simple Browser 打开 `preview.html`。这只是一个本地 Canvas 预览，用来看布局和文字，不能替代微信开发者工具。
