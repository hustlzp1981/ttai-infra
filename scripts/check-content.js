require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
m.connect('mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat').then(async()=>{
  var D=m.model('D',new m.Schema({title:String,content:String,aiProcessed:Boolean,status:String},{collection:'docs',strict:false}))
  var items=await D.find({title:/精华解析/}).sort({crawledAt:-1}).lean()
  console.log('Found', items.length, 'matching entries:')
  items.forEach(d=>console.log('  title:',d.title.substring(0,50),'| len:',(d.content||'').length,'| status:',d.status,'| AI:',d.aiProcessed))
  
  // Also check the Puppeteer entries by looking for AI processed ones
  var aiItems=await D.find({aiProcessed:true,status:'published'}).sort({crawledAt:-1}).limit(5).lean()
  console.log('\nAI processed published:')
  aiItems.forEach(d=>console.log('  title:',d.title.substring(0,40),'| len:',(d.content||'').length))
  process.exit(0)
})
