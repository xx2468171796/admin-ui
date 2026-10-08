# 运营看板与数据可视化设计标准

给要做**数据看板、运营面板、报表页、值班大屏**的 AI 和工程师。适用于任何项目、任何业务，也不限于用本包。

它和其他规范的分工：
- 本文管**看板层面**的设计：做给谁、放哪些数、怎么分层下钻、看多大范围、怎么刷新、后端怎么聚合。
- 单张图表的配色、线宽、标注、悬停提示和色盲校验，看 dataviz 技能。
- 页面外壳、表格和状态反馈，看 [DESIGN.md](DESIGN.md) 和 [TABLES.md](TABLES.md)。

> 🔴 **最重要的一条：先分类，再设计。**
> 以前 AI 做的看板都一个样：一排数字卡片，加几张折线图。这不是审美问题，而是跳过了分类：
> 不同业务的核心指标、下钻路径、对比基准、刷新频率、常见误读和告警条件都不一样。
> 转化率一两个小时里高了几个点多半是正常波动，支付对账差一分钱就是事故。套同一个模板，两边都会做错。

调研日期 2026-09-24（§2.11 跳板机卡 2026-09-25 补充），来源见文末。标注说明：
- 【共识】：多个独立权威来源都这么说。
- 【来源】：单一厂商或作者的做法或数字。
- 【本规范】：本规范根据以上材料定的默认值，项目可以按实测调整，但要写明理由。

---

## 0. 动手前必须先写出「分类卡」

写任何看板代码之前，先在回复或设计文档（`docs/architecture.md`、页面注释都行）里写出下面这张卡。**写不出来，说明需求没问清楚，这时应该去查代码、查接口、问用户，而不是先画一版再说。**

```text
【看板分类卡】
业务类型：<从 §2 里选一个或几个；混合业务就拆成几个看板，或分成几个区块>
用途：    <实时值班 / 经营复盘 / 深入分析 / 对账核查，只选一个主用途>
受众：    <一线值班 / 主管 / 老板 / 财务审计 / 分析师>
要做的决定：<看完要做什么，例：要不要切换支付通道、这个活动的规则要不要调>
看的频率和数据新鲜度：<例：值班时一直开着，数据延迟 ≤1 分钟>
数错了代价多大：<例：钱算错属于事故；DAU 差 2% 可以接受>
选用模板：<§2 的哪张卡>，北极星指标：<…>，一级 KPI：<3-5 个>
下钻路径：<例：全平台 → 站点 → 渠道 → 用户 → 单笔订单>
默认对比：<例：上周同一天 / 理论值 ± 容差带 / 目标线>
刷新：<档位>，默认时间范围：<…>，时区和日切：<…>
查看范围：<谁能看哪些站点/渠道/地区，由服务端强制>
告警：<哪些情况推告警，不能靠人盯>
```

分类有三个维度，业界来源和依据如下：

**1）用途：决定版式、刷新频率和交互方式。** 这个维度影响最大。
Few、Eckerson、NN/g、Carbon、Cloudscape 五家都把「实时运营」和「分析复盘」分开【共识】。
「对账核查」是本规范单独加的一类：它要求每个汇总数都能追到原始记录，这和其他三类的设计方向完全不同。

**2）业务类型：决定用哪套指标、口径和下钻维度。** 模板见 §2。
业界没有一套现成的「按业务类型分模板」的理论；§2 是把各领域权威口径（ChartMogul、Zendesk、Google SRE、Stripe、Cloudflare、UKGC 等）汇总起来的结果。

**3）受众：决定汇总到哪一层、能不能按人排名。**
给一线看的是「现在要处理什么」，给老板看的是「和目标比差多少」。按人排名要注意小样本，见 §12.5 的漏斗图（`funnelPlotOption`）。

同一份数据经常需要**两个看板**，不要硬塞进一页。例如：
- 支付：通道值班页 + 对账页。
- 直播 / 在线服务：实时在线监控 + 经营周报。

Cloudscape 明确说过：不要在一个看板里混用两种版式。

**业务类型不在 §2 里怎么办：先调研，再动手，做完回流。** 例如物流、教育、医疗、直播、广告投放这些行业。

1. 上网查这个行业的看板惯例和指标口径，**至少找 5 个独立来源**：行业协会或监管机构的口径、头部 SaaS 厂商的官方文档（它们的指标定义通常最严谨）、设计系统的看板规范、有数据支撑的实践文章。只有一家说法的，要标「单一来源」。
2. 按 §2 的字段写出这个行业的模板卡：决策、北极星、一级 KPI 口径、下钻、对比基准、刷新、陷阱、图表、告警。**「陷阱」一栏必须写**，行业看板最容易犯的错都在这里。
3. 分类卡里注明「模板卡为本次调研新增」，并附上来源链接。
4. 交付后把新模板卡**回流到本文 §2**，并跑 `docs-api` 门禁。下一个做同类看板的 AI 就不用重新调研了。

---

## 1. 四种用途，各自的版式

| | 实时值班 | 经营复盘 | 深入分析 | 对账核查 |
|---|---|---|---|---|
| 对应业界说法 | Few 运营型、Cloudscape 监控 | Few 战略型、Carbon 展示型 | Few 分析型、Carbon 探索型 | Eckerson 明细层、Bach「资料库型」 |
| 回答的问题 | 现在有没有事？要不要马上处理？ | 比目标、比上期，好还是坏？为什么？ | 问题出在哪个维度？根因是什么？ | 每一笔都对得上吗？差异由谁处理？ |
| 画面主角 | 当前状态 + 离阈值还有多远；异常排在最上面 | 3-5 个 KPI，每个都带对比和迷你趋势线 | 可切换维度的图表 + 明细表 | 差异待办表 + 账龄分桶 |
| 版式 | 固定，位置不变，一眼能扫完 | 固定，左上放最重要的 | 可调：筛选、下钻、切片 | 表格为主，允许不好看，不允许对不上 |
| 刷新 | 10 秒到 1 分钟，最好推送 | 1-5 分钟或按日；T+1 定稿 | 手动刷新 | 按批次或按日 |
| 颜色 | 平时是中性灰，只有异常才上状态色 | 按「好/坏」上色，不按「涨/跌」 | 分类色用于区分维度 | 只有已平和差异两种状态 |
| 典型坏味道 | 趋势线占满屏，异常埋在第三屏 | 数字没有对比（Few 列的第 2 号错误） | 固定版式，想换个维度看只能找开发 | 汇总数点不进去，看不到流水 |

**版式通则**【共识：Few、Tableau、Power BI、Carbon、NN/g】：
- 最重要的内容放左上角。一屏能看完是理想状态，可以滚动的只放下钻内容。
- 首屏的主角控制在 3-5 个。其余按「主指标 → 解释指标 → 明细」分层，明细靠下钻进入。各家给的每屏视图数上限并不一致（Tableau 说 2-3 个视图，Looker 说 ≤25 个 tile，而 Looker 的限制是性能原因），能跨来源成立的只有「首屏主角 3-5 个」这一点。
- 精度够用就行：写 ¥384.8 万，不写 ¥3,848,305.93（Few 列的第 3 号错误）。钱的精确值放到明细和导出里。
- 不用仪表盘、饼图、雷达图做精确比较，因为角度和面积很难读准。要表达「目标完成度」就用子弹图（Few），比例用条形图。
- 不用累计图。不管业务是在涨还是在跌，累计曲线都在涨（a16z）。
- 不用双 Y 轴。两个量纲不同的指标就画两张图。详见 dataviz 技能。

---

## 2. 业务类型模板卡

每张卡的字段都一样：决策 / 北极星指标 / 一级 KPI / 解释指标 / 下钻 / 对比基准 / 刷新 / 陷阱 / 图表 / 告警。
混合业务（比如电商站同时有会员订阅和推广返利）就给每个区块各选一张卡。


### 2.2 电商 / 交易

- **决策**：预算、选品、价格和活动怎么调；转化卡在哪一步。
- **北极星指标**：净成交额 = 支付 GMV − 支付后取消和退款。
- **一级 KPI**
  - 支付 GMV：**口径必须写清**，下单、支付、完成、净额四种并存。
  - 转化率：按会话算还是按用户算要写明，Shopify 按会话算，比 GA4 低。
  - 客单价 = 支付 GMV ÷ 支付订单数。
  - 退款率：按金额算。
  - 复购率：按首购月份分 cohort。
- **解释指标**：加购率、结算放弃率、支付转化率、新老客占比、优惠券折扣率、SKU 动销率。
- **下钻**：全站 → 渠道或设备 → 类目 → 商品 → 订单 → 用户。
- **对比**：上周同一天（电商周内规律很强）；大促期间对比去年同期；加一条目标线。
- **刷新**：大促战报分钟级；日常按日，T+1 定稿。
- **陷阱**
  - 退款按退款日记账还是按原订单日记账：按原订单日记，历史数字会变；按退款日记，当天净额可能是负数。**选一种，写进口径。**
  - 辛普森悖论：移动端占比上升，会把整体转化率拉低，而每个细分其实都在变好。所以分组指标要同时给「各组的值」和「各组的占比」。
  - 结算放弃约 70% 是常态（Baymard 统计 50 项研究的平均值 70.22%），不要为它告警。
- **图表**：分步漏斗（同时标步间转化率和占总会话比例）；GMV 瀑布图（流量 × 转化率 × 客单价）；复购 cohort 热力表；商品帕累托图。
- **告警**：下单 → 支付转化率比过去 4 周同时段低 X%，且样本达到门槛；大促期间 N 分钟零订单；退款率周环比翻倍。

### 2.3 会员 / 订阅 / 权益

- **决策**：增长靠拉新还是靠留存；先修流失还是先加投放。
- **北极星指标**：净新增 MRR，或 NRR。
- **一级 KPI**
  - MRR 拆成五类变动：新增、扩张、收缩、流失、召回。
  - 毛流失率和净流失率，分母都用期初。
  - NRR = (期初 + 扩张 − 收缩 − 流失) ÷ 期初，不含新客户。
  - LTV : CAC，其中 LTV 按毛利算。
- **解释指标**：试用转化率、付款失败率和挽回率、各套餐分布、CAC 回本月数。
- **下钻**：MRR → 变动类型 → 套餐或渠道 → 客户 → 订阅事件。
- **对比**：同批次 cohort 对比，新批次应当好于老批次。
- **刷新**：按日；按月复盘。
- **陷阱**
  - 净流失会掩盖真实流失，因为扩张收入把流失抵消了。
  - 流失应按付费周期到期计，不按点取消的那一刻计。
  - 扣款失败造成的被动流失混进了主动流失。
  - 签约额不等于收入。
- **图表**：MRR 变动瀑布图或正负堆叠柱；两张 cohort 留存热力表，一张按人数、一张按收入。
- **告警**：单日流失 MRR 超过近 30 天的 P95；头部客户降级；付款失败率上升。

### 2.4 支付 / 财务 / 对账

**拆成两个看板**：通道值班（实时值班）和对账（对账核查）。

- **决策**：通道怎么路由、要不要切换；哪些差异要追、谁来追。
- **北极星指标**：去重后的支付成功率 + 未平差异金额。
- **一级 KPI**
  - 成功率。原始口径计入每一次重试；去重口径按同一笔购买的最终结果算。两个都要，名字要分开（Stripe）。
  - 各通道实际费率。
  - 在途资金：已成功、未结算的金额，附预计结算日 T+N。
  - 自动匹配率。
  - 未匹配差异，按账龄分桶：0-2 天、3-7 天、8-30 天、30 天以上。
  - 拒付率。
- **解释指标**：失败原因码帕累托；差异分类（时间差、手续费、汇率、部分扣款、重复、拒付）。
- **下钻**：全部 → 通道 → 商户号 → 失败码或差异类别 → 单笔流水 → 结算文件原始行。**每个汇总数都必须能点进去看到流水。**
- **对比**：成功率对比同通道过去 7 天同时段。对账以结算批次为准：净额必须等于打款额。
- **刷新**：成功率分钟级；对账按批次。
- **陷阱**
  - 重试会把原始口径成功率拉低。
  - 各通道日切时间不同，会制造假差异。
  - 打款额 ≠ 销售额，中间扣了手续费、退款和拒付。
  - 对账窗口开得太早，会把在途款误报成缺失。
- **图表**：通道小多图 + 失败码帕累托；资金流瀑布图（成交 → 手续费 → 退款 → 拒付 → 结算）；账龄堆叠图 + 差异待办表，每条差异有状态：待定 → 已匹配/不匹配 → 已处理/已升级。
- **告警**：某通道 5 分钟成功率比基线低 N 个百分点，且样本达到门槛；结算文件没按时到；批次差额 ≠ 0；差异账龄超过 5 个工作日。
- 看板只负责把差异暴露出来，不能代替受控的对账流程（Metabase）。**权威数据来自账本，事件流只用来看趋势。**

### 2.5 推广 / 返利 / 营销

- **决策**：钱往哪个渠道加，哪里要砍；返利是在拉真实用户，还是在被薅。
- **北极星指标**：增量付费用户，或按 cohort 算的 ROAS。
- **一级 KPI**
  - 投放 CAC（不要只看混合 CAC）。
  - D7 和 D30 ROAS。
  - 回本周期。
  - K 因子 = 人均邀请数 × 邀请转化率。
  - 返利成本率 = 返利支出 ÷ 被邀请用户带来的收入。
  - 作弊率。
- **下钻**：渠道 → 活动或素材 → 邀请人 → 用户 → 设备关联图。
- **对比**：按**相同天龄**对比 cohort（D7 对 D7），不按日历日期比；另外对照自然流量基线，看增量。
- **陷阱**
  - 归因结果会延迟变化。GA4 归因最长 12 天内还会变，作弊安装在 D0-D7 才被识别，所以**最近几天的 ROAS 偏低是正常的，不能据此直接关渠道**。
  - 作弊邀请看起来和一个成功的增长循环一模一样。
  - K > 1 很少能长期维持，多数在 0.2-0.8。
- **图表**：cohort ROAS 曲线（横轴是天龄）；渠道气泡图（花费 × ROAS）；邀请关系图。
- **告警**：某邀请人下线数突增，且同设备或同 IP 比例偏高；返利支出超出预算节奏；被邀请用户次日留存异常低。

### 2.6 客服 / 工单

- **决策**：排班和调人；哪些工单马上要违约。
- **北极星指标**：按优先级统计的 SLA 达成率 + CSAT（同时看回评率）。
- **一级 KPI**
  - 首次响应时间和解决时间：用**中位数和 P90，不用均值**，并写明是按工作时间还是日历时间算。
  - SLA 达成率：按实例计，不按工单计。
  - 积压量 = 前一天积压 + 当天新建 − 当天解决。
- **下钻**：全部 → 队列 → 优先级 → 客服 → 工单。
- **对比**：SLA 目标线；同星期同时段。
- **刷新**：值班墙 1-5 分钟；按周复盘。
- **陷阱**
  - 长尾会把均值拉高。
  - 回评率低会带来选择偏差。
  - 按客服排名时，小样本会误伤个人。
  - 某个主题突然增多，往往意味着线上出了故障，要联动 2.8 运维看板。
- **图表**：新建与解决双线 + 积压面积图；即将违约的倒计时列表；小时 × 星期热力图。
- **告警**：距 SLA 到期不足 X 分钟的工单数；积压连续 N 小时上升；某个主题突增。

### 2.7 内容 / 社区 / 聊天

- **北极星指标**：有效互动的活跃用户。「活跃」要写死定义，比如本周发过消息。
- **一级 KPI**
  - DAU/MAU：低于 15% 危险，高于 50% 说明已成日常习惯（Andrew Chen）。
  - 月活跃天数分布（L28 曲线）。
  - 创作者占比。
  - 新帖 24 小时内获得回复的比例。
  - 审核处置时间。
- **下钻**：全站 → 频道或圈子 → 创作者或会话 → 内容 → 举报和处置记录。
- **陷阱**
  - DAU/MAU 这一个数会掩盖分布差异。
  - 消息量会被机器人和刷屏拉高。
  - 处置量上升不代表平台更安全。
  - 申诉推翻率低，也可能只是用户放弃了申诉。
- **图表**：L28 直方图（健康的形态是两头高的「微笑」）；贡献者分层堆叠图；审核队列账龄图；举报类型帕累托。
- **告警**：审核等待超过 SLA；某类举报突增；单账号发消息速率异常；头部创作者流失。

### 2.8 安全 / 风控 / WAF（WAF 面板、风控判定）

- **决策**：规则收紧还是放宽；封谁、放谁；现在是不是正在被攻击。
- **北极星指标**：在**误杀率受控的前提下**拦截攻击。只看拦截量是错的。
- **一级 KPI**
  - 请求处置分布：拦截、挑战、放行、由缓存直接返回。
  - 挑战通过率：偏高说明规则在误伤真人；对同一站点它通常很稳，突变往往意味着攻击来了（Cloudflare）。
  - 抽样误杀率：从被拦请求里抽样人工复核。
  - 封禁数和申诉数。
  - 验证码发码量和成本。
- **下钻**：全站 → 站点或路径 → 规则 → 来源（IP、ASN、国家）→ 单条请求日志。
- **对比**：同一站点自己同时段的历史基线；观察模式和拦截模式对照（行为观察默认只记录不拦截，就是为了先拿到这条基线）。
- **陷阱**
  - 采样日志不是精确计数。
  - 挑战没通过的大多是机器人直接放弃，不是真人失败。
  - 漏过的攻击在看板上看不见。
  - 在运营商共享出口 IP（CGNAT）下按 IP 计数会成片误伤。
- **图表**：处置结果堆叠面积图；规则表（命中数 × 通过率 × 抽样误杀率）；来源帕累托；规则 × 时间热力图。
- **告警**：某条规则通过率偏离基线；5 分钟内拦截量激增（可能是攻击，也可能是一波误杀，要两头查）；发码量或登录失败率突增；核心页面真人放行率下降。

### 2.9 技术运维 / SRE

- **北极星指标**：SLO 达成情况 + 剩余错误预算。
- **一级 KPI**
  - 四个黄金信号：延迟（成功和失败分开，看 P99）、流量、错误率、饱和度（包括「按现在的速度几小时后磁盘会满」这类预测）。
  - 服务用 RED（速率、错误、耗时），资源用 USE（利用率、饱和度、错误）。
- **下钻**：服务总览（RED）→ 接口或区域 → 实例（USE）→ 调用链和日志。
- **陷阱**
  - 均值和按分钟取平均会把尖峰抹平。
  - 用错误计数代替错误率。
  - 流量低的时候，比率噪声很大。
  - 复制出来的看板收不到原版的更新。
- **图表**：统一版式的 RED 小多图；延迟热力图；错误预算燃尽图；图上标注发布事件。
- **告警**：多窗口多燃烧速率规则（Google SRE Workbook）。例：1 小时和 5 分钟窗口同时超过 14.4 倍速率就呼人。只告警症状，不告警原因。

### 2.10 库存 / 兑换码 / 权益发放

- **北极星指标**：满足率，或「还能发多少天」。
- **一级 KPI**
  - 库存水位，按状态拆开：可用、锁定、已发、已核销、已过期。
  - 可发天数 = 可用量 ÷ 近 N 天日均消耗。
  - 缺货率。
  - 核销率 = 核销量 ÷ 发放量。
  - 过期沉淀率。
- **下钻**：总池 → 商品、面值或活动 → 批次 → 码段 → 单个码的生命周期。
- **对比**：按**批次 cohort** 看核销曲线。新批次核销率天然偏低，所以要按批次天龄来比。
- **陷阱**
  - 分母用发放量还是入库量，要写清楚。
  - 促销码和常规码要分开算。
  - 作弊领取会把发放率抬高。
  - 未核销的面值是一笔负债。
- **图表**：水位线 + 预测耗尽线；批次核销 cohort 热力图；状态流转桑基图；即将过期日历。
- **告警**：可发天数少于补货周期；兑换失败突增（可能有人在枚举码）；单个用户领取超限；大批码临近过期但还没发出去。

### 2.11 特权访问 / 跳板机（PAM：SSH 跳板机、密钥托管、人和 AI 的服务器授权）

- **决策**：收回谁的授权、吊销哪把人或 AI 的密钥【共识】；哪台机器先修（不可达、密钥失效、待接入）；哪个会话要回看或断开；审计、录像、备份链路本身有没有坏。
- **北极星指标**：**闲置常驻授权数**，越低越好 = 「人或 AI 密钥 × 机器」的授权还在，但 45 天内没用过。常驻特权是 PAM 的主要剩余风险，要看没在用的访问，不看授权总数（Teleport、AWS IAM Access Analyzer、Gartner）【共识】；45 天取 CIS Controls 5.3 的停用阈值。
- **一级 KPI**
  - 机器可达率 = 最近一轮体检正常 ÷ 已启用机器。
  - 闲置或过期凭据数 = 45 天没用的人 / AI 密钥 + 到期了还没失效的临时密钥【共识】。
  - 高风险会话率 = 24 小时内命中高危规则的会话 ÷ 全部会话；一个会话的风险取其中最高的一条命令（CyberArk）。
  - 审计完整率 = 有录像和审计记录的会话 ÷ 全部会话，目标 100%。
  - AI 密钥可追溯率 = 有归属人且有到期时间的 AI 密钥 ÷ 全部 AI 密钥（OWASP 非人身份 Top 10）【共识】。
- **解释指标**：在线会话数（人和 AI 分开）；各人查看密码次数【来源】NIST AU-6；按密钥的 AI 工具调用量；常驻代理版本覆盖率；备份红黄绿。
- **下钻**：KPI → 人或密钥 → 机器 → 会话录像和命令（可按风险筛）→ 审计原始记录。每个状态块都能点开对应清单。
- **对比**：各人、各密钥和自己的历史基线比（CyberArk）；上周同期。阈值由组织自己定，NIST 不给固定值；可参考闲置 45 天（CIS）、未用访问 90 天（AWS）。
- **刷新**：在线会话和可达率走实时快照，但要同时显示「体检于」和「数据截至」，因为体检本身几分钟才跑一次；授权治理类按日即可。
- **陷阱**
  - 把「执行命令总数」「拦截次数」这类只显得忙、不影响任何决定的数当 KPI（NIST SP 800-55）。
  - 只数授权不看使用：常驻但闲置的权限才是风险。
  - 审计或录像链路自己坏了，没人发现（Vault 把审计写入失败当一级指标）。
  - AI 密钥没有归属人，临时密钥到期不失效。
  - 体检没跑、心跳过期了还显示「正常」：最后一次心跳过期就按不健康算（HashiCorp Boundary）。
  - 照抄厂商默认阈值，不按自己的风险定。
- **图表**：状态分布条（正常 / 待定 / 失败，点开是清单）；常驻授权 Top N 表；安全事件时间线；人 × 机器授权关系图；KPI 带迷你趋势。
- **告警**：审计写入失败 > 0 立即告警，10 分钟没有任何审计写入也告警；机器连续两轮体检不可达；命中高危命令立即告警（可配自动断开）；临时密钥到期仍在用、新 AI 密钥没有归属人；AI 密钥第一次访问某台机器或某个工具。闲置 45 天进日报，不推告警。
- **小团队（约 10 人、几十台机器）**：高风险会话先用固定规则打分（`rm -rf`、`DROP`、改 sshd 配置等），AI 密钥异常先用「第一次访问」规则；统计行为建模、季度访问认证、成熟度评分先别做。

### 2.12 所有业务类型都适用的硬规则

1. 每个比例都同时显示分母。样本不够时灰掉显示，不告警。
2. 分组指标同时给出「各组的值」和「各组的占比」，防止辛普森悖论。
3. 耗时类指标用中位数和 P90，不用平均数。
4. 按人或按门店排名之前先设最低样本门槛；需要排名时优先用漏斗图或收缩估计。
5. 权威数据来自账本或业务库，事件流和埋点只用来看趋势，两者要定期对账。

---

## 3. 页面骨架（所有看板通用）

```text
┌ 面包屑（下钻两层以上才显示）  全平台 › 华东 › 上海店 ›
├ 页头：标题 = 这个看板回答的问题；描述 = 受众和查看范围
│        右侧：数据截至 10:42（Asia/Shanghai） · 刷新 · 自动刷新档位
├ 筛选行（全局）：时间范围 | 对比基准 | 维度（站点/渠道/地区…）| 重置
│        没用到某个筛选的面板要标「未应用：渠道」
├ 第一层：3-5 个主 KPI 卡（左上放最重要的）
├ 第二层：解释主 KPI 的图（拆解、趋势、分布），每张都能点击下钻
├ 第三层：明细表（DataTable，服务端分页，可导出）
└ 口径说明入口：每个指标的定义、负责人、口径版本
```

值班类把第一层换成「异常列表 + 状态灯」。对账类把第二层换成「差异账龄 + 待办表」。

---

## 4. KPI 卡片和指标字典

**卡片必备元素**，参考 Kuznetsova《Anatomy of the KPI card》、Few、Power BI，按字号从大到小：
1. 数值 + 单位，精度适当。
2. 简短名称。完整口径放在 tooltip 里，**从指标字典读，不在前端手写一遍**。
3. 比较：写明和什么比（「比上周同一天」「比目标」），给出变化值 + 箭头 + 好坏色。
4. 迷你趋势线。
5. 时间范围和「数据截至」。

**涨跌颜色看的是好坏，不是涨跌**【共识】：
- 箭头表示方向，颜色表示好坏。成本、延迟、流失、误杀率上涨要标红。
- 分不出好坏的指标用中性色。
- 一定要配箭头或文字，不能只靠颜色。
- 「越高越好」存在指标定义里，不要每张卡单独配置。

**空值和零**：没有数据显示「—」，合法的 0 显示「0」，二者不能混。MetricCard 的 value 传 `null` 就是「—」。

**每个项目维护一份指标字典**，一处定义、到处使用（dbt MetricFlow、Airbnb Minerva）：

```ts
type MetricDef = {
  key: string;             // "net_gmv"
  name: string;            // 净成交额
  formula: string;         // 支付 GMV − 支付后取消 − 退款（按原订单日回冲）
  unit: "CNY_minor" | "count" | "ratio" | "ms" | string;
  precision: number;
  better: "up" | "down" | "neutral";
  owner: string;           // 负责这个指标的人
  source: string;          // 表或视图，权威来源
  freshnessSlaMinutes: number;
  version: number;         // 口径改了就 +1，并在趋势图上标注生效日
  approx?: boolean;        // HLL 等近似值，界面标「≈」
};
```

口径改变时必须在所有相关趋势图上打「口径 vN 生效」标注。不要悄悄重算历史而不留痕迹。

---

## 5. 下钻与位置导航

- 口诀是「先总览，再缩放和筛选，细节按需给出」（Shneiderman 1996）。MLJAR 的四层模型：一切正常吗 → 问题在哪 → 为什么 → 具体是哪些。**下钻最多 3 层**【本规范】。
- **下钻和跳转要分开**（Microsoft）：
  - 下钻：在同一个图里沿层级走，比如 日 → 小时，页面不变。
  - 跳转：带着选中项跳到另一个详情页，比如从房间跳到房间详情。
- **筛选上下文必须跟着走**【共识】：时间范围、对比基准和各维度筛选自动带到下一层。当前生效的筛选始终可见，并能一键重置；目标页不支持某个筛选时，要明确提示。Grafana 的数据链接默认什么都不带，这是个反面例子，**所以我们要把「默认带上」做成框架的默认行为**，不能靠每个页面自己记得。
- **状态写进 URL**：`?from=now-7d&to=now&cmp=wow&game=fish&room=1000`。浏览器返回键必须能回到上一层并恢复原来的视图。不要用会破坏返回键的纯内存状态。相对时间要保存成相对表达，分享出去之后，别人打开看到的仍是「最近 7 天」。
- **面包屑**（NN/g 11 条、Smashing）：
  - 下钻超过 2 层才显示。
  - 显示层级位置，不显示访问历史。
  - 最后一项是当前层，不能点。
  - 手机上不折成多行，改为横向滑动，或者只保留「上一级」。
  - 本包 `Breadcrumbs` 的 `items[].onClick` 缺省时渲染为当前页。
  - 同层切换（比如换一个房间）可以在每一级加下拉，这叫横向面包屑，由宿主自己组合。

---

## 6. 时间范围与对比

- **预设**：今天、昨天、近 7 天、近 30 天、本月、上月、自定义。「近 7 天」**默认是 7 个完整日，不含今天**，界面上要写明。`ReportToolbar` 的 `presets` 可以直接传这些。
- **时区**：存储统一用 UTC `timestamptz`。查询时先换算到业务时区再截断到天，顺序反了，跨零点的数据会分错天。时区用 IANA 名称（`Asia/Shanghai`）。业务日不从零点开始（比如 05:00 日切）时，用 `(ts AT TIME ZONE tz - interval '5 hour')::date`，业务时区和日切时刻写进指标字典。WHERE 条件里不要把列包进函数：先把本地日期边界换算成绝对时间再比较，这样才能走索引。
- **对比基准**【共识】：
  - 日粒度：和**上周同一天**比（相差 7 天）。
  - 年同比：相差 **364 天**，这样星期对得上。用 365 天或「减 1 年」会错位。
  - 月环比：月份天数不同，31 天的月天然多约 3.3%，所以用日均比，或者「本月至今」对比「上月同样天数」。
  - 周内波动大的业务，看 7 日或 28 日滚动均值。
- **未结束的当期**【共识】：
  - 不要拿半天和整天比。当天只和上一周期**同样已经过去的那段时间**比（Looker 的 period-to-date）。
  - 趋势图的最后一个桶画成虚线或空心，标「进行中」。Few 的建议更严格：折线停在最后一个完整周期，当期值单独画。
- **缺失值**：折线要断开。不要把缺失画成 0，也不要用直线把两侧连起来（Few 2015）。
- **粒度自动选择**：`粒度 = max(时间跨度 ÷ 最大点数, 数据采集间隔)`（Grafana 的 $__interval）。默认档位【本规范】：
  - ≤6 小时：1 分钟
  - ≤2 天：5-15 分钟
  - ≤14 天：1 小时
  - ≤90 天：1 天
  - 更长：按周或按月
- 每条序列控制在 200-1000 个点，优先在服务端降采样。ECharts 可以设 `sampling: 'lttb'`。

---

## 7. 刷新

**刷新频率跟着数据变化频率走，不是越快越好**（Grafana：「数据一小时才变一次，就不需要每 30 秒刷新」）【共识】。
例外是实时档：实时档 **3 秒一刷**是本规范的硬标准。为了让 3 秒刷新既不拖垮服务、断了又看得出来，按 §7.1 把服务端、监控和显示三处一起做好。

| 面板 | 方式 | 频率【本规范】 |
|---|---|---|
| **实时档**：在线人数、各频道在线、实时充值和下单速率、支付通道成功率、风控拦截速率 | SSE 推送或轮询，按 §7.1 全链路配套 | **3 秒**（本规范硬标准） |
| 今日营收、今日 DAU、充值排行 | 轮询 | 1-5 分钟 |
| 比率容差判定（命中率、转化率） | 轮询 | 按小时 |
| 留存、LTV、周报、月报 | 手动刷新，T+1 生成 | — |
| 对账 | 按结算批次 | 按天 |

前端要求：
- 用 `useAdminResource(key, load, intervalMs, active)`（实时档用 `useLiveResource`）：**标签页隐藏时不刷新**，上一轮请求完成后才开始下一轮，所以不会重叠。
- 刷新期间**保留旧数据**；刷新失败时用 `InlineAlert` 提示「当前数据可能已过期」，不要清空页面。
- 多个面板的首次请求随机错开 0-10% 的间隔，不要同一秒一起刷新。出错重试用带全随机抖动的指数退避：`random(0, min(cap, base·2^n))`（AWS）。
- 贵的面板放在需要往下滚才看得到的位置，并做懒加载。
- **显示两个时间**：「数据截至」是源数据里最新事件的时间（水位线）；「拉取于」是请求完成的时间。距上次成功刷新超过 2 倍刷新间隔，标黄；超过该数据集的新鲜度 SLA，标红并写明原因。没有新鲜度提示的看板，要么没人信，要么在上游停了三天的情况下照样被当真。
- 用 SSE 的注意事项：
  - 一个页面只开一条连接，多路复用；HTTP/1.1 下同一域名最多 6 条连接。
  - 每 15-30 秒发一行 `:` 注释当心跳。
  - nginx 设 `proxy_buffering off`。
  - 事件带 `id`，断线重连时服务端按 `Last-Event-ID` 补发漏掉的事件。

### 7.1 实时档（3 秒）：服务端、监控、显示三处配套

**只有实时档用 3 秒**，范围见上表第一行。今日营收、留存这类要查汇总表的重面板**不跟着 3 秒刷新**，否则等于每 3 秒对数据库做一次全量聚合。
「3 秒刷新」说的是显示多久更新一次；「在线」怎么算是另一回事，口径写进指标字典，例如「最近 45 秒内有心跳或连接」。

**服务端：3 秒这条路径不碰数据库，所有人共读一份快照**

1. **在线数的来源**
   - 长连接服的每个实例每秒上报一次自己的连接数：`HSET rt:<站>:inst <实例ID> {"n":123,"ts":…}`。
   - 汇总时**只算 5 秒内上报过的实例**，这样挂掉的实例不会留下「幽灵在线」。
   - 纯 H5 或轮询型的，用心跳有序集合：`ZADD rt:<站>:hb <时间戳> <用户ID>`，在线数 = `ZCOUNT` 最近 45 秒的成员，并定期 `ZREMRANGEBYSCORE` 清掉过期成员。
2. **单一采集器**
   - 只有一个进程负责采集，用 `SET NX EX` 抢锁，拿到锁的才干活，多实例部署时不会重复算。
   - **每 1 秒**计算一次，写入 `rt:<站>:snap`：`{ts, seq, online:{total, byGame, byRoom}, rates:{…}}`，同时 `EX 15`，这样采集器挂了快照会自动消失，不会一直挂着旧数。
   - 同时 `XADD rt:<站>:series MAXLEN ~ 1200 …` 保留最近 1 小时、3 秒一个点的序列，给实时曲线做首屏数据。
   - 每分钟把「峰值 / 均值 / 最小值」落到 PG 的分钟表，长期趋势查这张表。3 秒粒度的数据只在 Redis 里留 1 小时。
3. **读接口**：`GET /admin/realtime/snapshot`
   - 只读 `rt:<站>:snap` 这一个 key，是 O(1) 操作。
   - 在服务端按查看者的权限范围裁剪后再返回（见 §8）。
   - 带 `ETag: <seq>`，客户端下一次带 `If-None-Match`，数据没变就回 304。
   - 响应头带 `Date`，前端据此校正本机时钟偏差。
4. **推送（二选一）**
   - **轮询**：每 3 秒请求一次上面的读接口，简单可靠。估算：50 个人同时开着后台，约 17 次请求/秒，全是 Redis GET，没有压力。
   - **SSE**：`GET /admin/realtime/stream`，**服务端只开一个 3 秒定时器**，每轮读一次快照，再分发给所有连接，不要每个连接各读一次 Redis。
     - 每条事件带 `id: <seq>`，并设 `retry: 3000`。
     - 每 15 秒发一行 `:` 注释当心跳。
     - nginx 设 `proxy_buffering off`，`proxy_read_timeout` 大于 60 秒。
   - 同时在看的人多，或者需要把多个实时指标合成一条流时，选 SSE。

**监控：实时数据链路本身也要被监控**

| 告警 | 条件【本规范默认】 | 说明 |
|---|---|---|
| 实时采集中断 | 快照超过 10 秒没更新，或 key 已经过期 | 说明采集器挂了，页面上的数已经不是实时的 |
| 实例失联 | 某个实例超过 10 秒没上报 | 这个实例上的用户可能全部掉线 |
| 在线断崖 | 1 分钟内下跌超过 30%，基数不少于 50，并且连续 3 个快照（9 秒）都满足 | 常见原因是服务崩溃或网络故障；只看一帧会被抖动误触发 |
| 在线异常飙升 | 超过上周同时段的 3 倍 | 可能是被刷或统计出错 |

**后台显示**

- **刷新方式**：用 `useAdminResource(key, load, 3000)`，或者 SSE。标签页隐藏时暂停；切回来立即拉一次，再恢复 3 秒节奏。
- **「数据截至」**：显示到秒，比如 `14:03:27`。用**快照里的 ts** 计算，不用请求完成的时间，并用 `Date` 头校正时钟偏差。
- **新鲜度三档**：
  - 数据距今不到 6 秒（2 倍间隔）：正常。
  - 6 秒以上：标黄「延迟」。
  - 15 秒以上：标红「实时中断」，数字保留最后一次的值并变灰，不能显示成 0。
- **数字**：用 `font-variant-numeric: tabular-nums`，每位数字等宽，数值变化时整行宽度不跳。**不要用滚动计数动画**（count-up），它会每 3 秒闪一次。可以附一个小字「比 1 分钟前 +12」。
- **实时曲线**：
  - 滚动显示最近 30 分钟，3 秒一个点，共 600 个点。
  - 首屏用 `series` 流里的数据，之后每帧只追加一个点：`setOption` 合并更新，`animation: false`，**不要销毁重建图表**。
  - 横轴时间精确到秒。
- **失败处理**：
  - 失败时**不要每 3 秒弹一次提示**。只显示一条页内提示，数字变灰。
  - 连续失败 3 次后按 3 → 6 → 12 秒退避，最长 30 秒，同时显示「重连中」。
  - 恢复后回到 3 秒节奏。
- **无障碍**：`aria-live` **只在状态变化时播报**（中断 / 恢复），不要每 3 秒念一遍数字。

---

## 8. 查看范围（数据权限）

- **权限范围和筛选是两层，不能混**：
  - 权限范围由服务端强制：谁能看哪个站点、地区、渠道。
  - 筛选是用户在自己权限范围内的收窄。
  - 前端下拉框不是权限。**URL 里的参数必须和用户的权限范围取交集**，不能信。
- **默认拒绝**：没有配置范围的人什么也看不到。Superset 早期的 RLS 只作用于被规则点名的角色，结果不属于任何角色的人看到了全部数据。同一维度的多条授权要合并成 OR，不能做 AND：同时属于 A、B 两个部门的人，做 AND 就会被算成零行。
- PostgreSQL RLS 的要点：
  - 用 `set_config(k, v, true)`，只在当前事务内生效。用普通 `SET` 会通过连接池把上一个租户的上下文漏给下一个请求。
  - 表上加 `FORCE ROW LEVEL SECURITY`。
  - 视图加 `security_invoker=true`（PG15 起支持），否则视图会绕过 RLS。
- **Redis 缓存键必须带权限范围的哈希**，否则缓存会在不同的人之间串数据。
- 收藏视图保存：名称 + URL 状态 + 所有者 + 分享范围。打开时**按查看者自己的权限范围重新计算**。
- 能排名到个人的面板（客服、销售）要单独授权，个人信息打码。

---

## 9. 后端聚合

- **分层预聚合**：原始事件 → 小时汇总表 → 天汇总表。汇总表用 `INSERT … ON CONFLICT DO UPDATE` 每次重算最近 N 小时的桶。
- **按时间跨度路由**【本规范】：
  - ≤48 小时：查原始表或小时表。
  - 更长：查天表。
  - 「今天」：历史汇总 + 原始数据的尾巴，union 起来（Cube 的 lambda 做法）。
- **迟到数据**：每次重算的回看窗口按实测迟到时长定，比如迟到 SLA 是 6 小时，回看就取 12 小时。窗口外的迟到数据走显式回补任务。整条链路必须幂等：事件带 `event_id`（UUIDv7），写入用 `ON CONFLICT DO NOTHING`。
- **缓存**：
  - 键 = 指标 + 口径版本 + 权限范围哈希 + 归一化后的时间范围 + 粒度。`now` 向下取整到桶，同一分钟内的请求才能命中同一个键。
  - TTL = 刷新间隔 ± 10% 抖动。
  - 未命中时用 `SET NX EX` 抢锁，只让一个请求回源重算。可以先返回旧值，后台再更新（stale-while-revalidate）。
- **大表计数**：列表总数用 `pg_class.reltuples` 估算，显示「约 X 条」；需要精确值就维护计数表。GitLab 实测：精确计数 15 秒，估算 1 毫秒。
- **去重计数（DAU）**：每天存一个 HLL sketch，周活、月活用合并算，误差约 ±2.3%，界面标「≈」。**涉及钱的数字绝不用近似算法。**
- 看板的 SQL 和汇总逻辑放在服务端的 core/db 层，前端只拿已经算好的结果。**不在 UI 里算财务规则**（catalog 里 metrics 那条的约束）。

---

## 10. 状态与事件标注

- 每张卡、每个面板**单独处理**加载和错误，一张卡挂了不影响整页。加载用骨架屏（`Skeleton`），不用整页转圈。
- 四种状态要分开表达：首次加载失败（`StatePanel kind="error"`，带重试）、没有任何数据（空状态，给下一步操作）、筛选后无结果（提供清空筛选）、刷新失败但有旧数据（旧数据 + 过期警示）。**首次加载失败不能显示成「暂无数据」。**
- **事件标注**：发布版本、活动开服、节假日、渠道投放、故障、口径变更，都作为一个统一的事件源，叠加到所有时间序列图上（Grafana annotations、Datadog Change Overlays），悬停能看到说明。大部分「数据突然变了」的问题，看一眼标注就能找到原因。

---

## 11. 告警和看板的分工

- 不要让人一直盯着看板【共识：Google SRE】。需要人去处理的**症状**推告警，其余的留在看板上看。多数看板应该从告警链接点进来。
- 持续偏离才告警：每条规则都设一个持续时间（Prometheus 的 `for`），关键告警 5-10 分钟，一般告警 15-30 分钟。
- 有周期规律的业务，用「上周同一天同一时段」做基线。例：连续 3 个 5 分钟桶都低于基线的 60% 才告警。
- 小样本不告警：比例类告警必须同时满足最低样本量。
- 数据管道滞后超过新鲜度 SLA，本身也要告警，不能只在看板上变红。

---

## 12. 视觉规范与组件细节（让看板既专业又不出低级错误）

以下数值综合了 Carbon、Cloudscape、GitLab Pajamas、Atlassian、AntV / Ant Design Pro、Tremor、shadcn charts 的官方规格（2026-09-24 调研，来源见文末）。本包的组件已经按这些数值实现，**用组件就自动符合**，不要在页面里另写一套。

### 12.1 KPI 卡

| 项 | 规格 | 依据 |
|---|---|---|
| 指标名 | 14px，字重 500，次要文字色，一行，超长省略 | Ant Pro 14/22，Carbon label 12-14 |
| 主数值 | 三档（审阅 06）：大 28（北极星，可带子弹图）/ 标准 24 / 紧凑 20（汇总卡、窄格，不画趋势）——`KpiCard size="lg" \| "md" \| "sm"`；手机 22；字重 600，**`tabular-nums` 等宽数字**，不换行 | Carbon 28/36，Tremor 30 semibold |
| 单位 | 数值后面，13px 次要色；货币符号放数值前 | Carbon「一个数字 + 一个词」 |
| 变化值 | 12px 加粗，**和选项标签同形：圆角 6、无边框软底** + 语义色字（按好坏，成本 / 周期 / 丢单率下降 = 主色），**必须有箭头和正负号**，后面紧跟「比什么」；比率写 pp，从 0 增长写「新增」 | Tremor Badge、GitLab single stat |
| 迷你趋势线 | 32px 高，线宽 1.5px，不画坐标轴；**用 SVG，不开图表实例** | Ant Pro 46、Tremor 32-48；手机上几十个 canvas 会耗尽内存 |
| 卡片 | 内边距 20px（手机 14px）；同一行等高；1px 边框和极轻阴影二选一 | Carbon 16、Cloudscape |
| 每行张数 | 按张数定列，不留孤卡：≤5 张一行，6 张 3×2，7-8 张每行 4；≤1100px 每行 2（张数为奇数时最后一张占满一行），≤374px 每行 1。用户自己拼的看板用「数字组」（2–6 个等宽数字，手机两列） | Ant Pro xl=6/24、「一行不超过四个」 |
| 大数字 | ≥1 万用万/亿缩写（1 位小数），**精确值放 `fullValue`**，悬停可见、读屏可读 | Ant Design 数据格式 |
| 空值 | 没有数据显示「—」，合法的 0 显示「0」，二者不能混 | Cloudscape、Grafana |
| 卡片页脚 | 注脚与「查看明细」放不下时换行，链接不折成一字一行；手机上「查看明细」和口径按钮至少 40px | WCAG 2.5.8 触控目标 |

### 12.2 颜色

- **颜色只花在数据上。** 界面用中性色；图表色不拿去当按钮、标签这类界面元素的颜色（Cloudscape、Linear）。
- **颜色全从色卡来**：`chartColors(palette)` 给出全部图表色，`AdminChart` 自动换；换色卡、深色自动跟。构造器里只写 token（`VIZ_BRAND`、`vizBrandStep(i)`、`vizCategory(i)`、`VIZ_OTHER`、`vizOptionColor(hue)`、`VIZ_TEXT` …），不写死十六进制。
- **类别用选项标签色**：选项 10 色里固定顺序的 8 个——蓝 · 橙 · 青 · 粉 · 橄榄 · 紫 · 黄 · 红（`VIZ_CATEGORY_HUES`）；灰 = 「其他」；绿 = 主色，留给单系列 / 「本期」。维度是单选 / 多选字段时**直接用选项自己的标签色**（表格里「报价」是黄标签，图里也是黄）。
  - 按实体分配、顺序固定，筛选掉一部分系列也不能重新上色。第 9 个系列并进「其他」（不循环）。
  - 同明度的标签色在色盲下区分度有限：**必须有图例或直接标签，并提供「查看数据」**（`AdminChart` 的 `table`）；折线 ≤ 6 条、环 ≤ 5 片。
- **单系列 / 有顺序的类别用主色**（同一个绿：柱、漏斗、子弹图、迷你趋势、进度环；深色 = 深色色卡的主色，不再「主色混 35% 白」）。主色深浅只用于单系列或有序分档，不拿来区分类别。
- **状态色单独一套**（主色 / 注意 / 异常 / 灰，`chartColors().status`），不能当「第 4 个系列」用，并且永远配图标或文字。
- **顺序色**（热力表、cohort）= 面板色 → 主色 13 档（`chartColors().sequential` / `vizBrandStep`），**深色也从面板色起步**，不出浅色亮块；只有很深的格子（> 72%）才反白字。**发散色**用信息色 ↔ 异常色，中点线色灰；不用红↔绿。
- **涨跌颜色按好坏上色，不按涨跌上色。** 成本、流失、误杀率上涨标红。**红涨绿跌只用于金融行情类页面**（AntV、金蝶 KDesign 的惯例），运营和运维看板不用。同一张卡里如果按行情惯例用了红色，红色就不能再表示错误。
- 深色模式不是简单反色：色板有深色专用的一套，图表的轴线、文字、网格线从色卡算（网格 = 线色 62% 混面板色，字 = 次要 / 备注色，提示框底 = 面板色）。

### 12.3 图表

- 一个面板一张图，最多两种图形。标题写这张图回答什么问题；副标题写时间窗和排除条件（GitLab）。
- **只有一个系列时不要图例**，标题已经说明了它是什么；多系列时图例放左上（10×10 圆角方块）。折线最多 6 条，环最多 5 片（第 5 片是「其他」），多出来的并进「其他」，或者只高亮前 N 条、其余置灰。
- **10 种统一样子**（`@adminui/react/charts`）：柱 `barOption`（顶圆角 4、最宽 32、间隙 42%，柱顶数字 11px 次要色）· 条形 `barOption({ horizontal })`（排行，`highlight` 突出「我」）· 饼（只 2–3 片）· 折线 `timeSeriesOption` · 环 `donutOption`（中间写合计，旁边数值图例）· 面积（单系列 10% 填充，不用渐变）· 实际 vs 目标 `targetBarOption`（柱 + 目标横线 + 进行中虚线，提示框带完成率）· 堆叠 `stackedBarOption`（段间 1px 缝，只有顶段圆角，提示框带合计）· 漏斗 `StepFunnel` · 迷你趋势（SVG 一套）。提示框统一 `tooltipHtml`：圆角 8 + 浮层阴影，每行 色块 + 名称 + 右对齐等宽数值 + 单位；分布图的提示框写指标名（「客户数：117 位」），不写「实际」。钱带货币和单位，≥ 1 万写「万」。
- **卡头**：标题回答一个问题 + 灰字（时间窗 · 单位）；卡头只露「自定义口径」「覆盖看板筛选」，标准口径不挂签（口径在说明里）。
- **7 种状态都和图一样高**（`ChartState`，`AdminChart` 的 `loading` / `empty` / `noMatch` / `error` / `stale` / `forbidden`）：骨架柱 + 扫光（不是每张卡一个「××加载中」）、没有数据、筛选无结果（给「清空筛选」）、失败（只坏这一张，重试）、刷新失败（留旧图 + 注意条写清是几点的数据）、无权限（锁，不显示 0）。
- 柱图从 0 开始；折线图可以不从 0 开始（`scale`）。**不用双 Y 轴、不用 3D、不用渐变填充、不用彩虹色、不用仪表盘和超过 5 片的饼图**（Few、Cloudscape）。
- 网格线只画横向，颜色很浅；刻度取整（例如 `118.4%` 这种零碎刻度是瑕疵）。
- 时间轴刻度：一天内显示 `HH:mm`，跨天在零点显示 `MM-dd`，一周以上只显示日期；放不下的刻度自动隐藏（`hideOverlap`），不会再出现 ECharts 默认在零点写的孤零零的「24」（`timeSeriesOption`、`toleranceBandOption` 内置，自写时间轴用 `timeAxisLabel(value, spanMs)`）。
- 缺数据处断线，不画成 0，也不用直线连过去（`withGaps`）。当期没结束的最后一段画虚线（`timeSeriesOption` 的 `inProgress`）。
- 发布、活动、故障、口径变更作为事件标注叠在时间轴上：单点事件用竖虚线，区间事件用浅色底；标注文字横排。
- 热力表格子之间留 2px 间隙；格子里的文字按底色深浅切换黑白；未到期的格子留空，不能画成 0。
- 手机上图表不横向滚动（横向滚动只留给表格）；提示框用 `confine`，并按轴触发，手指不用点得很准。

### 12.4 组件层面已经处理掉的坑（不用组件时必须自己处理）

| 坑 | 表现 | 本包做法 |
|---|---|---|
| 每次数据变化都重建图表 | 3 秒刷新时一闪一闪；用户缩放的范围、图例的选择被复位 | 实例只建一次，数据用 `replaceMerge:['series']` 增量合并；只有明暗切换才重建 |
| 在隐藏的标签页里初始化 | 容器宽高为 0，图表白屏 | 等容器有尺寸才初始化，`visible` 变真时 `resize` |
| 滚动条出现又消失 | `ResizeObserver loop` 报错，图表来回抖 | resize 放进 requestAnimationFrame，忽略 2px 以内的变化 |
| 自定义 tooltip 拼 HTML | 系列名、门店名里的 `<script>` 被执行（存储型 XSS） | builder 里所有用户文字都经过 `escapeHtml` |
| canvas 读不了 CSS 变量 | 深色模式下轴线和文字还是浅色主题的灰 | 初始化时用 `getComputedStyle` 读出 token 实际值，注册成主题 |
| 堆叠面积画容差带 | 下界为负时带子画错位置 | `stackStrategy:'all'` |
| 数字等比宽 | 3 秒刷新时整行宽度跳动 | 数值、变化值、表格统一用 `tabular-nums` |
| 数字滚动动画（count-up） | 每 3 秒闪一次，读数变慢，前庭敏感的用户会不适 | 不做；实时面板关闭图表动画 |
| `aria-live` 挂在数字上 | 读屏每 3 秒念一遍数字 | 只在「实时 / 延迟 / 中断」状态变化时播报 |
| 比率用相对百分比 | 转化率从 2% 到 3% 写成 +50% 或 +1%，两种都会误导 | `computeDelta(..., { mode: "points" })` 输出 `+1.0pp` |
| 从 0 增长、跨零 | 显示 ∞% 或 +300% | 显示「新增」「由负转正」 |
| 占比四舍五入 | 各项加起来 99% 或 101% | `roundShares` 最大余数法 |
| 小样本 | 排行榜两头全是样本很少的门店或用户 | `judgeAgainstBand` 样本不足时返回 insufficient：灰色空心显示，不判断，不告警 |

### 12.5 组件对照表

| 需要 | 用什么 |
|---|---|
| 页面头之后的整页区块 | `PageBody`（统一 16px 间距） |
| 看板分区（标题就是这块回答的问题） | `DashboardSection` |
| KPI 行 | `KpiGrid` + `KpiCard`（变化值用 `computeDelta` 算出后传入；`MetricGrid`/`MetricCard` 用于没有对比基准的简单计数） |
| 实时档 3 秒 | `useLiveResource` + `LiveStatus`（§7.1） |
| 普通刷新 | `useAdminResource`（带间隔）+ 一个「刷新」`Button`，失败用 `InlineAlert` 提示过期 |
| 趋势 / 实时曲线 | `timeSeriesOption` → `AdminChart`（实时面板加 `live`） |
| 命中率、转化率等有理论值的比率 | `toleranceBandOption`、`funnelPlotOption`，判定用 `judgeAgainstBand`，要多少样本用 `roundsForTolerance` |
| 留存 | `cohortHeatmapOption` |
| 数字格式 | `formatNumber`（万/亿、真减号）、`MoneyDisplay` / `formatMinorMoney`（以分为单位的 bigint，不经过浮点） |
| 时间范围 / 下钻 / 明细 / 异常 | `ReportToolbar` / `Breadcrumbs` / `DataTable` / `InlineAlert`、`StatePanel` |
| 看板筛选行（时间 · 对比 · 维度 · 保存为我的 · 重置），状态进 URL、下钻带走 | `DashboardFilterBar` + `useDashboardFilters`、`carryFilterContext`（§5） |
| 目标完成度 | `BulletBar`；KPI 卡 `target` + `timeProgress`；手机个人进度才用 `ProgressRing` |
| 变化值（卡片、表格格子） | `DeltaBadge`（格子里 `size="sm"`） |
| 转化漏斗 / cohort 表 / 每期 vs 目标柱 | `StepFunnel` / `CohortTable` / `targetBarOption` |
| 总览里每个实体一张卡 | `RollupCard` |

目标 / 筛选 / 漏斗 / cohort / 汇总卡 / 进度环的例子是 starter 的「团队今日示例」（`TeamTodayDashboard.tsx`，样稿 D29）和「看板部件」（`DashboardKitShowcase.tsx`，样稿 D30 / D31 / D29m），验收脚本是 `npm run test:dashboards-kit`。


### 12.6 目标、筛选、漏斗、cohort、汇总卡（看板部件）

- **目标完成度只用子弹图**（`BulletBar`）：实心条 = 当前，竖实线 = 目标，竖虚线 = 按时间进度这时候应该到哪（`timeProgress` = 已过的天数 / 工作日 ÷ 总数，假期按业务日历由宿主算），灰阶分档（`bands`）越深越差。目标在量程末端时只写「目标」，不在末端时写「目标 80%」。周期没结束标「进行中」（`KpiCard tag={{ label: "进行中", tone: "info" }}`），不拿半期和整期比（§6）。
- **`ProgressRing` 只用于一个人在手机上看自己的进度**（「我的今天」：已跟 7 / 12，目标刻度在 80%）。团队、业务线、公司层面，以及桌面 KPI 行、表格、汇总卡，一律用子弹图——环和仪表盘读不准、也不好横向比较（§1）。
- **指标还没有数据源**（财务模块未上线）：`KpiCard placeholder="财务模块上线后显示"`，显示「—」和原因，不显示变化值，不画 0。
- **比例写分母**（§2.12）：`KpiCard detail="32 / 49 个到期计划"`；漏斗每步写「268 / 312」；cohort 行头写批次人数。
- **筛选行**（`DashboardFilterBar`）：时间分段保存成相对值（「today」不是日期），对比每项带一句说明，当前对比有特殊原因（遇假日自动改比上一个工作日）用 `compareNote`；有值的维度胶囊是浅主色底；「重置」回到看板的标准筛选。`useDashboardFilters` 把非默认值写进地址栏、返回键回到上一组筛选；下钻 / 跳转用 `carryFilterContext(value, 目标页支持的维度)`，返回的 `dropped` 在目标页写成 `unapplied`（「未应用：渠道」）。地址里的值只是请求，服务端仍按查看范围取交集（§8）。
- **漏斗**（`StepFunnel`）：按进线批次在固定天龄读数，不用「本月成交 ÷ 本月进线」；条是主色（有序量级，不是类别也不是状态），只有「流失最多」用注意色；默认按流失人数标，`dropBy="rate"` 按最低转化率标。
- **cohort 表**（`CohortTable`）：主色单色相深浅（颜色 = 量级），格间 2px，没到天龄的格写「未到期」，不是 0 也不是空白；只拿同天龄比较。
- **每期实际 vs 目标**（`targetBarOption`）：柱子主色，目标是每期一条横线，当期虚线空心标「进行中」，没开始的期留空；单位写在面板副标题（「万元 · 横线 = 当月目标」）。
- **总览汇总卡**（`RollupCard`）：每个子公司 / 业务线一张，值 vs 目标子弹图（含时间进度）、异常胶囊（危险色 + 图标）、3–4 格指标条、「进入业务线经营」下钻（带筛选）。不同币种各写原币，只在集团合计折算。

**仍需项目自己做的**：指标字典（§4 的 `MetricDef`，放在项目的 contracts 里）、服务端的聚合与快照（§7.1、§9）、查看范围（§8）。

---

## 13. 交付验收清单

- [ ] 回复或设计文档里有 §0 分类卡，版式与用途对应（§1），指标来自对应模板卡（§2）；业务类型不在 §2 里的，已按 §0 先调研并回流新模板卡。
- [ ] 每个 KPI 都有口径、单位、比较基准、好坏方向，并在指标字典里登记；比例同时显示分母。
- [ ] 小样本已处理：概率类看板有容差带或漏斗图，排名有样本门槛。
- [ ] 下钻时筛选跟着走，状态在 URL 里，返回键可用，超过两层有面包屑。
- [ ] 时区和日切写明；「近 N 天」是否含今天写明；当期未结束有标注；缺失值断线显示。
- [ ] 刷新档位符合 §7；实时档是 3 秒，并按 §7.1 做了服务端快照、监控告警和显示三档新鲜度；显示「数据截至」；刷新失败保留旧数据并提示；标签页隐藏时不刷新。
- [ ] 查看范围由服务端强制，URL 参数和权限取交集，缓存键带权限范围。
- [ ] 大时间跨度查汇总表，不对原始表做全量 COUNT；钱不用近似值。
- [ ] 加载、空、筛选无结果、失败、过期五种状态都能区分；桌面、360 和 390 像素手机宽度、深色模式都**截图并亲眼看过**，对照 §12 检查：KPI 卡没有孤卡、数字没有撑破卡片、刻度是整数、图例没有和轴标题叠在一起、深色模式下没有浅色色块。
- [ ] 该告警的条件已接入告警，而不是只在页面上变红。

---

## 参考来源（精选）

看板结构、下钻与导航：
- [ClearPoint：KPI 看板做法](https://www.clearpointstrategy.com/blog/kpi-dashboard-best-practices)
- [MLJAR：逐层下钻](https://mljar.com/ai-prompts/data-visualization-specialist/dashboard-architecture/prompt-drill-down-navigation/)
- [Smashing：面包屑](https://www.smashingmagazine.com/2022/04/breadcrumbs-ux-design/)
- [Smashing：实时看板的 UX](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- [NN/g：面包屑 11 条](https://www.nngroup.com/articles/breadcrumbs/)
- [Few：看板常见错误](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)
- [Few：子弹图规范](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- [Few：缺失值与未完成周期](https://www.perceptualedge.com/articles/visual_business_intelligence/missing_values_and_incomplete_periods_in_time_series.pdf)
- [Shneiderman 1996](https://www.cs.umd.edu/hcil/trs/96-13/96-13.html)
- [Microsoft：钻取跳转](https://learn.microsoft.com/en-us/power-bi/guidance/report-drillthrough)
- [Carbon：看板](https://carbondesignsystem.com/data-visualization/dashboards/)
- [Cloudscape：服务看板](https://cloudscape.design/patterns/general/service-dashboard/)
- [Cloudscape：加载与刷新](https://cloudscape.design/patterns/general/loading-and-refreshing/)
- [KPI 卡片的构成](https://nastengraph.substack.com/p/anatomy-of-the-kpi-card)

刷新、时间与数据：
- [Grafana 看板最佳实践](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/)
- [Grafana URL 变量](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/create-dashboard-url-variables/)
- [Looker 同期对比](https://docs.cloud.google.com/looker/docs/period-over-period)
- [TanStack Query 轮询](https://tanstack.com/query/latest/docs/framework/react/guides/polling)
- [AWS：退避与抖动](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Superset RLS 默认拒绝](https://github.com/apache/superset/pull/10946)
- [postgresql-hll](https://github.com/citusdata/postgresql-hll/blob/master/README.md)
- [PostgreSQL 慢计数](https://wiki.postgresql.org/wiki/Slow_Counting)
- [dbt 语义层](https://docs.getdbt.com/docs/use-dbt-semantic-layer/dbt-sl)
- [Google SRE 监控](https://sre.google/sre-book/monitoring-distributed-systems/)
- [SRE Workbook：SLO 告警](https://sre.google/workbook/alerting-on-slos/)


统计方法：
- [漏斗图（Spiegelhalter 2005）](https://pubmed.ncbi.nlm.nih.gov/15568194/)
- [经验贝叶斯收缩](http://varianceexplained.org/r/empirical_bayes_baseball/)


视觉规范与组件：
- [Carbon 数据可视化](https://carbondesignsystem.com/data-visualization/dashboards/) · [Carbon 色板](https://carbondesignsystem.com/data-visualization/color-palettes/)
- [Cloudscape 数据可视化配色](https://cloudscape.design/foundation/visual-foundation/data-vis-colors/) · [Cloudscape 看板条目](https://cloudscape.design/patterns/general/service-dashboard/dashboard-items/)
- [GitLab Pajamas 单值组件](https://design.gitlab.com/data-visualization/single-stat) · [GitLab 看板](https://design.gitlab.com/patterns/dashboards/)
- [Atlassian 数据可视化配色](https://atlassian.design/foundations/color-new/data-visualization-color)
- [AntV 色板](https://antv.antgroup.com/zh/specification/language/palette/) · [Ant Design 数据格式](https://ant.design/docs/spec/data-format-cn)
- [Tremor Badge](https://tremor.so/docs/ui/badge) · [shadcn charts](https://ui.shadcn.com/docs/components/chart)
- [ECharts replaceMerge（PR #12987）](https://github.com/apache/echarts/pull/12987) · [ECharts 安全：formatter 不转义](https://echarts.apache.org/handbook/en/best-practices/security/) · [堆叠带 stackStrategy（PR #17086）](https://github.com/apache/echarts/pull/17086)
- [MDN font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric) · [MDN ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)

其他业务类型：
- [ChartMogul MRR 变动](https://help.chartmogul.com/article/163-understanding-mrr-movements)
- [a16z 创业指标](https://a16z.com/16-startup-metrics/)
- [Stripe 支付分析](https://docs.stripe.com/payments/analytics)
- [Stripe 打款对账](https://docs.stripe.com/reports/payout-reconciliation)
- [Adyen 结算明细](https://docs.adyen.com/reporting/settlement-reconciliation/transaction-level/settlement-details-report)
- [Metabase 银行对账看板](https://www.metabase.com/dashboards/bank-reconciliation)
- [Shopify 转化指标](https://www.shopify.com/blog/conversion-metrics)
- [Baymard 购物车放弃率](https://baymard.com/lists/cart-abandonment-rate)
- [AppsFlyer 回看窗口](https://support.appsflyer.com/hc/en-us/articles/208338403-Set-up-lookback-windows)
- [Zendesk SLA](https://support.zendesk.com/hc/en-us/articles/5600997516058-About-SLA-policies-and-how-they-work)
- [Andrew Chen：power user 曲线](https://andrewchen.com/power-user-curve/)
- [TSPA 内容审核指标](https://www.tspa.org/curriculum/ts-fundamentals/content-moderation-and-operations/metrics-for-content-moderation/)
- [Cloudflare 挑战通过率](https://developers.cloudflare.com/cloudflare-challenges/reference/challenge-solve-rate)

特权访问 / 跳板机（PAM）：
- [Teleport 常驻特权看板](https://goteleport.com/docs/identity-security/usage/dashboard/) · [Teleport 会话录像架构](https://goteleport.com/docs/reference/architecture/session-recording/) · [Teleport 与 AI 代理](https://goteleport.com/use-cases/agentic-ai/)
- [CyberArk 会话高风险活动](https://docs.cyberark.com/pam-self-hosted/latest/en/content/pasimp/analyzing-high-risk-activities-during-psm-sessions.htm) · [CyberArk 保护 AI 代理](https://docs.cyberark.com/manage/latest/en/content/secureai/introduction.htm)
- [StrongDM 报表与使用率](https://docs.strongdm.com/admin/audit/reports)
- [Delinea Secret Server 看板组件](https://docs.delinea.com/online-help/secret-server-11-5-x/admin/application-dashboard/dashboard-components/index.htm)
- [BeyondTrust Password Safe 门户](https://docs.beyondtrust.com/bips/v25.1/docs/ps-web-portal)
- [AWS IAM Access Analyzer 未用访问](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-concepts.html)
- [HashiCorp Boundary 健康检查](https://developer.hashicorp.com/boundary/docs/operations/health) · [HashiCorp Vault 审计指标](https://developer.hashicorp.com/vault/docs/internals/telemetry/metrics/audit)
- [CIS Controls v8.1 第 5 条（账号管理）](https://cas.docs.cisecurity.org/en/latest/source/Controls5/) · [第 6 条（访问控制）](https://cas.docs.cisecurity.org/en/latest/source/Controls6/)
- [NIST SP 800-53 AC-2](https://csf.tools/reference/nist-sp-800-53/r5/ac/ac-2/) · [AC-6](https://csf.tools/reference/nist-sp-800-53/r5/ac/ac-6/) · [AU-6](https://csf.tools/reference/nist-sp-800-53/r5/au/au-6/) · [SP 800-55（2024）](https://csrc.nist.gov/news/2024/nist-releases-volumes-1-and-2-of-sp-800-55)
- [OWASP 非人身份 Top 10（2025）](https://owasp.org/www-project-non-human-identities-top-10/2025/top-10-2025/)
- [Gartner PAM 市场概览](https://www.gartner.com/en/insights/gartner-market-overviews/privileged-access-management)（付费，另见 [Britive 转述](https://www.britive.com/resource/blog/privileged-access-management-gartner/)）
- [Daylight：别做虚荣指标](https://daylight.ai/blog/soc-metrics)

<!-- bt/builders-b -->
## 14. 看板搭建器（用户自己拼看板，样稿 D32）

`@adminui/react/dashboard-builder` 的 `DashboardBuilder`（页面用 T17 看板搭建器模板）。用户自己拼的看板也要守本规范，组件已经替你守了下面几条，宿主要做的写在后面。

- **口径**（§4）：组件库里的「标准组件」和设置里的「标准指标」来自宿主的指标字典（`metrics`，`DashboardMetricDef` 是 §4 `MetricDef` 的子集），口径不能在看板里改，组件标「标准口径 vN」；用户换成「自定义」要写口径说明，组件头上一直标「自定义口径」（悬停看说明）。要大家都用，请指标负责人加进字典，不在看板里传播自定义口径。
- **筛选上下文**（§5）：看板的筛选行（`DashboardFilterBar`）作用于全部组件；组件可以加自己的条件，可以改对比基准、可以不跟某个维度——改了就在组件头标「覆盖看板筛选」，设置里写「已覆盖看板筛选：对比、组」。`widgetFilterContext(widget, ctx)` 算出这个组件实际用的筛选，`loadWidgetData` 拿到的就是它。
- **组件**（`WIDGET_KINDS`）：数字组（2–6 个等宽数字，`items`）、数字卡 = `KpiCard`（`size` 三档）、柱 / 条形 = `barOption`、折线 = `timeSeriesOption`、环 = `donutOption`、堆叠 = `stackedBarOption`（`query.stackBy` 第二个维度）、实际 vs 目标 = `targetBarOption`（当期虚线「进行中」）、子弹图 = `BulletBar`（不用环和仪表盘，§1）、汇总 = `RollupCard`、漏斗 = `StepFunnel`、批次 = `CohortTable`、表格 = `CompactTable`、文字。目标值存在卡片上（`widget.target`，设置里「目标值」）。没数据用 `{ kind: "empty" }`（筛选后没有 = `filtered: true`），看不到的字段用 `{ kind: "forbidden" }`，不要画 0。
- **宿主要做的**：`loadWidgetData` 在服务端按查看者的权限范围取交集再聚合（§8、§9；看板分享给别人时按对方的权限出数，`permissionNote` 收在工具条的「?」里）；看板 JSON 存服务端；组件和 `normalizeDashboard` 只读 schema `version: 2`，**存量数据先过 `migrateDashboardSpec(spec)`**（读回来时调，或一次性把表迁完）再交给 `normalizeDashboard`；不同人看同一个看板时，查询缓存键要带权限范围。
- **布局**：6 列网格、**行高 28px**（数字卡 ≈ 108px = 3 行，图 ≈ 308px = 8 行）、组件不重叠、自动往上收。存量看板（没有 `version` 或不是 2，行高按 64px 存的）由 `migrateDashboardSpec` 把 y / h 按 (64 + 12) ÷ (28 + 12) = 1.9 倍换算，原来挨着的仍挨着，大小基本不变，`version` 记成 2；这是看板唯一的数据升级函数。手机（< 760px）按阅读顺序只读（数字卡两列），并提示「请在电脑上编辑」。
- **搭建器的样子**（审阅 06）：工具条一行 52px；组件库 248px 可收成 56px 图标栏；设置面板只在选中卡片时出现；卡片工具（复制 / 设置 / 删除）在卡头里，悬停 / 选中才出；改大小显示「3 列 × 10 行」；拖动时虚线占位、其他卡让位。
- **看板页**：仪表盘标签和视图同一种（`DashboardTabs`，放 `ViewTabs` 的 `trailing`），公司默认 = 楼、我的 = 人；筛选行不套卡、一行、改过才出「重置」，手机收成 时间胶囊 +「筛选 · n」底部弹层；报表工具条（`ReportToolbar`）同一条，选了就查，没有「查询」。
