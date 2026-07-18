# AI Story Lab

一个面向氛围感内容爱好者的 AI 互动故事 MVP。用户将在免登录手机网页中，用约三分钟完成一个都市奇幻治愈故事，通过两次选择获得专属结局卡。

当前版本完成了最小工程初始化和产品首页，不包含完整故事交互，也不调用任何外部 AI API。

## 技术栈

- Next.js（App Router）
- TypeScript
- Tailwind CSS
- Zod
- Vitest

## 本地运行

需要 Node.js 20.9 或更高版本，以及 npm。

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看首页。

## 验证命令

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Vitest 监听模式：

```bash
npm run test:watch
```

## 目录说明

```text
app/            Next.js 页面、布局和全局样式
lib/            Zod schema 与本地领域逻辑
docs/           产品定义、决策和 AI 输出评测标准
public/         后续使用的预制静态素材
AGENTS.md       项目范围与开发约束
```

仓库不会仅为占位创建空目录，因此 `public/` 会在加入实际素材时出现。

## 当前范围

第一版只验证一条都市奇幻治愈故事的三分钟体验。以下能力不在当前范围内：

- 外部 AI API
- 登录和账户体系
- 数据库及跨会话状态
- 支付和商业化
- 管理后台
- 多故事、自由聊天、复杂分支或实时图片生成

完整产品范围和验收标准参见 [`docs/PRODUCT.md`](docs/PRODUCT.md)，重要决策参见 [`docs/DECISIONS.md`](docs/DECISIONS.md)。
