require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
var URI='mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat'
m.connect(URI).then(async()=>{
  var T=m.model('T',new m.Schema({title:String,contentType:String,articleContent:String},{collection:'tactics',strict:false}))
  var c=await T.countDocuments({})
  console.log('Total tactics:', c)
  var items=await T.find({}).limit(5).lean()
  items.forEach(i=>console.log(i.title.substring(0,50),'|',i.contentType,'| hasContent:',!!i.articleContent))
  process.exit(0)
})
