// fetch-wechat-articles.js — Puppeteer 全程版
// 用法: node scripts/fetch-wechat-articles.js --max=5

require('dotenv').config({ path: '/home/zhipengl/workspace/tt.ai/.env' })

// 宿主机连 MongoDB (直接使用 Docker compose 中的实际连接参数)
var MONGO_URI = 'mongodb://wechatuser:wechatpass123@localhost:27017/wechat?authSource=wechat&directConnection=true'
var puppeteer = require('puppeteer-core')
var axios = require('axios')
var mongoose = require('mongoose')

var CHROME_PATH = '/home/zhipengl/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome'
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'

var SOGOU_QUERIES = [
  '乒乓球 技术分析',
  '乒乓球 训练 方法',
  '青少年 乒乓球 训练',
  '乒乓球 发球 教学'
]

var AI_API_URL = process.env.AI_API_URL || 'http://223.112.127.100:4000/v1/chat/completions'
var AI_API_KEY = process.env.AI_API_KEY || ''
var AI_MODEL = process.env.AI_MODEL || ''
var MAX_AI_TOKENS = 1500

var docSchema = new mongoose.Schema({
  title: String, excerpt: String, content: String, category: String,
  source: String, sourceUrl: String, author: String,
  publishedAt: Date, crawledAt: Date, readingTime: Number,
  qualityScore: Number, aiProcessed: Boolean,
  status: { type: String, default: 'candidate' },
  tags: [String]
}, { collection: 'docs', strict: false })

var Doc = mongoose.model('HostDoc', docSchema)

function estimateReadingTime(text) { return Math.max(1, Math.ceil((text || '').replace(/\s+/g, '').length / 320)) }
function categoryFromText(text) {
  if (/规则|规程|办法|等级|选拔|管理/.test(text)) return 'official'
  if (/发球|反手|正手|步法|拧拉|削球|相持|接发球/.test(text)) return 'technique'
  if (/战术|关键分|线路|节奏/.test(text)) return 'tactics'
  if (/训练|计划|青训|体能/.test(text)) return 'training'
  return 'general'
}
function tagsFromText(text) {
  var t = [], map = ['反手', '正手', '发球', '接发球', '步法', '战术', '训练', '青训']
  map.forEach(function(k) { if (text.indexOf(k) !== -1) t.push(k) })
  return t.slice(0, 6)
}
function scoreDoc(doc) {
  var s = 0
  if ((doc.content || '').length > 2000) s += 40; else if ((doc.content || '').length > 500) s += 25; else s += 10
  if ((doc.title || '').length > 8) s += 10
  if ((doc.tags || []).length >= 2) s += 10
  if (/技术|战术|训练/.test(doc.title || '')) s += 10
  return Math.min(100, s)
}
async function aiProcessContent(text, title) {
  if (!AI_API_KEY || (text || '').length < 500) return text
  var prompt = '你是乒乓球专业编辑。请将以下文章整理成一篇流畅的专业文章，像《乒乓世界》杂志的风格。用自然段落写作，段落间用 ### 小标题分隔。保留所有实质性技术分析。禁止使用"核心要点""详细分析""实践建议"等模板化标题。直接进入主题。文章标题: ' + title + '\n内容: ' + text.substring(0, 2500)
  try {
    var resp = await axios.post(AI_API_URL, {
      model: AI_MODEL, messages: [{ role: 'user', content: prompt }],
      max_tokens: MAX_AI_TOKENS, temperature: 0.3, stream: false
    }, { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_API_KEY }, timeout: 60000 })
    var out = resp.data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    return out
  } catch (e) { return text }
}

// 从 Sogou 搜索页提取链接 (在 Puppeteer page 上下文中)
async function extractLinksFromPage(page) {
  return page.evaluate(function() {
    var links = []
    document.querySelectorAll('ul.news-list li').forEach(function(li) {
      var a = li.querySelector('h3 a')
      var excerpt = li.querySelector('.txt-info')
      var source = li.querySelector('.s-p')
      if (a && excerpt) {
        links.push({
          title: a.innerText.trim().replace(/\s+/g, ' '),
          excerpt: excerpt.innerText.trim().replace(/\s+/g, ' '),
          source: source ? source.innerText.trim().replace(/document\.write.*$/, '').trim() : '',
          url: a.getAttribute('href')
        })
      }
    })
    return links
  })
}

// 从 WeChat 文章页提取正文
async function extractContent(page) {
  return page.evaluate(function() {
    var el = document.querySelector('#js_content') || document.querySelector('.rich_media_content')
    return el ? el.innerText.replace(/\s+/g, ' ').trim() : ''
  })
}

async function main() {
  var maxFlag = process.argv.find(function(a) { return a.startsWith('--max=') })
  var maxArticles = maxFlag ? parseInt(maxFlag.split('=')[1]) : 20
  if (isNaN(maxArticles) || maxArticles < 1) maxArticles = 20

  await mongoose.connect(MONGO_URI)
  console.log('[DB] Connected')

  console.log('[1] Launching browser...')
  var browser = await puppeteer.launch({
    headless: true, executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  })

  var count = 0, saved = 0, skipped = 0, aiCount = 0

  for (var q = 0; q < SOGOU_QUERIES.length && count < maxArticles; q++) {
    var query = SOGOU_QUERIES[q]
    var searchUrl = 'https://weixin.sogou.com/weixin?type=2&query=' + encodeURIComponent(query) + '&ie=utf8'
    console.log('\n[Search] ' + query)

    var page = await browser.newPage()
    try {
      await page.setUserAgent(UA)
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 })

      var links = await extractLinksFromPage(page)
      console.log('[Search] Found', links.length, 'links')

      for (var i = 0; i < links.length && count < maxArticles; i++) {
        var link = links[i]
        var fullUrl = link.url.startsWith('http') ? link.url : 'https://weixin.sogou.com' + link.url

        console.log('  [' + (count + 1) + '] ' + link.title.substring(0, 50))

        try {
          // 在同一个 page 上下文中跳转 (保留 Sogou cookie/referrer)
          await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 25000 })
          var finalUrl = page.url()

          if (finalUrl.indexOf('mp.weixin.qq.com') === -1) {
            console.log('    Not WeChat, skip')
            continue
          }

          var content = await extractContent(page)
          if (content.length < 200) {
            console.log('    Too short (' + content.length + ' chars), skip')
            continue
          }
          console.log('    Got', content.length, 'chars')

          // AI 加工
          var aiProcessed = false
          if (AI_API_KEY && content.length > 500 && aiCount < 10) {
            content = await aiProcessContent(content, link.title)
            aiProcessed = true
            aiCount++
            console.log('    AI done')
          }

          var doc = {
            title: link.title,
            excerpt: link.excerpt.substring(0, 150),
            content: content,
            category: categoryFromText(link.title + ' ' + content),
            source: link.source ? ('搜狗微信 · ' + link.source) : '搜狗微信',
            sourceUrl: finalUrl,
            author: link.source || '搜狗微信',
            publishedAt: new Date(),
            crawledAt: new Date(),
            readingTime: estimateReadingTime(content),
            tags: tagsFromText(link.title + ' ' + content),
            aiProcessed: aiProcessed
          }
          doc.qualityScore = scoreDoc(doc)
          doc.status = doc.qualityScore >= 40 ? 'published' : 'candidate'

          var exists = await Doc.findOne({ sourceUrl: finalUrl })
          if (!exists) {
            await Doc.create(doc)
            saved++
            console.log('    Saved! score:', doc.qualityScore, doc.status)
          } else {
            skipped++
            console.log('    Already exists')
          }

          count++
        } catch (e) {
          console.log('    Error:', e.message)
        }
      }
    } catch (e) {
      console.log('[Search] Error:', e.message)
    } finally {
      await page.close()
    }
  }

  await browser.close()
  console.log('\n[Done] fetched:', count, 'saved:', saved, 'skipped:', skipped, 'ai:', aiCount)
  process.exit(0)
}

main().catch(function(e) { console.error('Fatal:', e); process.exit(1) })
