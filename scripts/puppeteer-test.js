// Quick test: Puppeteer bypass Sogou antispider
require('dotenv').config({ path: '/home/zhipengl/workspace/tt.ai/wechat-backend/.env' })
var puppeteer = require('puppeteer-core')
var CHROME = '/home/zhipengl/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome'

async function test() {
  var browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  // 测试: 访问搜狗微信搜索结果页
  var page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 Chrome/120')
  
  console.log('1. Going to Sogou search...')
  await page.goto('https://weixin.sogou.com/weixin?type=2&query=' + encodeURIComponent('乒乓球技术分析') + '&ie=utf8', { waitUntil: 'networkidle2', timeout: 20000 })
  console.log('   Search page loaded')

  // 提取第一个结果链接
  var firstLink = await page.evaluate(function() {
    var el = document.querySelector('ul.news-list li h3 a')
    return el ? el.getAttribute('href') : ''
  })
  console.log('   First link:', firstLink ? firstLink.substring(0, 80) : 'NOT FOUND')

  if (firstLink) {
    // 补全 URL
    var fullUrl = firstLink.startsWith('http') ? firstLink : 'https://weixin.sogou.com' + firstLink
    console.log('\n2. Following Sogou redirect via Puppeteer...')
    await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 25000 })
    var finalUrl = page.url()
    console.log('   Final URL:', finalUrl.substring(0, 100))
    console.log('   Is WeChat:', finalUrl.indexOf('mp.weixin.qq.com') !== -1 ? 'YES' : 'NO')

    // 提取正文
    var content = await page.evaluate(function() {
      var el = document.querySelector('#js_content') || document.querySelector('.rich_media_content')
      return el ? el.innerText.replace(/\s+/g, ' ').trim() : ''
    })
    console.log('   Content length:', content.length)
    console.log('   Content preview:', content.substring(0, 200))
  }

  await browser.close()
  console.log('\nDone!')
  process.exit(0)
}

test().catch(function(e) { console.error(e); process.exit(1) })
