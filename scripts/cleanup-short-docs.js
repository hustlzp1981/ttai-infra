require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
m.connect('mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat').then(async()=>{
  var D=m.model('D',new m.Schema({title:String,content:String,sourceUrl:String},{collection:'docs',strict:false}))
  // 删除摘要型（内容 < 200 字且 sourceUrl 不含 mp.weixin）
  var r = await D.deleteMany({content:{$exists:true,$not:{$gte:''}}})
  r = await D.deleteMany({$expr:{$lt:[{$strLenCP:'$content'},200]},sourceUrl:{$not:/mp\.weixin\.qq\.com/}})
  console.log('Deleted short/snippet docs:', r.deletedCount)
  var total = await D.countDocuments({status:'published'})
  console.log('Remaining published:', total)
  process.exit(0)
})
