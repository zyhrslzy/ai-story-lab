# AI Story Lab

一个面向氛围感内容爱好者的 AI 互动故事 MVP。用户在免登录手机网页中填写主题、主角和风格，由可替换的服务端生成器产出分支故事，通过两次选择到达不同结局。

当前版本已实现首条完整垂直切片和服务端 OpenAI 生成层。项目默认使用 Mock；显式配置 AI 模式后才会调用 OpenAI。故事和当前节点仍保存在浏览器 LocalStorage 中。

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

## 故事生成模式

复制环境变量示例：

```bash
cp .env.example .env.local
```

默认的 `STORY_GENERATOR_MODE=mock` 不需要 API Key。若要使用 OpenAI，在 `.env.local` 中设置：

```dotenv
STORY_GENERATOR_MODE=ai
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-5.6-terra
```

API Key 只由服务端读取。缺少 Key 不影响项目启动；在 AI 模式提交生成请求时会显示配置错误。

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
app/            Next.js 页面、布局、全局样式和服务端 API
components/     创作表单与故事播放器
lib/            Zod Schema、Mock/OpenAI 生成器、分支推进和本地会话
docs/           产品定义、决策和 AI 输出评测标准
public/         后续使用的预制静态素材
AGENTS.md       项目范围与开发约束
```

仓库不会仅为占位创建空目录，因此 `public/` 会在加入实际素材时出现。

## 当前范围

第一版只验证单个生成故事的“设定—游玩—结局”体验。以下能力不在当前范围内：

- OpenAI 以外的模型供应商和浏览器端模型调用
- 登录和账户体系
- 数据库及跨会话状态
- 支付和商业化
- 管理后台
- 多故事管理、自由聊天、复杂分支或实时图片生成

## 当前交互流程

1. 在首页填写故事主题、主角名字、主角身份和故事风格。
2. 点击“生成故事”，服务端使用当前配置的 Mock 或 OpenAI 生成分支故事。
3. 连续完成两次二选一，到达结局。
4. 刷新游玩页可恢复当前进度；点击“重新创作”清除当前故事并返回首页。

完整产品范围和验收标准参见 [`docs/PRODUCT.md`](docs/PRODUCT.md)，重要决策参见 [`docs/DECISIONS.md`](docs/DECISIONS.md)。
