# Line Art Creator 逻辑改版方案

最后更新: 2026-03-17

## 1. 目标

将当前“用户输入描述后，直接生成最终 SVG line art”的同步单阶段流程，改为“两阶段图像流水线”:

1. 用户输入文本描述
2. 后端调用 Gemini 先生成一张普通图片
3. 后端基于预制 prompt 将普通图片转换成 line art
4. 前端在两个阶段分别向用户反馈状态:
   - 生成图片中...
   - 生成 line art 中...

同时新增“用户从设备上传图片”的入口，使上传图片也能走同一条 line art 转换链路。

## 2. 当前实现现状

当前代码的核心链路如下:

- [app/api/project/revisions/route.ts](/Users/jameshou/Desktop/Repos/Line%20art%20creator/app/api/project/revisions/route.ts)
  - 接收 prompt
  - 直接调用 `createRevision`
- [lib/server/project-store.ts](/Users/jameshou/Desktop/Repos/Line%20art%20creator/lib/server/project-store.ts)
  - 在 `createRevision()` 中同步调用 `generateLineArt()`
  - 只有生成成功后才写入 revision
- [lib/server/line-art-provider.ts](/Users/jameshou/Desktop/Repos/Line%20art%20creator/lib/server/line-art-provider.ts)
  - 当前 Gemini provider 直接产出 SVG 内容
- [components/line-art-workspace.tsx](/Users/jameshou/Desktop/Repos/Line%20art%20creator/components/line-art-workspace.tsx)
  - 前端只有单一 `generating` 状态
  - 通过 optimistic revision + loading SVG 模拟“正在生成”

### 当前问题

1. 生成链路是同步的，无法精确表达中间阶段。
2. provider 直接输出 SVG，不利于切换到“普通图 -> line art”双阶段。
3. revision 数据模型里没有“中间图”概念。
4. 当前没有图片上传入口，也没有图片资产存储方案。
5. 后续如果做“继续修改上一版”，直接修改 line art 会让质量逐步劣化。

## 3. 目标架构

推荐把生成流程改成“异步任务 + revision 状态机”的结构。

### 3.1 文本生成流程

1. 用户提交文本 prompt
2. 后端立即创建一条 revision，状态设为 `queued`
3. 后端启动生成任务
4. 第一阶段调用 Gemini 生成普通图
5. 保存普通图，revision 状态更新为 `generating_line_art`
6. 第二阶段调用 Gemini，将普通图转换为 line art
7. 保存最终图，revision 状态更新为 `ready`

### 3.2 上传图片流程

1. 用户上传设备图片
2. 后端保存原图
3. 创建 revision
4. 直接跳过“普通图生成”阶段
5. 进入 line art 转换阶段
6. 保存最终图，revision 状态更新为 `ready`

### 3.3 后续编辑流程

后续如果用户对当前结果继续发修改指令，建议优先基于“上一版的普通图”继续编辑，再重新转成 line art。

原因:

- 直接基于 line art 再编辑，容易让细节和结构越来越差
- 基于普通图继续编辑，更接近原始语义和视觉结构

## 4. 数据结构改造

建议修改 [lib/domain.ts](/Users/jameshou/Desktop/Repos/Line%20art%20creator/lib/domain.ts)。

### 4.1 RevisionStatus

当前:

```ts
type RevisionStatus = "ready" | "generating" | "failed";
```

建议改为:

```ts
type RevisionStatus =
  | "queued"
  | "generating_source_image"
  | "generating_line_art"
  | "ready"
  | "failed";
```

### 4.2 Revision

建议新增字段:

```ts
type Revision = {
  id: string;
  parentRevisionId: string | null;
  title: string;
  prompt: string;
  editInstruction: string | null;
  status: RevisionStatus;
  createdAt: string;

  sourceType: "prompt" | "upload" | "revision";
  sourceImageUrl: string | null;
  imageUrl: string;
  thumbnailUrl: string;

  modelName: string;
  jobId: string | null;
  errorMessage: string | null;
};
```

字段说明:

- `sourceType`: 这次 revision 的来源
- `sourceImageUrl`: 普通图阶段结果，或上传原图
- `imageUrl`: 最终 line art 图
- `jobId`: 关联后台任务
- `errorMessage`: 失败时给前端展示

### 4.3 Message

当前 `status` message 只有一段文字。建议为状态消息增加结构化阶段字段:

```ts
type AssistantStatusPhase =
  | "queued"
  | "generating_source_image"
  | "generating_line_art"
  | "failed";
```

这样前端无需靠自由文本猜状态。

## 5. 后端模块拆分

建议把当前 [lib/server/line-art-provider.ts](/Users/jameshou/Desktop/Repos/Line%20art%20creator/lib/server/line-art-provider.ts) 拆成更清晰的结构。

### 5.1 推荐模块

- `lib/server/revision-service.ts`
  - 创建 revision
  - 更新 revision 状态
  - 写消息

- `lib/server/generation-job.ts`
  - 运行双阶段任务
  - 处理失败和重试

- `lib/server/gemini-provider.ts`
  - `generateSourceImage(prompt)`
  - `convertToLineArt(image, instruction?)`
  - 后续可扩展 `editSourceImage(image, prompt)`

- `lib/server/asset-store.ts`
  - 保存上传图片
  - 保存阶段一普通图
  - 保存最终 line art 图

### 5.2 为什么不要继续沿用当前 provider 设计

当前 provider 的职责是“收到 prompt，直接返回最终结果”。新需求下它至少要能处理两类能力:

1. 文本到普通图
2. 图片到 line art

继续把两步挤在一个 `generate()` 里，后面会越来越难维护。

## 6. API 改造

### 6.1 创建 revision

保留现有入口，但改成异步任务式:

- `POST /api/project/revisions`

文本模式请求体:

```json
{
  "mode": "prompt",
  "prompt": "一只在花园里晒太阳的猫",
  "parentRevisionId": null
}
```

上传模式建议改为 `multipart/form-data`:

- `file`
- `prompt` 可选
- `parentRevisionId` 可选

返回值:

```json
{
  "revisionId": "rev_xxx",
  "jobId": "job_xxx",
  "project": {}
}
```

### 6.2 查询 revision 状态

新增:

- `GET /api/project/revisions/:revisionId`

用途:

- 轮询 revision 当前状态
- 获取阶段一图片
- 获取最终图片
- 获取错误信息

### 6.3 重试

新增:

- `POST /api/project/revisions/:revisionId/retry`

用途:

- Gemini 阶段失败后可重试
- 不丢失 revision 历史

## 7. 存储方案

当前项目只把项目数据写到:

- [data/project.json](/Users/jameshou/Desktop/Repos/Line%20art%20creator/data/project.json)

这对文本 metadata 足够，但对图片资产不够。

### 7.1 MVP 方案

新增目录:

- `data/assets/uploads/`
- `data/assets/source/`
- `data/assets/final/`

写入规则:

- 上传原图保存到 `uploads`
- 第一阶段普通图保存到 `source`
- 最终 line art 保存到 `final`

project.json 中只记录访问路径，不直接存大块 base64。

### 7.2 为什么不要继续把大图塞进 JSON

1. 文件会迅速膨胀
2. 每次写入都要重写整个 project.json
3. 后面做多阶段更新时容易冲突

## 8. 前端需要配合的最小改动

虽然这次重点不在前端，但前端必须配合 revision 状态机。

涉及文件:

- [components/line-art-workspace.tsx](/Users/jameshou/Desktop/Repos/Line%20art%20creator/components/line-art-workspace.tsx)

### 8.1 状态展示

根据 revision.status 展示:

- `queued`: 准备中...
- `generating_source_image`: 生成图片中...
- `generating_line_art`: 生成 line art 中...
- `failed`: 生成失败
- `ready`: 正常展示

### 8.2 上传入口

新增一个从设备选择图片的入口:

- `<input type="file" accept="image/*" />`

最小要求:

- 支持 JPG / PNG / WEBP
- 上传后立即创建 revision
- 进入 line art 阶段

### 8.3 查询方式

推荐轮询而不是 SSE。

原因:

1. 与当前项目结构更兼容
2. 实现复杂度低
3. 更容易调试

建议策略:

- 创建 revision 后每 1 到 2 秒请求一次 revision 状态
- 到 `ready` 或 `failed` 时停止轮询

## 9. Gemini 集成建议

截至 2026-03-17，Google 官方推荐使用 `@google/genai` 作为新的 SDK 入口，而不是继续使用旧的 `@google/generative-ai`。

当前 [package.json](/Users/jameshou/Desktop/Repos/Line%20art%20creator/package.json) 中仍然使用:

```json
"@google/generative-ai": "^0.24.1"
```

建议在这次改版时一起迁移。

### 9.1 模型配置建议

不要把模型名硬编码进业务逻辑，建议使用环境变量:

```env
GEMINI_SOURCE_IMAGE_MODEL=...
GEMINI_LINE_ART_MODEL=...
```

### 9.2 Prompt 策略

建议将 prompt 分成两类:

1. `buildSourceImagePrompt(userPrompt)`
   - 负责把用户描述生成普通图
   - 强调主体、构图、风格和可编辑性

2. `LINE_ART_TRANSFORM_PROMPT`
   - 固定模板
   - 负责把输入图片转换为干净、适合打印的 line art
   - 控制线条粗细、背景简化、去阴影、保留主体结构

## 10. 实施步骤

### 阶段 1: 数据模型和存储

1. 扩展 `RevisionStatus`
2. 给 `Revision` 增加 `sourceImageUrl`、`jobId`、`errorMessage`
3. 把图片从 JSON base64 改为文件存储

### 阶段 2: Provider 拆分

1. 从当前 `generateLineArt()` 中拆出
   - 普通图生成
   - line art 转换
2. 把 prompt 模板分离成独立函数或常量

### 阶段 3: 异步任务化

1. `POST /api/project/revisions` 只负责创建任务
2. 任务在后台推进 revision 状态
3. 新增 revision 状态查询接口

### 阶段 4: 上传支持

1. 支持设备图片上传
2. 接入 asset storage
3. 上传图片直接进入 line art 转换阶段

### 阶段 5: 前端接入

1. 根据 revision 状态展示两阶段文案
2. 增加上传入口
3. 增加轮询逻辑

### 阶段 6: 失败处理和重试

1. 每阶段记录错误
2. 允许 retry
3. 不覆盖已有 revision 历史

## 11. 风险与注意事项

### 11.1 并发写入

当前 `project.json` 是整文件读写。改成异步任务后，如果多个任务同时更新同一个项目，容易互相覆盖。

建议:

- MVP 阶段至少加一个简单写锁
- 后续可迁移到 SQLite 或正式数据库

### 11.2 生成时长

双阶段一定比当前更慢。

所以必须:

- 立即返回 revision
- 前端展示阶段状态
- 支持失败重试

### 11.3 输出风格稳定性

line art 转换的稳定性会直接决定产品质量。

建议:

- 固化 line art 转换 prompt
- 不把风格控制交给用户自由发挥
- 后续再开放少量可控风格参数

## 12. 最终建议

这次改版的关键不是“换个 API 调用”，而是把产品逻辑升级成“可观测的双阶段流水线”。

最重要的三个决定:

1. revision 必须能表达多阶段状态
2. 必须保存中间普通图
3. 必须把生成改成异步任务，而不是单请求同步等待

如果按这个方向推进，当前项目可以在尽量少推翻 UI 的前提下，顺利支持:

- 文本生成普通图再转 line art
- 上传图片直接转 line art
- 更稳定的后续编辑
- 更清晰的生成状态反馈

## 13. 参考资料

- Google Gemini 图片生成文档: https://ai.google.dev/gemini-api/docs/image-generation
- Google Gemini SDK 文档: https://ai.google.dev/gemini-api/docs/libraries
- Google Gemini 图片理解与图片输入文档: https://ai.google.dev/gemini-api/docs/image-understanding
