---
title: "Agentic RL Infra 问答整理：rollout、TITO、trajectory、MTP"
date: 2026-09-01 12:00:00
categories: ["笔记"]
tags: ["强化学习","LLM"]
---

## 问题

这篇笔记整理围绕 Agentic RL Infra 重构摘要 的连续问答，重点解释以下问题：

- 为什么 Agentic RL 中大家都在拼 rollout 吞吐？
- 为什么异步系统能提速但会让人担心 sample efficiency？
- TITO、tokenizer、工具调用 token 化之间是什么关系？
- 冗余 observation、上下文管理和训推不一致如何影响长程 Agent？
- rollout 为什么常是最大系统瓶颈？
- trajectory、物理解耦、MTP、proposal、autoregressive decoding 串行瓶颈分别是什么意思？

## 简短答案

Agentic RL 训练的对象不是单轮回答，而是一个模型在环境中多轮行动后形成的 trajectory。因此系统瓶颈从单纯的 loss 计算扩展到 rollout、工具调用、环境沙箱、上下文管理、样本版本、reward 验证和推理加速。很多术语都围绕同一件事展开：如何更快、更稳定地产生可训练的 Agent 轨迹，同时不破坏训练分布和策略更新。

## 总框架

Agentic RL 可以简化成这条链路：

```text
任务
-> Agent 组织上下文
-> LLM 生成 action token
-> 工具或环境执行 action
-> 返回 observation
-> Agent 更新状态和上下文
-> 多轮循环形成 trajectory
-> reward / verifier 判断结果
-> RL trainer 用 trajectory 更新模型
```

传统 RLHF 更像：

```text
prompt -> response -> reward -> update
```

Agentic RL 更像：

```text
state -> action -> observation -> state -> action -> observation -> ... -> reward -> update
```

所以 Agentic RL 的难点不只是算法，还包括 infra：rollout 怎么跑、环境怎么隔离、工具调用怎么记录、样本怎么进入训练、权重怎么同步、reward 是否可信。

## 有效训练收益

原文中有一个重要视角：

```text
有效训练收益 = Throughput x Sample Efficiency
```

- `Throughput`：系统每秒能生成或处理多少 token / trajectory。
- `Sample Efficiency`：每条样本是否真的能提升模型。
- `Omega_agent`：系统希望支持的 Agent 集合，包括搜索 Agent、代码 Agent、GUI Agent、黑盒 Agent、多 Agent 等。

这解释了四个常见问题：

- 大家拼 rollout 吞吐，是因为 rollout 往往是 Throughput 的主瓶颈。
- 异步系统提速但让人担心，是因为它可能提高 Throughput，却让样本变旧、变偏、更加 off-policy，从而损害 Sample Efficiency。
- 强调任意 Agent、黑盒 Agent、上下文管理和工具协议，是因为 `Omega_agent` 的外延在扩大，训练系统不能只支持一种固定 Agent loop。
- 同样是加速，有些会伤稳定性，有些不会，是因为加速不能破坏样本分布、reward 语义、策略一致性和最终收敛。

## rollout 为什么是瓶颈

在 Agentic RL 中，rollout 不是让模型生成一段答案，而是让 Agent 在环境中跑完整任务轨迹。

一个 coding agent 的 rollout 可能包括：

```text
读文件
-> 写代码
-> 跑测试
-> 读报错
-> 修改代码
-> 再跑测试
-> 验证通过或失败
```

它慢在几个地方：

- token generation 本身多轮、长上下文、长输出，decode 成本高。
- 工具调用、shell、网页、文件 I/O、沙箱执行不是纯 GPU 矩阵乘法，延迟不可预测。
- reward 常常需要环境验证，例如跑测试、检查网页状态、验证工具结果。
- 长尾严重，有的 episode 几秒完成，有的会因为慢工具、重试、依赖安装、测试超时拖很久。
- group-based rollout 会放大阻塞，例如 GRPO 对同一 prompt 采多条 response，一条慢样本可能拖住整组。

同步训练下，瓶颈尤其明显：

```text
99 条 rollout 已完成
1 条 rollout 还在跑
trainer 必须等这 1 条
GPU 空转
```

因此很多系统会做异步 rollout-training pipeline、sample buffer、环境并行、长尾调度、KV cache 复用和 reward 异步计算。

## 异步为什么又快又危险

同步流程：

```text
rollout 一整批
-> 等全部完成
-> 训练
-> 同步新权重
-> 下一批 rollout
```

异步流程：

```text
rollout workers 持续生产 trajectory
training workers 从 sample buffer 中持续消费 trajectory
```

好处是训练不必等待最慢的 rollout，吞吐更高。风险是训练拿到的样本可能不是当前最新策略生成的：

```text
rollout 侧用 policy v10 生成样本
training 侧已经更新到 policy v13
样本进入训练时已经 stale
```

这会带来：

- off-policy：样本来自旧策略，不完全匹配当前策略。
- 分布偏移：谁先完成谁先训练，会偏向短任务、快任务、稳定环境任务。
- 稳定性问题：旧样本、异常环境样本、策略 mismatch 如果不处理，会让训练信号变差。

所以异步系统通常需要 asynchronous ratio、staleness filter、importance clipping、mask / reweight、异常样本过滤和权重同步。

## 训练和 rollout 的物理解耦

“物理上解耦”不是说 rollout 和 training 没有逻辑关系，而是说它们由不同 worker、进程、GPU 或节点执行，中间通过 buffer 和权重同步连接。

```text
Rollout workers:
持续运行 Agent、调用工具、生成 trajectory

Sample buffer / data pool:
暂存已经完成的 trajectory

Training workers:
取样本、算 loss、反向传播、更新模型

Weight sync:
把新权重同步给 rollout 侧
```

这种结构让 rollout 和 training 并行推进，但必须额外处理 stale sample、policy mismatch、off-policy correction 和故障恢复。

## trajectory 是什么

`trajectory` 是一条完整或部分交互轨迹。经典 RL 中可以写成：

```text
state_0 -> action_0 -> reward_0 -> state_1
        -> action_1 -> reward_1 -> state_2
        -> ...
```

在 Agentic RL 中更接近：

```text
任务开始
-> 当前上下文
-> 模型生成动作
-> 工具或环境返回 observation
-> Agent 更新上下文
-> 模型继续行动
-> ...
-> 最终成功或失败
-> reward
```

一条 trajectory 可能保存：

- prompts / messages
- assistant 生成的 token
- tool calls
- tool results
- environment observations
- rewards
- logprobs
- masks
- model version

RL 用 trajectory 判断哪些动作应该被强化，哪些应该被惩罚。

## TITO 与工具调用如何变成 token

`TITO = Token-In-Token-Out`，意思是训练系统希望 Agent 和模型之间的输入输出都能在 token 层严格对齐。

工具调用本身不是天然 token。它通常先被序列化成文本或结构化 message，再由 tokenizer 切成 token ids：

```text
语义层：我要调用搜索工具
结构层：{"name": "search", "arguments": {"query": "Agentic RL TITO"}}
token 层：这段 JSON / message 被 tokenizer 切成 token ids
```

完整链路：

```text
模型生成 tool_call tokens
-> runtime 解码成文本
-> parser 解析工具名和参数
-> 执行真实工具
-> 工具结果序列化成文本或 message
-> tokenizer 切成 token
-> 作为下一轮上下文喂回模型
```

训练时通常区分：

```text
user tokens: 不训练
assistant tool_call tokens: 训练，属于模型 action
tool_result tokens: 不训练，作为 environment observation
assistant final answer tokens: 视任务而定，可能训练
```

TITO 的难点在于复杂 Agent 会压缩、删除、重写上下文。训练系统如果要求严格 token-level 一致，就要记录哪些 token 是 action、哪些是 observation、哪些被删掉、哪些被 summary 替代、哪些应该参与 loss。这会让 Agent 的上下文管理、prompt 模板、特殊 token、工具格式和 tokenizer 深度耦合。

## 上下文冗余如何导致失焦

Agent 多轮运行后，上下文会不断累积：

```text
原始任务
第 1 轮 observation
第 1 轮中间推理
第 2 轮 observation
第 2 轮中间推理
第 3 轮 observation
第 3 轮中间推理
当前真正关键的信息
```

如果不做上下文管理，关键 token 会被大量低价值 token 淹没。问题不是 attention 数学上简单平均，而是信息密度下降，模型更难稳定找到当前状态下真正重要的 `state-critical tokens`。

典型风险：

- 工具日志、HTML、测试输出、旧 observation 淹没关键证据。
- 旧推理分支虽然已经被证明错误，仍留在上下文中污染后续判断。
- 重复信息让模型误判某些旧线索很重要。
- 关键 observation 出现在很早位置，被后续大量 token 冲淡。

这就是“冗余 observation 和中间推理会让注意力被稀释，导致模型失去焦点”。

## 只在推理阶段做上下文管理为什么会训推不一致

如果训练时模型看到完整历史：

```text
任务 + 所有 observation + 所有中间推理 + 当前问题
```

但推理时系统使用压缩上下文：

```text
任务 + summary memory + 少量关键 observation + 当前问题
```

模型面对的输入分布就变了。

训练时模型学到：

```text
完整历史始终可见
工具结果原样保留
中间推理链一直存在
```

推理时却变成：

```text
旧 observation 被删掉
长日志被 summarize
部分历史被 memory 替代
上下文可能 reset / compress / rewrite
```

这会导致：

- 模型没学过如何信任 summary。
- 模型没学过信息缺失后的决策。
- 模型没学过什么时候 summarize、reset、保留或丢弃。
- RL 的状态转移表示改变，训练时的 `state_{t+1}` 和推理时的 `state_{t+1}` 不再相同。

Forge 把 Context Management 建模为 Agent action，就是让模型在训练时也经历 context switch，学习什么时候压缩、保留、重置上下文，从而减少训推不一致。

## MTP 与 proposal

`MTP = Multi-Token Prediction`，即多 token 预测。

普通自回归模型一次只预测下一个 token：

```text
已有前缀：我 今天 想
预测：吃

已有前缀：我 今天 想 吃
预测：火锅
```

MTP 则希望一次前向同时预测多个未来 token：

```text
已有前缀：我 今天 想
预测 t+1：吃
预测 t+2：火锅
预测 t+3：。
```

`proposal` 是候选续写、草稿、提议的 token 序列。例如：

```text
prefix: 强化学习是一种
proposal: 通过 奖励 信号 学习 策略 的 方法
```

传统 speculative decoding 通常使用小的 draft model 产生 proposal，再由大的 target model 验证。MTP 通常是在主模型 backbone 上增加辅助 `MTP head`，用共享 hidden representation 产生多个未来 token 的 proposal。

区别：

```text
传统 speculative decoding:
proposal 来自独立 draft model

MTP:
proposal 来自主模型上的 auxiliary MTP head
```

共同目标是减少昂贵 target model 的逐 token decode 次数。

## autoregressive decoding 的串行瓶颈

`autoregressive decoding` 指自回归解码。模型生成第 2 个 token 前，必须先知道第 1 个 token；生成第 3 个 token 前，必须先知道第 2 个 token。

例如要生成：

```text
强化学习 是 一种 方法
```

模型必须顺序执行：

```text
step 1: 看到「强化学习」 -> 预测「是」
step 2: 看到「强化学习 是」 -> 预测「一种」
step 3: 看到「强化学习 是 一种」 -> 预测「方法」
```

这就是串行瓶颈：后一步依赖前一步，不能把后面所有 token 完全并行生成。target model 参数大，每次 forward 都贵，所以逐 token 调用会慢。

MTP / speculative decoding 试图把：

```text
target model 跑 10 次，生成 10 个 token
```

变成：

```text
draft / MTP 先猜多个 token
target model 少量几次批量验证这些 token
```

它不是消除自回归，而是减少昂贵 target model 被迫逐 token 串行执行的次数。

## Agentic RL 中 MTP 的特殊问题

在普通 serving 中，target model 通常比较稳定，draft model 或 MTP head 训练好后可以长期使用。

Agentic RL 中，target policy 会持续更新：

```text
policy v10 -> policy v11 -> policy v12 -> ...
```

如果 MTP head 或 draft model 不跟着更新，它提出的 proposal 就会逐渐偏离当前 policy，acceptance rate 下降。这样不仅加速收益变小，还会引入额外计算和显存开销。

因此 Forge 的思路是持续训练 detached MTP head，并用 Top-K KL Loss 让它跟随当前 RL policy。

## 关系图式

```text
Agentic RL
  -> rollout 产出 trajectory
  -> trajectory 包含 action / observation / reward / logprob
  -> action 常表现为 assistant token，包括 tool_call token
  -> observation 常表现为 tool_result / environment output
  -> TITO 试图保证 token-level 对齐
  -> 上下文管理改变 state 表示
  -> 异步 rollout-training 提高吞吐但带来 stale / off-policy
  -> MTP / speculative decoding 加速 rollout 中的 decode
```

## 依据

- Agentic RL Infra 重构：Forge、ROLL、Seer、slime 摘要
- Agentic RL
- LLM 训练
- 强化学习
- slime

## 待验证

- TODO: verify Forge、ROLL、Seer、slime 中 MTP、TITO Gateway、Windowed FIFO、asynchronous ratio 等实现细节需要回到官方博客、论文或代码核对。
- TODO: verify 不同系统对 tool_call tokens、tool_result tokens、loss mask 和 trajectory schema 的具体定义可能不同，本文只整理本轮问答中的共同抽象。
