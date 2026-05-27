require('dotenv').config({path:'/home/zhipengl/workspace/tt.ai/.env'})
var axios=require('axios')
var cheerio=require('cheerio')
var m=require('mongoose')
var UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'
var URI='mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat'

function extractCity(text) {
  var CITIES=['北京','上海','广州','深圳','成都','杭州','武汉','南京','重庆','天津',
    '西安','长沙','郑州','济南','青岛','沈阳','苏州','无锡','合肥','哈尔滨','长春',
    '石家庄','太原','南宁','贵阳','昆明','兰州','厦门','福州','宁波','大连','南昌',
    '海口','三亚','珠海','佛山','东莞','温州','绍兴','嘉兴','金华','烟台','威海',
    '潍坊','济宁','临沂','淄博','秦皇岛','正定','丽江','日照','黄石','宿州','黄山',
    '襄阳','宜昌','荆州','鄂州','孝感','十堰','荆门','常州','扬州','镇江','盐城',
    '泰州','鄂尔多斯','齐齐哈尔','南通','万宁','江山','武清','宝山','大连','沈阳']
  for(var i=0;i<CITIES.length;i++) if(text.indexOf(CITIES[i])!==-1) return CITIES[i]
  return text.replace(/市|省|自治区|县|区/g,'').trim().substring(0,6)
}

function computeStatus(d){var t=new Date();t.setHours(0,0,0,0);d.setHours(0,0,0,0);return d<t?'past':d>t?'upcoming':'ongoing'}

async function main() {
  await m.connect(URI)
  var E=m.model('E',new m.Schema({},{collection:'events',strict:false}))
  
  var url='https://www.ctta.cn/syzl/zt/2026/0123/686035.html'
  var resp=await axios.get(url,{timeout:15000,headers:{'User-Agent':UA}})
  var $=cheerio.load(resp.data)
  var rows=$('table tr').toArray()
  var updated=0,created=0
  
  for(var i=0;i<rows.length;i++){
    var tds=$(rows[i]).find('td')
    if(tds.length<3) continue
    var name=$(tds[1]).text().trim().replace(/\s+/g,' ')
    var dateStr=$(tds[2]).text().trim()
    var loc=$(tds[3]).text().trim()
    if(!name||name.length<6||/序号|赛事名称/.test(name)) continue

    var y=new Date().getFullYear()
    var dm=dateStr.match(/(\d{2})\.(\d{2})\s*[-–~]\s*(\d{2})\.(\d{2})/)
    var sd=null,ed=null
    if(dm){sd=new Date(y,parseInt(dm[1])-1,parseInt(dm[2]));ed=new Date(y,parseInt(dm[3])-1,parseInt(dm[4]))}
    if(!sd) continue
    var city=extractCity(loc)

    var exists=await E.findOne({name:name})
    if(exists){
      await E.updateOne({_id:exists._id},{$set:{endDate:ed,location:loc,city:city,date:sd,status:computeStatus(sd),competitionLevel:'professional',type:'youth',source:'ctta',org:'中国乒协',url:url,sourceUrl:url}})
      updated++
    } else {
      await E.create({name:name,date:sd,endDate:ed,city:city,location:loc,category:'青少年',competitionLevel:'professional',org:'中国乒协',url:url,source:'ctta',sourceUrl:url,type:'youth',status:computeStatus(sd),level:'intermediate',cost:0,crawledAt:new Date()})
      created++
    }
  }
  console.log('Updated:',updated,'Created:',created)
  process.exit(0)
}
main().catch(e=>{console.error(e);process.exit(1)})
