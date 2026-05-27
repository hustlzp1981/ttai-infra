require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
m.connect('mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat&directConnection=true').then(async()=>{
  var D=m.model('D',new m.Schema({title:String,category:String,status:String},{collection:'docs',strict:false}))
  var items=await D.find({status:'published'}).sort({crawledAt:-1}).limit(15).lean()
  items.forEach(d=>console.log(d.title.substring(0,50),'| cat:',d.category))
  process.exit(0)
})
