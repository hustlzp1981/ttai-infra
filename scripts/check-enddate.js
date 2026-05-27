require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
var URI='mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat'
m.connect(URI).then(async()=>{
  var E=m.model('E',new m.Schema({name:String,date:Date,endDate:Date,location:String,city:String},{collection:'events',strict:false}))
  var items=await E.find({endDate:{$ne:null},type:'youth'}).sort({date:1}).lean()
  console.log('Events with endDate:', items.length)
  items.forEach(i=>console.log('  '+i.name.substring(0,50)+' | '+i.location+' | '+i.city))
  process.exit(0)
})
