require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
var URI='mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat'
m.connect(URI).then(async()=>{
  var T=m.model('T',new m.Schema({title:String,articleContent:String},{collection:'tactics',strict:false}))
  var d=await T.findOne({title:/马龙发球/}).lean()
  console.log('Title:', d.title)
  console.log('Content length:', (d.articleContent||'').length)
  console.log('Full content:')
  console.log(d.articleContent)
  process.exit(0)
})
