require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
var URI='mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat'
m.connect(URI).then(async()=>{
  var D=m.model('D',new m.Schema({title:String,source:String,excerpt:String},{collection:'docs',strict:false}))

  // 1. 删除 CTTA 空壳文章 (excerpt 含 HTML 注释/代码碎片)
  var r1 = await D.deleteMany({excerpt:/<!--|video_url|var\s+vID|当前位置/})
  console.log('Deleted CTTA shells:', r1.deletedCount)

  // 2. 删除行政通知类 (裁判员/管理办法/赛风赛纪/国球进社区/通知/公示)
  var r2 = await D.deleteMany({title:/裁判员|管理办法|赛风赛纪|国球进社区|注册信息|实施细则|等级测试.*指南|报考资格|集训.*通知/})
  console.log('Deleted admin notices:', r2.deletedCount)

  // 3. 删除 2019-2021 旧日程
  var r3 = await D.deleteMany({title:/2019|2020|2021.*比赛日程/})
  console.log('Deleted old schedules:', r3.deletedCount)

  // 统计剩余
  var remaining = await D.find({status:'published'}).lean()
  console.log('\nRemaining published:', remaining.length)
  remaining.forEach(function(d){ console.log(' ', d.title.substring(0,50), '|', d.source.substring(0,30)) })

  process.exit(0)
})
