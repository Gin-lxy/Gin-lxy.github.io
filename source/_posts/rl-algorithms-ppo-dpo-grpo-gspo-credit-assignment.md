---
title: "LLM 强化学习算法笔记：PPO、DPO、GRPO、GSPO 与细粒度信用分配"
date: 2026-09-29 12:00:00
categories: ["笔记"]
tags: ["强化学习","LLM"]
---

> **范围与证据说明**
>
> 这是一篇面向 **LLM 后训练和 Agentic RL** 的算法笔记，不是覆盖 Q-learning、SAC 等全部经典 RL 方法的通史。主线来自知乎原文及其 单源摘要；关于 credit assignment、VinePPO、GiGPO、SPO、低概率 token 和 SLCA-GRPO 的部分来自本轮对话综合，并用原论文或本地精读材料交叉核对。verl 的文件位置、默认参数和功能开关会随版本变化，本文只把它们当作理解工程结构的入口，不当作永久 API 文档。

## 核心结论

1. **Reward、return、value 和 advantage 不是同一个量。** Reward 是环境当下给出的反馈；return 是未来 reward 的累计；value 是策略在某个状态下的期望 return；advantage 则回答“这个动作比当前策略的平均选择好多少”。
2. **Credit assignment 是把最终成败归因给此前决策。** 在 LLM 中，决策可以是 token、推理步骤、工具动作、连续 segment 或完整 response。advantage 是实现信用分配的主要数值载体。
3. **PPO、GRPO 和 GSPO不能只按名称横向比较。** PPO 主要用 critic + GAE 估计 token 级 advantage；GRPO 用同 prompt 的组内 reward 构造 trajectory advantage；GSPO通常沿用组内 advantage，但把重要性比、clipping 和优化单位改到 sequence 级。
4. **DPO 是另一条训练路线。** 它直接使用离线偏好对优化策略，不需要在线 rollout、显式 reward model 或 advantage 估计，因此不属于“怎样把一条在线 reward 分给各 token”的直接解法。
5. **GRPO 省掉 critic，但没有自动解决细粒度信用分配。** 若整条回答只有一个 advantage，并将其广播给全部 token，那么正确过程中的偶然错误和错误过程中的偶然正确都会被同方向更新。
6. **VinePPO、GiGPO、SPO 沿时间轴细化 credit。** 它们分别利用中间状态的额外 MC continuation、已有轨迹中的重复状态、以及连续 segment 的 MC value difference，把 trajectory 信号细化为 step/segment 信号。
7. **SLCA-GRPO 沿结构轴隔离 credit。** 它不判断“第几步更重要”，而是先区分工具执行 token 与最终总结 token，让执行奖励和总结奖励只更新各自的结构区域。
8. **低概率 token 只是潜在分支点，不天然等于关键推理。** 低概率使“大 advantage”在数学上成为可能，但不能证明这个 token 对最终结果有因果作用；需要 continuation value、对照 rollout 或其他验证信号确认。

## 1. 先把算法放进同一个坐标系

理解 LLM RL 时，最好先问四个不同的问题：

| 层面 | 要回答的问题 | 典型方法 |
|---|---|---|
| 反馈来源 | 怎样判断输出好不好？ | 规则验证器、reward model、LLM judge、偏好对、过程奖励 |
| Advantage 估计 | 这次动作比 baseline 好多少？ | GAE、GRPO、RLOO、VinePPO、GiGPO、SPO |
| 策略更新 | 新旧策略概率变化怎样进入 loss？ | PPO token-level clip、GSPO sequence-level clip、KL regularization |
| 信用路由 | 哪一种 reward 应更新哪些 token？ | trajectory 广播、step/segment credit、SLCA 结构分流 |

知乎原文对 verl 的概括很有用：大量算法差异可以拆成 **advantage estimator** 与 **policy loss** 两个可替换组件。但这只是工程主干，不代表所有算法都只差这两个函数。例如 DPO 需要偏好对数据流，VinePPO/SPO 还改变了 rollout 或 value estimation 的方式，SLCA 则需要 segment mask 和分段 reward。

一个更准确的关系是：

```text
prompt / environment
        ↓
rollout：采到哪些轨迹、是否从中间状态继续采样
        ↓
reward：结果分、过程分、偏好或验证器信号
        ↓
advantage：相对什么 baseline，在哪个粒度估计
        ↓
credit routing：把哪种 advantage 交给哪些 token / step / segment
        ↓
policy loss：token ratio 还是 sequence ratio，如何 clip、聚合和加 KL
        ↓
actor update
```

## 2. Credit assignment 的基础语言

### 2.1 把语言生成写成 MDP

给定 prompt $x$，在第 $t$ 个生成位置：

- 状态：$s_t=(x,y_{<t})$，即 prompt 和已经生成的前缀；
- 动作：$a_t=y_t$，即下一个 token；
- 策略：$\pi_\theta(a_t\mid s_t)$；
- 转移：把新 token 拼到前缀上得到 $s_{t+1}$；
- 奖励：$r_t$，可能每步都有，也可能只在结束时出现。

工具调用 Agent 还有更自然的高层动作：一次搜索、一次点击、一次 API 调用或一段最终总结。token 级 MDP 仍然成立，但实际的语义决策往往跨越多个 token。

### 2.2 Reward、return、value、Q 和 advantage

从时刻 $t$ 开始的累计回报为：

$$
G_t=\sum_{k=t}^{T}\gamma^{k-t}r_k
$$

状态价值与动作价值分别是：

$$
V^\pi(s)=\mathbb{E}_\pi[G_t\mid s_t=s]
$$

$$
Q^\pi(s,a)=\mathbb{E}_\pi[G_t\mid s_t=s,a_t=a]
$$

优势函数为：

$$
A^\pi(s,a)=Q^\pi(s,a)-V^\pi(s)
$$

因此：

- $A>0$：该动作比当前策略在同一状态下的平均选择更好；
- $A<0$：该动作比平均选择更差；
- $A=0$：它没有提供超出 baseline 的证据。

对确定性语言转移，有：

$$
A(s_t,a_t)=r_t+\gamma V(s_{t+1})-V(s_t)
$$

在中间 reward 为 0、$gamma=1$ 时，进一步化为：

$$
A(s_t,a_t)=V(s_{t+1})-V(s_t)
$$

这正是 **segment advantage** 的来源：一段文本或一个动作把状态从 segment 开头推进到结尾，它的价值就是前后成功概率或期望回报的增量。

### 2.3 Credit assignment 到底是什么意思

策略梯度的基本形式是：

$$
\nabla_\theta J(\theta)=\mathbb{E}\left[\sum_t \nabla_\theta\log\pi_\theta(a_t\mid s_t)\,A_t\right]
$$

梯度只知道两个东西：

1. 哪个动作是模型当时采出来的；
2. 这个动作被乘上什么 $A_t$。

所以 credit assignment 的实质是：**构造尽可能可信的 $A_t$，让真正促成成功的决策得到正权重，让导致失败的决策得到负权重，并避免无关信号污染它们。**

例如，一条工具轨迹先错误地调用了搜索 API，又正确调用价格 API，最后靠总结模型写出一个流畅答案。若只给整条轨迹一个正 advantage，那么第一个错误调用也会被强化。这不是 reward 本身一定错了，而是 credit 的分辨率和路由方式太粗。

## 3. PPO：critic 负责细粒度 advantage，clip 负责稳定更新

### 3.1 PPO 解决两个问题

朴素 REINFORCE 直接用完整轨迹 return 加权每个动作，方差很大；同一批数据上更新过猛，又会让新策略偏离采样策略太远。PPO 的两部分分别应对这两个问题：

- 用 critic 和 GAE 构造更低方差的 token-level advantage；
- 用新旧策略概率比和 clipping 限制单轮更新。

新旧策略的 token 级重要性比为：

$$
\rho_t(\theta)=\frac{\pi_\theta(a_t\mid s_t)}{\pi_{\theta_{\mathrm{old}}}(a_t\mid s_t)}
$$

PPO-Clip 目标为：

$$
J_{\mathrm{clip}}(\theta)=\mathbb{E}_t\left[
\min\left(
\rho_t(\theta)\hat A_t,
\operatorname{clip}(\rho_t(\theta),1-\epsilon,1+\epsilon)\hat A_t
\right)
\right]
$$

它不是简单地把 ratio 永远限制在区间内，而是在“继续扩大已经足够有利的策略变化”时让目标进入平台区，从而采取更保守的更新。

### 3.2 GAE 如何沿时间传播 reward

TD error 为：

$$
\delta_t=r_t+\gamma V_\phi(s_{t+1})-V_\phi(s_t)
$$

GAE 为：

$$
\hat A_t^{\mathrm{GAE}}=\sum_{l=0}^{T-t-1}(\gamma\lambda)^l\delta_{t+l}
$$

等价的反向递推写法是：

$$
\hat A_t^{\mathrm{GAE}}=\delta_t+\gamma\lambda\hat A_{t+1}^{\mathrm{GAE}}
$$

$\lambda$ 控制偏差—方差折中：靠近 0 时更依赖短期 bootstrap，靠近 1 时更接近 Monte Carlo return。LLM 常只有末尾的序列 reward，GAE 会利用 critic 的中间 value 预测把信号向前分配。

### 3.3 PPO 的模型与损失

经典 RLHF-PPO 常同时涉及：

- Actor：生成并被更新；
- Critic：估计 $V(s)$ 并被更新；
- Reward model 或规则验证器：提供任务反馈；
- Reference policy：通过 KL 约束限制策略漂移。

常见总 loss 还包括 value regression、entropy bonus 和 reference KL。KL 可以进入 token reward，也可以作为独立 loss；两种放法会改变 advantage 是否吸收 KL 信号，不能只看系数是否相同。

### 3.4 优缺点

优点是 token 级 credit、算法成熟、可处理稠密或稀疏 reward。主要代价是 critic 的显存与训练开销，而且长推理中 critic 未必能准确比较极其相似的中间状态。PPO 的 credit 粒度细，不代表 credit 一定准确；错误的 value prediction 会产生细粒度但错误的 advantage。

## 4. DPO：把 KL 正则化偏好优化改写成分类目标

### 4.1 从最优策略反解隐式 reward

考虑 KL 正则化目标：

$$
\max_\pi\ \mathbb{E}_{y\sim\pi(\cdot\mid x)}[r(x,y)]
-\beta D_{\mathrm{KL}}\left(\pi(\cdot\mid x)\|\pi_{\mathrm{ref}}(\cdot\mid x)\right)
$$

其最优策略满足：

$$
\pi^*(y\mid x)=\frac{1}{Z(x)}\pi_{\mathrm{ref}}(y\mid x)
\exp\left(\frac{r(x,y)}{\beta}\right)
$$

于是可反解：

$$
r(x,y)=\beta\log\frac{\pi^*(y\mid x)}{\pi_{\mathrm{ref}}(y\mid x)}+\beta\log Z(x)
$$

将它代入 Bradley–Terry 偏好模型，prompt 相关的 $\log Z(x)$ 在 chosen/rejected 差值中抵消。令 $y_w$ 为偏好回答、$y_l$ 为非偏好回答，DPO loss 为：

$$
\mathcal{L}_{\mathrm{DPO}}=-\mathbb{E}\left[
\log\sigma\left(
\beta\log\frac{\pi_\theta(y_w\mid x)}{\pi_{\mathrm{ref}}(y_w\mid x)}
-\beta\log\frac{\pi_\theta(y_l\mid x)}{\pi_{\mathrm{ref}}(y_l\mid x)}
\right)
\right]
$$

### 4.2 DPO 与在线 RL 的边界

DPO 的训练数据是已经存在的偏好对。它不在训练循环中让当前策略与环境交互、获得 reward、再估计 advantage。因此它的主要问题是偏好数据质量和离线分布覆盖，而不是在线 trajectory 内怎样把 reward 分给步骤。

“DPO 与 PPO-RLHF 完全等价”是过强表述。更准确地说：**在特定 KL 正则化目标、偏好概率模型和数据假设下，DPO利用最优策略—reward 的重参数化直接拟合偏好。** 实际训练中，离线数据分布、模型容量、优化过程和 reward model 假设都可能使 DPO 与在线 PPO 得到不同结果。

## 5. GRPO：用组内相对 reward 替代 critic

### 5.1 组内 advantage

对同一个 prompt 采样 $G$ 条回答 $y_1,\ldots,y_G$，获得 reward $R_1,\ldots,R_G$。标准化的组内 advantage 为：

$$
\hat A_i=\frac{R_i-\mu_R}{\sigma_R+\varepsilon}
$$

其中：

$$
\mu_R=\frac{1}{G}\sum_{j=1}^{G}R_j
$$

这个标量通常被广播到回答 $i$ 的所有有效 token：

$$
\hat A_{i,t}=\hat A_i
$$

策略更新仍可使用 PPO 风格的 token-level ratio 与 clipping：

$$
J_{\mathrm{GRPO}}=\mathbb{E}_{i,t}\left[
\min\left(
\rho_{i,t}\hat A_i,
\operatorname{clip}(\rho_{i,t},1-\epsilon,1+\epsilon)\hat A_i
\right)
\right]
$$

### 5.2 它省掉了什么，又失去了什么

GRPO 不训练 critic，显著降低显存和系统复杂度。baseline 来自同一个 prompt 下其他回答，能消除题目难度和 reward 尺度的一部分影响。

但组内相对值不是状态条件 value：

- 一条回答整体成功，不代表每个 token 都有功；
- 一条回答整体失败，不代表前面的所有步骤都错；
- 同组全对或全错时，组内方差可能为 0，几乎没有训练信号；
- 标准差归一化会让低方差 group 的梯度被放大，需要结合具体 estimator 设计判断。

所以 GRPO 主要解决的是 **critic 成本与 trajectory-level baseline**，不是细粒度 credit assignment。

## 6. GSPO：不改组内 advantage，改 sequence-level importance ratio

GSPO 的全名是 Group Sequence Policy Optimization。它常和 GRPO 共用组内 advantage：

$$
\hat A_i=\frac{R_i-\mu_R}{\sigma_R+\varepsilon}
$$

核心变化是把 token 级 ratio 换为长度归一化的序列级 ratio：

$$
s_i(\theta)=
\left(
\frac{\pi_\theta(y_i\mid x)}{\pi_{\theta_{\mathrm{old}}}(y_i\mid x)}
\right)^{1/|y_i|}
$$

等价地：

$$
s_i(\theta)=\exp\left(
\frac{1}{|y_i|}\sum_t
\log\frac{\pi_\theta(y_{i,t}\mid x,y_{i,<t})}
{\pi_{\theta_{\mathrm{old}}}(y_{i,t}\mid x,y_{i,<t})}
\right)
$$

再执行 sequence-level clipping：

$$
J_{\mathrm{GSPO}}=\mathbb{E}_i\left[
\min\left(
s_i\hat A_i,
\operatorname{clip}(s_i,1-\epsilon,1+\epsilon)\hat A_i
\right)
\right]
$$

### 6.1 为什么这不是“更细的 credit”

GRPO 到 GSPO 的主要变化不是 advantage 变细，而是 **off-policy correction 和 clipping 的单位与 sequence reward 对齐**。同一 response 内的 token 仍共享 trajectory advantage；GSPO主要减少 token-level ratio 噪声和不同 token 被不等权重放大的问题。

### 6.2 verl 中的 stop-gradient 技巧

工程上需要同时满足：前向数值使用同一个 sequence ratio，而每个 token 的 log-probability 仍能收到梯度。可构造：

$$
\log \tilde s_{i,t}=
\log\pi_\theta(y_{i,t}\mid s_{i,t})
-\operatorname{sg}\left[\log\pi_\theta(y_{i,t}\mid s_{i,t})\right]
+\operatorname{sg}[\log s_i]
$$

其中 $\operatorname{sg}$ 表示 stop-gradient。这样前向值等于 $\log s_i$，反向梯度却通过当前 token 的 $\log\pi_\theta$ 流回 actor。

### 6.3 MoE 与超参数提醒

GSPO 论文报告其 sequence-level 设计能稳定 MoE RL 训练。知乎原文进一步把这解释为：MoE routing 的波动会直接污染 token ratio，而序列聚合能平滑局部波动。这个解释与论文动机一致，但不应外推为“所有 MoE 训练都必须用 GSPO”。此外，GSPO ratio 的定义与 PPO/GRPO 不同，clip range 的数量级不可机械复用；具体值必须以所用 verl 版本、配置与复现实验为准。

## 7. GRPO 周边变体：它们分别修什么

### 7.1 Dr.GRPO

常见修正是取消组内标准差缩放：

$$
\hat A_i=R_i-\mu_R
$$

它针对的是 reward 标准差带来的难度或长度相关缩放问题。它仍是 trajectory-level credit，不会自动识别哪一步导致成败。

### 7.2 RLOO

RLOO 用“组内除自己之外的平均 reward”作为 baseline：

$$
\hat A_i=R_i-\frac{1}{G-1}\sum_{j\ne i}R_j
$$

也可写为：

$$
\hat A_i=\frac{G}{G-1}(R_i-\bar R)
$$

它改善 baseline 的统计构造，但通常仍把同一 advantage 广播给完整 response。

### 7.3 DAPO

DAPO 更像一组针对长 CoT RL 的训练配方，而不是单一 estimator：

- Clip-Higher：正负方向使用非对称 clip，给低概率 token 的上升留出更多空间；
- Dynamic Sampling：过滤同组全对或全错、advantage 全为 0 的 prompt；
- Token-level Policy Gradient Loss：调整长度相关的 loss 聚合；
- Overlong Reward Shaping：对过长和截断样本做更平滑处理。

它改善训练稳定性和样本效率，但不应与 segment-level credit assignment 画等号。

### 7.4 OPD

On-Policy Distillation 让 student 在自己的 rollout 状态上接受 teacher 信号。它连接了两种优点：

- rollout 来自 student 当前分布，减轻 SFT 的 exposure bias；
- teacher 可在每个 token 提供比终局 reward 更密的监督。

GKD 风格可以直接最小化 teacher–student 分布散度；PG-OPD 则可把单 token 的 teacher/student log-probability 差构造成 stop-gradient reward 或 advantage，再复用 PPO loss。它解决的是“反馈密度与师生分布匹配”，与结果验证器驱动的 RLVR 目标并不相同。

## 8. 从 trajectory advantage 到 segment advantage

### 8.1 Segment advantage 是什么

设第 $k$ 个 segment 从边界状态 $s_{t_k}$ 延伸到 $s_{t_{k+1}}$。在确定性转移、segment 内无中间 reward、$gamma=1$ 时：

$$
A_k^{\mathrm{seg}}=V(s_{t_{k+1}})-V(s_{t_k})
$$

它的语义是：**生成这一段之后，最终成功的期望相对生成之前提高了多少。**

若使用 Monte Carlo continuation 估计边界状态价值：

$$
\hat V(s)=\frac{1}{K}\sum_{j=1}^{K}R(\tau_j),qquad
\tau_j\sim\pi(\cdot\mid s)
$$

则：

$$
\hat A_k^{\mathrm{seg}}=\hat V(s_{t_{k+1}})-\hat V(s_{t_k})
$$

若 reward 是 0/1 正确性，$V(s)$ 可以直观理解为“从这个前缀继续生成，最终答对的概率”。某段把成功率从 0.25 提升到 0.70，它的 segment advantage 约为 $+0.45$；若从 0.70 降到 0.30，则约为 $-0.40$。

### 8.2 三种时间轴方法

| 方法 | 如何获得局部对照 | Credit 粒度 | 是否需要 critic | 主要代价或假设 |
|---|---|---|---|---|
| VinePPO | 从轨迹中间状态额外采样 $K$ 条 continuation，MC 估计 $V(s)$ | reasoning step / segment | 否 | 额外 rollout 成本；必须能从中间文本状态重启 |
| GiGPO | 在已有多条 Agent 轨迹中寻找重复环境状态，比较同状态下动作的 discounted return | environment step | 否 | 依赖状态可匹配或相似度匹配；没有重复状态就缺少局部组 |
| SPO | 把输出切成连续 segment，用 chain/tree MC 估计边界 value 或 sibling-relative value | segment | 否 | 需要分段与 MC 树设计；粒度、成本和方差相互制约 |

#### VinePPO

VinePPO 利用语言状态可以由“重新输入 partial context”恢复这一特性。从状态 $s_t$ 采样 $K$ 条辅助 continuation：

$$
\hat V_{\mathrm{MC}}(s_t)=\frac{1}{K}\sum_{j=1}^{K}R(\eta_j)
$$

再计算：

$$
\hat A_{\mathrm{MC}}(s_t,a_t)=r_t+\gamma\hat V_{\mathrm{MC}}(s_{t+1})-
\hat V_{\mathrm{MC}}(s_t)
$$

辅助 rollout 只用于估值，不直接进入 policy gradient。它用推理吞吐换掉 critic 的函数逼近偏差；$K$ 越大，MC 方差通常越低，但 rollout 成本越高。

#### GiGPO

GiGPO 保留 GRPO 式 episode advantage $A^E(\tau_i)$，再从已有轨迹中识别重复环境状态 $\tilde s$，把这些状态下执行的不同动作分为同一 anchor-state group。对动作位置计算 discounted return：

$$
R_t^{(i)}=\sum_{k=t}^{T}\gamma^{k-t}r_k^{(i)}
$$

在相同 anchor state 内标准化得到 step advantage $A^S(a_t^{(i)})$，最终合成：

$$
A(a_t^{(i)})=A^E(\tau_i)+\omega A^S(a_t^{(i)})
$$

它的巧妙之处是复用自然出现的重复状态，不额外从每个状态分叉 rollout。代价是 credit 质量依赖状态表示和匹配规则；在开放式文本状态中，“语义相同但字符串不同”与“字符串相似但决策条件不同”都可能造成误差。

#### SPO

SPO（Segment Policy Optimization）在 token 和 trajectory 之间选择 segment 粒度：

- SPO-chain：在较短 CoT 中选择若干边界，从每个边界独立做 MC continuation；
- SPO-tree：在较长 CoT 中组织树状 rollout，自底向上聚合叶子 reward，并复用这些样本进行策略优化；
- probability mask：只把 segment advantage 赋给满足低概率阈值的 token，而非 segment 内所有 token。

SPO-tree 中，节点价值可由子节点递归估计：

$$
\hat V(n)=
\begin{cases}
R(\operatorname{hist}(n)), & n\text{ 为叶节点},\\
\frac{1}{|\operatorname{Ch}(n)|}\sum_{n'\in\operatorname{Ch}(n)}\hat V(n'), & \text{否则}.
\end{cases}
$$

节点 segment 可相对 siblings 构造 advantage。它把 MC 估值样本同时用于训练，减少 chain-style continuation 被估值后丢弃的浪费。

## 9. 为什么低概率 token 会影响关键推理选择

### 9.1 它为什么常像“分支点”

当模型对下一 token 很确定时，采样 token 的概率接近 1，其他动作几乎没有概率质量；当前策略下不同 continuation 的分歧空间较小。反之，当采样 token 概率低时，说明模型本来更倾向于其他选择，这个位置更可能对应：

- 公式、数字、变量或工具名的选择；
- “因此 / 但是 / 假设”等推理转折；
- 从一种解题路线切到另一种路线；
- 罕见但有用的探索动作；
- 也可能只是拼写、格式、专有名词或随机采样噪声。

所以低概率是一个便宜的 **候选分支点指标**，不是语义关键性的定义。

### 9.2 数学上：高概率动作的 relative advantage 被压缩

在状态 $s$ 采到动作 $y$，记 $p(a)=\pi(a\mid s)$。因为：

$$
V(s)=\sum_a p(a)Q(s,a)
$$

所以：

$$
A(s,y)=Q(s,y)-V(s)
=\sum_{a\ne y}p(a)\left[Q(s,y)-Q(s,a)\right]
$$

若 $Q(s,a)\in[0,1]$，则：

$$
|A(s,y)|\le 1-p(y)
$$

这意味着：

- 当 $p(y)=0.99$ 时，$|A(s,y)|$ 最多约为 0.01，动作相对当前策略平均值很难有巨大提升或下降；
- 当 $p(y)=0.05$ 时，上界放宽到 0.95，这个动作**有可能**显著改变未来价值。

结论只能说：**低概率允许出现大的 relative advantage，高概率会压缩 relative advantage。** 不能倒推为“低概率 token 一定关键”或“低概率 token 一定正确”。真正的关键性还要由前后 $V(s)$ 的变化、对照 continuation 或环境结果验证。

### 9.3 为什么 probability mask 可能有效，也可能危险

SPO 的 probability mask 把 segment advantage 集中到低概率 token，减少高置信度过渡词共享同一 credit 的噪声。但它隐含了一个代理假设：低概率位置更可能主导 segment value 的变化。这个假设在数学推理分支上可能有效，在以下情况中则可能误判：

- tokenizer 导致的罕见 subword；
- 人名、代码标识符、URL 或格式符号；
- 高温采样造成的偶然低概率 token；
- 真正的关键动作已经被模型高置信度掌握。

因此概率阈值应被视为启发式 gate，而不是因果解释器。

## 10. 从时间轴到结构轴：SLCA-GRPO

### 10.1 两条轴解决不同错配

时间轴方法问：

> 第 1、2、3 个推理步骤或工具动作中，哪一步促成了结果？

结构轴方法问：

> 工具执行和最终总结承担不同功能，哪一种 reward 应该更新哪类 token？

两者的区别是：

| 轴 | 划分依据 | 典型错误 | 代表方法 |
|---|---|---|---|
| 时间轴 | 先后步骤、状态转移、连续 segment | 后面的成败被平均分给前面所有步骤 | VinePPO、GiGPO、SPO |
| 结构轴 | token 的功能角色或输出类型 | 总结质量 reward 污染工具调用梯度 | SLCA-GRPO |

“从时间轴挪到结构轴”不是说时间不再重要，而是论文把首要问题重新定义为 **异构输出之间的 cross-segment misattribution**。

### 10.2 标准 GRPO 的跨段污染

工具调用轨迹可写成：

$$
y=y_{\mathrm{tool}}\oplus y_{\mathrm{sum}}
$$

如果先把两类 reward 相加：

$$
R_{\mathrm{total}}=R_{\mathrm{tool}}+R_{\mathrm{sum}}
$$

再生成一个统一 advantage 并广播到所有 token，那么：

- 流畅总结可能抵消冗余或错误工具调用；
- 正确工具执行可能被错误总结连带惩罚；
- 即使有过程 reward，只要它先被并入 total reward，跨段通路仍存在。

### 10.3 SLCA 的分段归一化与路由

对同一 rollout group，工具 reward 和总结 reward 分别归一化：

$$
\hat A_i^{\mathrm{tool}}=
\frac{R_i^{\mathrm{tool}}-\mu_g^{\mathrm{tool}}}
{\sigma_g^{\mathrm{tool}}+\epsilon}
$$

$$
\hat A_i^{\mathrm{sum}}=
\frac{R_i^{\mathrm{sum}}-\mu_g^{\mathrm{sum}}}
{\sigma_g^{\mathrm{sum}}+\epsilon}
$$

然后按 token 的结构角色路由：

$$
\hat A_{i,t}^{\mathrm{SLCA}}=
\begin{cases}
\lambda_{\mathrm{tool}}\hat A_i^{\mathrm{tool}},
&t\in\mathcal{T}_{i,\mathrm{tool}},\\
\lambda_{\mathrm{sum}}\hat A_i^{\mathrm{sum}},
&t\in\mathcal{T}_{i,\mathrm{sum}},\\
0,&m_{i,t}=0.
\end{cases}
$$

于是，在单次更新的定义上，summary reward 不再直接进入 tool token 的 advantage。这就是“结构锁定”的含义。它改的是 credit routing，后续仍可使用 PPO/GRPO 风格的 clipped policy objective。

### 10.4 它解决了什么，没有解决什么

解决或直接缓解：

- 执行 reward 与总结 reward 的跨段混合；
- 两类 reward 尺度不同却被统一归一化的问题；
- 同一 backbone 中不同功能 token 的更新串扰。

没有直接解决：

- 工具段内部 Action 1 与 Action 2 谁对谁错；
- 总结段内部哪个句子导致 judge 分数变化；
- 没有清晰结构边界的 inline code 或自由形式 reasoning；
- segment reward 本身是否可靠。

所以 SLCA 与 VinePPO/GiGPO/SPO 在概念上可以组合：先按结构把 reward 分流，再在 tool segment 内沿时间轴细化。但 SLCA 论文只提出了正交性主张，尚未用组合实验验证；不能把“理论上可组合”写成“已经证明组合有效”。详见本地 [SLCA-GRPO 精读材料](/2026/09/28/2609.29050v1_SLCA-GRPO_Resolving_Cross-Segment_Credit_Misattribution_in_Tool-Calling_RL/)。

## 11. verl 中怎样映射这些概念

知乎原文给出的共同训练骨架可压缩为：

```text
generate rollout
→ compute old/reference log-probabilities
→ compute reward
→ estimate advantage
→ optionally update critic
→ compute policy loss and update actor
```

### 11.1 Advantage estimator 与 policy loss 要分开看

| 算法或配方 | Advantage 侧 | Policy-loss 侧 | 额外数据流 |
|---|---|---|---|
| PPO | critic + GAE | token-level PPO clip | critic value update |
| GRPO | group relative reward | 常用 token-level PPO-style clip | 每个 prompt 多条 rollout |
| Dr.GRPO | group mean centering，不除 std | 同 GRPO | 同 GRPO |
| RLOO | leave-one-out baseline | PPO-style clip | 每个 prompt 多条 rollout |
| GSPO | 常用 GRPO group advantage | sequence-level ratio 与 clip | sequence aggregation |
| DAPO | 常基于 GRPO | asymmetric clip、token aggregation 等 | dynamic sampling、overlong shaping |
| VinePPO | MC state value difference | PPO-style clip | 中间状态辅助 rollout |
| GiGPO | episode + anchor-state step advantage | clipped objective | 多轮环境状态分组 |
| SPO | MC segment value / sibling comparison | segment advantage + 可选 probability mask | chain/tree rollout |
| SLCA-GRPO | 分段 reward 独立归一化并路由 | PPO/GRPO-style clip | segment mask、HierR |
| DPO | 不使用 advantage | pairwise preference loss | chosen/rejected 数据 |

### 11.2 Loss aggregation 不是小细节

- `token-mean`：每个有效 token 等权，长序列总贡献通常更大；
- `seq-mean-token-mean`：先在每条序列内部平均，再对序列平均，使每条 response 权重更接近相等；
- `seq-mean-token-sum`：每条序列先求 token 和，再对序列平均，明显保留长度影响。

同一个 advantage 与 ratio，在不同 aggregation 下可能形成不同长度偏置。算法比较必须同时报告 aggregation，而不能只写“都用了 GRPO”。

### 11.3 KL 的两种位置

KL 进入 reward：

$$
\tilde r_t=r_t-\beta\,\widehat D_{\mathrm{KL},t}
$$

此时 KL 会进入 return/advantage，影响 credit assignment。

KL 作为独立 loss：

$$
\mathcal{L}=\mathcal{L}_{\mathrm{policy}}+\beta\mathcal{L}_{\mathrm{KL}}
$$

此时任务 advantage 与 KL penalty 在 loss 层合并。两种实现不能因为最终都有 $\beta$ 就视为完全相同。

### 11.4 版本敏感提醒

原文以当时的 `verl/trainer/ppo/core_algos.py`、`ray_trainer.py` 和 distillation 路径解释注册表、GAE、GRPO、GSPO、OPD 与 loss aggregation。源码行号、配置路径、默认 clip range 和 KL estimator 会变化。复现实验时应记录：

- verl commit 或 release；
- rollout backend 与版本；
- advantage estimator 和所有 normalization 开关；
- policy loss mode、clip low/high；
- loss aggregation；
- KL 放在 reward 还是 loss；
- group size、generation length、采样温度与 reward 定义。

## 12. 算法选择：先看问题在哪一层

| 需求或症状 | 更合适的起点 | 原因 |
|---|---|---|
| 有高质量离线偏好对，不方便在线 rollout | DPO | 数据流简单，不需要 reward/critic 在线服务 |
| 在线可验证任务，需要成熟 token-level actor-critic | PPO | GAE 与 critic 能提供逐位置 advantage |
| critic 成本过高，同 prompt 可采多条回答 | GRPO / RLOO | 用组内 baseline 替代 critic |
| GRPO 长序列或 MoE 训练受 token-ratio 噪声影响 | GSPO | 让 ratio、clip 和 sequence reward 的单位对齐 |
| GRPO 出现全对/全错组、熵塌缩、长度问题 | DAPO 类配方 | 动态采样、非对称 clip 和长度处理针对这些症状 |
| 推理步骤的局部价值需要高质量估计，能承担额外 rollout | VinePPO | 用中间状态 MC continuation 代替 critic |
| 多轮 Agent 有大量重复环境状态 | GiGPO | 复用已有轨迹构造同状态动作对照 |
| 需要介于 token 与 trajectory 之间的 credit | SPO | 用 segment value difference 折中粒度与成本 |
| 工具执行 reward 被最终总结 reward 污染 | SLCA-GRPO | 先按结构角色分段、独立归一化和路由 |
| Student rollout 上需要 teacher 的稠密 token 信号 | OPD | 结合 on-policy 状态覆盖与蒸馏监督 |

实际选择时不应只看榜单，而要检查：环境能否复位、reward 能否分解、状态能否匹配、预算能否支持额外 rollout、结构边界是否可靠，以及主要问题究竟发生在 advantage、ratio、aggregation 还是 reward 本身。

## 13. 常见误区

1. **“GRPO 没有 critic，所以没有 baseline。”** 错。它用同 prompt 的组内 reward 统计量作 baseline。
2. **“GSPO 就是更细的 advantage。”** 错。标准 GSPO 仍可使用 trajectory group advantage，核心变化是 sequence-level importance ratio、clip 和 optimization。
3. **“Segment advantage 是 segment 的原始 reward。”** 错。它通常是 segment 前后 state value 的差，或者相对 sibling/group baseline 的增量。
4. **“低概率 token 就是错误 token。”** 错。低概率只表示当前策略不确信或采到了非主模态选择，它既可能是有效探索，也可能是噪声。
5. **“给了过程 reward 就解决 credit assignment。”** 不一定。若过程 reward 与终局 reward 先相加，再把统一 advantage 广播给所有 token，局部信号仍会被混合。
6. **“DPO 不用 reward model，所以没有 reward 假设。”** 错。DPO 把 reward 隐式编码进策略—参考策略的 log-ratio，并依赖偏好概率模型与数据覆盖假设。
7. **“PPO clip 保证策略一定在信赖域内。”** 错。clipped surrogate 是工程近似，不是对全局 KL 的硬约束。
8. **“更细粒度永远更好。”** 错。粒度越细，估值点越多、方差或 critic 误差可能越大；trajectory、segment、step、token 是偏差—方差—成本折中。

## 14. 一页记忆版

- **PPO**：critic 估 advantage；token ratio 做 clip；细但贵，critic 可能不准。
- **DPO**：偏好对直接训练；没有在线 advantage；简单但依赖离线覆盖。
- **GRPO**：同 prompt 多回答，组内 reward 当 advantage；省 critic，但整条回答共享 credit。
- **GSPO**：组内 advantage 可不变；把 ratio 与 clip 提升到 sequence 级；主要解决优化粒度和稳定性。
- **VinePPO**：从中间状态多次续写，用 MC value difference 给步骤分 credit。
- **GiGPO**：利用多条 Agent 轨迹中的重复状态，做 episode + step 两层相对 advantage。
- **SPO**：用连续 segment 做中等粒度 credit，chain/tree MC 估值，可用低概率 token mask 聚焦更新。
- **SLCA-GRPO**：按工具执行 / 最终总结的功能结构分流 reward 和 advantage，阻断跨段污染。
- **低概率 token**：是潜在分支点；只意味着大 relative advantage 的上界更宽，不等于它必然关键。

## 来源与证据

### 本地材料

- 知乎原文：PPO / DPO / GRPO / GSPO 与 verl 源码拆解
- PPO、DPO、GRPO、GSPO 与 verl 源码摘要
- [SLCA-GRPO 精读与审稿式分析](/2026/09/28/2609.29050v1_SLCA-GRPO_Resolving_Cross-Segment_Credit_Misattribution_in_Tool-Calling_RL/)
- 强化学习
- Agentic RL
- verl

### 方法原论文

- [VinePPO: Refining Credit Assignment in RL Training of LLMs](https://arxiv.org/abs/2410.01679)
- [Group-in-Group Policy Optimization for LLM Agent Training](https://arxiv.org/abs/2505.10978)
- [Segment Policy Optimization](https://arxiv.org/abs/2505.23564)
- [Group Sequence Policy Optimization](https://arxiv.org/abs/2507.18071)
- [SLCA-GRPO: Resolving Cross-Segment Credit Misattribution in Tool-Calling RL](https://arxiv.org/abs/2609.29050)

## 后续可扩展问题

- 在同一工具调用基准上做 `GRPO / GiGPO / SLCA / SLCA+GiGPO` 的 matched ablation，能否分离时间轴与结构轴的收益？
- segment boundary 应该由格式 mask、低概率 cutpoint、语义解析器还是学习式 boundary model 决定？
- 当 reward 不在 $[0,1]$ 时，低概率动作与 advantage 上界的关系如何按 $Q$ 的取值范围推广？
- GSPO-token、segment-level ratio 与 SLCA routing 能否形成统一的“reward—advantage—ratio 粒度对齐”框架？
