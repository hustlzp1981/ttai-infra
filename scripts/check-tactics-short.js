require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
var URI='mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat'
m.connect(URI).then(async()=>{
  var T=m.model('T',new m.Schema({title:String,articleContent:String},{collection:'tactics',strict:false}))
  var items=await T.find({}).lean()
  items.forEach(i=>{
    var len=(i.articleContent||'').length
    if(len<200) console.log('SHORT:',i.title,'|',len,'chars')
  })
  process.exit(0)
})
