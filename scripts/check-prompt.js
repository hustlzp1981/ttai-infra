require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
var URI='mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat'
m.connect(URI).then(async()=>{
  var D=m.model('D',new m.Schema({title:String,content:String},{collection:'docs',strict:false}))
  var d=await D.findOne({title:/精华解析/}).sort({crawledAt:-1}).lean()
  var c=d.content||''
  console.log('Has 核心要点:',c.indexOf('核心要点')!==-1)
  console.log('Has 实践建议:',c.indexOf('实践建议')!==-1)
  console.log('First 500:',c.substring(0,500))
  process.exit(0)
})
