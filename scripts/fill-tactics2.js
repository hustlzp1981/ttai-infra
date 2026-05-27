require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
var URI='mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat'
m.connect(URI).then(async()=>{
  var T=m.model('T',new m.Schema({title:String,articleContent:String,description:String,tags:[String],players:[String],event:String,matchDate:Date},{collection:'tactics',strict:false}))

  var updates = {
    '旋转的本质：上旋、下旋、侧旋的产生与判断': {
      description: '从物理原理出发讲透旋转的产生机制、飞行轨迹特征和实战判断技巧。',
      articleContent: `## 旋转：乒乓球的第一语言

在所有球类运动中，乒乓球是最依赖旋转的运动。理解旋转不只是技术问题，更是阅读比赛的基础能力。

### 上旋：最常用的攻击旋转

上旋球的飞行轨迹呈现"弧线前坠"的特征。出手时球速较快，飞行中段弧线偏高，过网后快速下坠。这种飞行特征是由马格努斯效应产生的——球体旋转带动周围空气流动，产生压力差。

判断上旋的关键是观察对手的挥拍方向。当拍面从下往上摩擦球时，产生的是上旋。拉弧圈球就是最典型的制造上旋的技术。

### 下旋：防守与控制的武器

下旋球的飞行轨迹平直且带有"飘"的感觉，落地后弹跳变低。在实战中，下旋球最直接的效果是让对手难以主动发力——攻击下旋球需要"吃住"来球后向上提拉。

发下旋球之所以有效，不是因为旋转本身，而是因为它限制了对手的进攻选择。面对重下旋，大多数选手只能选择搓球或摆短，无法直接攻击。

### 侧旋：制造线路混乱

侧旋球的飞行轨迹会向一侧偏移，偏移方向与旋转方向一致。在发球时加入侧旋是最常用的变化手段，因为侧旋球的飞行弧线会让对手对击球点的判断产生偏差。`
    },
    '如何通过录像分析制定针对性战术': {
      description: '以专业教练视角讲解如何系统化地通过比赛录像分析对手技术特点并制定战术。',
      articleContent: `## 录像分析不是"看视频"

很多选手以为录像分析就是反复观看对手的比赛视频。但有效的录像分析是有方法论支撑的系统工程。

### 第一步：确定分析维度

不要试图一次看完所有内容。建议按三个维度分批分析：发球习惯（前10分钟）、接发球模式（10分钟）、相持阶段线路选择（10分钟）。每次只关注一个维度，记录数据而非感受。

### 第二步：数据化记录

建议用表格记录关键数据：每个发球落点的比例、第三板线路选择、正反手得分率、关键分发球选择。数据比感觉可靠。统计显示，靠感觉做的赛前预判准确率只有40%，而靠数据做的预判准确率可以达到65%以上。

### 第三步：制定针对性战术

基于数据制定战术时，要遵循"打击弱点但不依赖弱点"的原则。如果对手反手位失误率较高，可以在开局多用反手位球试探，但不能把整场比赛的策略都建在"对手会反手失误"这个假设上。

### 实战案例：针对正手依赖型选手的策略

面对正手依赖型选手，有效的策略不是"给反手"，而是"先给中路再变反手"。直接给反手，对手预判清晰。先给中路，对手需要判断使用正手还是反手，这一瞬间的犹豫就是你得分的机会。`
    }
  }

  for (var title in updates) {
    var exists = await T.findOne({title:title})
    if (exists) {
      await T.updateOne({_id:exists._id}, {$set:Object.assign({}, updates[title])})
      console.log('Updated:', title.substring(0,40))
    }
  }
  console.log('Done')
  process.exit(0)
})
