require('dotenv').config()
var axios=require('axios')
var cheerio=require('cheerio')
var UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'

async function test() {
  var url='https://www.ctta.cn/syzl/zt/2026/0123/686035.html'
  var resp=await axios.get(url,{timeout:15000,headers:{'User-Agent':UA}})
  var $=cheerio.load(resp.data)
  var rows=$('table tr').toArray()
  console.log('Total rows:',rows.length)
  rows.forEach((r,i)=>{
    var tds=$(r).find('td')
    if(tds.length>=3){
      var name=$(tds[1]).text().trim().replace(/\s+/g,' ')
      var date=$(tds[2]).text().trim()
      var loc=$(tds[3]).text().trim()
      if(name&&name.length>6&&!/序号|赛事名称/.test(name)) console.log(i,date,loc,name.substring(0,50))
    }
  })
  process.exit(0)
}
test().catch(e=>{console.error(e);process.exit(1)})
