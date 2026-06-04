(function () {
  var clubs = [
    {
      id: "club-sh-xuhui-ace",
      slug: "xuhui-ace",
      name: "徐汇精英乒乓俱乐部",
      city: "上海",
      district: "徐汇区",
      isPartner: true,
      level: "TTAI 合作俱乐部",
      address: "上海市徐汇区漕溪北路 88 号 3F",
      hours: "周一至周日 10:00-21:30",
      equipment: "8 张专业球台，发球机，AI 训练采集位",
      phone: "021-61234567",
      mobile: "13800000001",
      wechat: "TTAI-xuhui",
      lat: 31.1919,
      lng: 121.4387,
      photos: ["images/main.png", "images/ttai_144.jpg"],
      tags: ["青少年训练", "成人提高", "一对一", "AI 训练"],
      summary: "适合希望系统提升基本功和比赛稳定性的学员，教练会结合 AI 分析结果安排训练重点。",
      courses: [
        { name: "青少年基础班", schedule: "周末 10:00-12:00", target: "7-14 岁零基础或初级学员" },
        { name: "成人提高班", schedule: "工作日晚上", target: "动作纠正、实战节奏、发接发" },
        { name: "私教专项课", schedule: "预约制", target: "反手、步伐、发球等单项突破" }
      ],
      coaches: [
        { name: "王教练", title: "主教练", focus: "青少年启蒙、正反手动作框架" },
        { name: "李教练", title: "实战教练", focus: "成人比赛复盘、发接发和连续进攻" }
      ],
      cases: [
        { title: "反手稳定性提升", before: "连续失误多，重心后坐", after: "两周内反手评分提升 12 分" },
        { title: "比赛回合复盘", before: "不知道丢分原因", after: "通过回合剪辑定位发球后衔接问题" }
      ]
    },
    {
      id: "club-sh-pudong-spin",
      slug: "pudong-spin",
      name: "浦东旋风乒乓训练中心",
      city: "上海",
      district: "浦东新区",
      isPartner: true,
      level: "TTAI 合作俱乐部",
      address: "上海市浦东新区张杨路 500 号 B1",
      hours: "周二至周日 09:30-22:00",
      equipment: "12 张球台，多球训练区，比赛录像区",
      phone: "021-62345678",
      mobile: "13800000002",
      wechat: "TTAI-pudong",
      lat: 31.2295,
      lng: 121.5221,
      photos: ["images/main.png"],
      tags: ["陪练", "周末课", "成人提高", "比赛复盘"],
      summary: "偏实战训练和比赛复盘，适合有一定基础、希望提高胜率的球友。",
      courses: [
        { name: "实战提高课", schedule: "周三/周五 19:00", target: "比赛节奏、前三板、相持稳定性" },
        { name: "陪练课", schedule: "预约制", target: "固定陪练、模拟不同打法" }
      ],
      coaches: [
        { name: "陈教练", title: "实战教练", focus: "前三板、相持转换、比赛策略" }
      ],
      cases: [
        { title: "前三板得分率提升", before: "发球后被动", after: "通过录像复盘调整发球落点和第二板选择" }
      ]
    },
    {
      id: "club-sh-minhang-youth",
      slug: "minhang-youth",
      name: "闵行少年乒乓学院",
      city: "上海",
      district: "闵行区",
      isPartner: false,
      level: "入驻俱乐部",
      address: "上海市闵行区七莘路 1200 号",
      hours: "周六周日 09:00-18:00",
      equipment: "6 张球台，青少年训练分组",
      phone: "021-63456789",
      mobile: "13800000003",
      wechat: "TTAI-minhang",
      lat: 31.1308,
      lng: 121.3638,
      photos: ["images/ttai_144.jpg"],
      tags: ["青少年训练", "启蒙课", "周末课"],
      summary: "面向低龄和青少年基础训练，强调动作规范和持续训练习惯。",
      courses: [
        { name: "少儿启蒙课", schedule: "周六上午", target: "6-10 岁启蒙学员" },
        { name: "进阶小班课", schedule: "周日下午", target: "已有基础，准备校队或比赛" }
      ],
      coaches: [
        { name: "赵教练", title: "少儿教练", focus: "启蒙训练、动作规范、兴趣培养" }
      ],
      cases: [
        { title: "动作规范建立", before: "击球动作散，发力不连贯", after: "通过训练日志跟踪动作完成度" }
      ]
    }
  ];

  var admin = {
    currentAdmin: {
      name: "俱乐部管理员",
      role: "owner",
      clubId: "club-sh-xuhui-ace",
      clubName: "徐汇精英乒乓俱乐部"
    },
    overview: {
      members: 86,
      activeThisWeek: 29,
      analysesThisMonth: 148,
      newLeads: 12,
      updatedAt: "2026-06-04 15:30"
    },
    funnel: [
      { status: "new", label: "新线索", count: 12 },
      { status: "contacted", label: "已联系", count: 8 },
      { status: "visited", label: "已到店", count: 5 },
      { status: "enrolled", label: "已报名", count: 3 },
      { status: "lost", label: "流失", count: 2 }
    ],
    members: [
      { id: "m001", name: "张同学", ageGroup: "青少年", lastActive: "今天", analyses: 18, weakness: "反手稳定性", authorized: true, score: 82 },
      { id: "m002", name: "陈先生", ageGroup: "成人", lastActive: "昨天", analyses: 11, weakness: "步伐衔接", authorized: true, score: 76 },
      { id: "m003", name: "林同学", ageGroup: "青少年", lastActive: "3 天前", analyses: 7, weakness: "发球后第二板", authorized: false, score: 69 },
      { id: "m004", name: "王女士", ageGroup: "成人", lastActive: "本周", analyses: 22, weakness: "接发球判断", authorized: true, score: 85 }
    ],
    leads: [
      { id: "l001", name: "刘女士", phone: "138****2301", target: "孩子启蒙", source: "俱乐部详情页", status: "new", createdAt: "今天 11:20" },
      { id: "l002", name: "周先生", phone: "139****8821", target: "成人提高", source: "电话咨询", status: "contacted", createdAt: "昨天 19:10" },
      { id: "l003", name: "孙同学", phone: "137****4510", target: "校队备赛", source: "AI 训练入口", status: "visited", createdAt: "本周一" }
    ],
    activities: [
      { user: "张同学", action: "完成训练视频分析", detail: "综合评分 82，弱项：反手稳定性", time: "15 分钟前" },
      { user: "陈先生", action: "上传比赛剪辑", detail: "生成 9 个有效回合", time: "1 小时前" },
      { user: "王女士", action: "提交训练日志", detail: "发球专项 45 分钟", time: "昨天" }
    ],
    weaknesses: [
      { label: "反手", value: 38 },
      { label: "步伐", value: 24 },
      { label: "发球", value: 18 },
      { label: "接发球", value: 14 },
      { label: "正手", value: 6 }
    ]
  };

  window.TTAI_CLUB_DATA = {
    clubs: clubs,
    admin: admin,
    getClubById: function (idOrSlug) {
      return clubs.find(function (club) {
        return club.id === idOrSlug || club.slug === idOrSlug;
      }) || clubs[0];
    },
    getDistricts: function (city) {
      var map = {};
      clubs.forEach(function (club) {
        if (!city || club.city === city) map[club.district] = true;
      });
      return Object.keys(map);
    }
  };
})();
