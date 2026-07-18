# AI Story Lab

一个面向氛围感内容爱好者的 AI 互动故事 MVP。用户在免登录手机网页中填写主题、主角和风格，由本地 Mock 生成分支故事，通过两次选择到达不同结局。

当前版本已实现首条完整垂直切片。故事和当前节点保存在浏览器 LocalStorage 中，不调用任何外部 AI API。

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
app/            Next.js 创作页、游玩页、布局和全局样式
components/     创作表单与故事播放器
lib/            Zod Schema、Mock 生成器、分支推进和本地会话
docs/           产品定义、决策和 AI 输出评测标准
public/         后续使用的预制静态素材
AGENTS.md       项目范围与开发约束
```

仓库不会仅为占位创建空目录，因此 `public/` 会在加入实际素材时出现。

## 当前范围

第一版只验证单个本地生成故事的“设定—游玩—结局”体验。以下能力不在当前范围内：

- 外部 AI API
- 登录和账户体系
- 数据库及跨会话状态
- 支付和商业化
- 管理后台
- 多故事管理、自由聊天、复杂分支或实时图片生成

## 当前交互流程

1. 在首页填写故事主题、主角名字、主角身份和故事风格。
2. 点击“生成故事”，进入本地 Mock 生成的分支故事。
3. 连续完成两次二选一，到达结局。
4. 刷新游玩页可恢复当前进度；点击“重新创作”清除当前故事并返回首页。

完整产品范围和验收标准参见 [`docs/PRODUCT.md`](docs/PRODUCT.md)，重要决策参见 [`docs/DECISIONS.md`](docs/DECISIONS.md)。
