require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var m=require('mongoose')
m.connect('mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat').then(async()=>{
  var D=m.model('D',new m.Schema({title:String,content:String,sourceUrl:String},{collection:'docs',strict:false}))
  
  // 1. 删除含 VerifyCode 的垃圾条目
  var r1 = await D.deleteMany({content:/VerifyCode|验证码/})
  console.log('Deleted verify pages:', r1.deletedCount)

  // 2. 对同一个标题，只保留 content 最长的那条
  var dups = await D.aggregate([
    {$match:{status:'published'}},
    {$group:{_id:'$title',count:{$sum:1},ids:{$push:'$_id'},maxLen:{$max:{$strLenCP:'$content'}}}},
    {$match:{count:{$gt:1}}}
  ])
  var delIds = []
  for (var i=0; i<dups.length; i++) {
    var dup = dups[i]
    // 找到所有同标题条目，只保留 content 最长的那条
    var entries = await D.find({title:dup._id, status:'published'}).sort({content:-1}).lean()
    // 保留第一条（最长），删除其余
    for (var j=1; j<entries.length; j++) {
      delIds.push(entries[j]._id)
    }
  }
  if (delIds.length > 0) {
    var r2 = await D.deleteMany({_id:{$in:delIds}})
    console.log('Deleted duplicates:', r2.deletedCount)
  }
  
  // 3. 删 sourceUrl 含 weixin.sogou.com（非真实微信链接）的条目
  var r3 = await D.deleteMany({sourceUrl:/weixin\.sogou\.com/})
  console.log('Deleted sogou redirect entries:', r3.deletedCount)

  var total = await D.countDocuments({status:'published'})
  console.log('Remaining published:', total)

  // 检查现在乒乓球技术精华解析有几条
  var items = await D.find({title:/精华解析/}).lean()
  console.log('\nAfter cleanup:')
  items.forEach(d=>console.log('  len:',(d.content||'').length,'| sourceUrl:',(d.sourceUrl||'').substring(0,60)))
  process.exit(0)
})
