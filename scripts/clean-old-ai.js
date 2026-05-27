require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
var URI='mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat'
m.connect(URI).then(async()=>{
  var D=m.model('D',new m.Schema({content:String},{collection:'docs',strict:false}))
  // Delete articles with old AI template headers
  var r1 = await D.deleteMany({content:/核心要点/})
  var r2 = await D.deleteMany({content:/实践建议/})
  console.log('Deleted old AI template articles:', r1.deletedCount + r2.deletedCount)
  var total = await D.countDocuments({status:'published'})
  console.log('Remaining:', total)
  process.exit(0)
})
