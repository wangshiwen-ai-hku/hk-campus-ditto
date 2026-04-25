import json
import os

en = {
  "brand": "Campus Ditto HK",
  "nav": {
    "how": "How it works",
    "safety": "Safety",
    "faq": "FAQ",
    "join": "Join now",
    "signOut": "Sign out"
  },
  "home": {
    "hero": {
      "getADate": "get a date every",
      "wednesday": "wednesday",
      "atYourSchool": "@YOUR SCHOOL",
      "nextDrop": "Next HK Campus Drop: Wednesday at 7PM",
      "joinDrop": "Join Next Drop →"
    },
    "stats": "{students} Students Joined • 100% University Verified • {dates} Dates Met •",
    "why": {
      "badge": "Stopping the swipe culture in HK",
      "title": "One intentional <br/> <1>Wednesday</1> date",
      "desc": "Tired of endless swiping and \"Hi\" that go nowhere? We drop one intentional match for you every Wednesday. No games, just one high-signal connection from your campus.",
      "noSwiping": "No Swiping",
      "noSwipingDesc": "Our algorithm does the heavy lifting for you.",
      "campusSafe": "Campus Safe",
      "campusSafeDesc": "Only students with verified .edu.hk emails.",
      "personalized": "Personalized",
      "personalizedDesc": "Matched based on values, vibe, and availability."
    },
    "curated": {
      "title": "Curated campus <br/> dates that actually <br/> happen.",
      "desc": "We don't just match you; we suggest a safe, high-vibe spot on your campus and a simple idea to break the ice.",
      "cta": "Start your journey →"
    },
    "stepsTitle": "How to get a date",
    "steps": {
      "step1": {
        "title": "Tell us your type",
        "desc": "Complete your profile before Tuesday night.",
        "example": "e.g. 'I love night views at TST'",
        "detailQuote": "\"Your profile is your digital vibe. We don't just ask for your degree, we ask for your soul.\" ✨",
        "interests": "Interests",
        "interestsDesc": "From Cantopop to Tech Ethics",
        "vibeTags": "Vibe Tags",
        "vibeTagsDesc": "Cloud-chaser, Night-owl, or Library-dweller",
        "encryptionNote": "Your data is encrypted and only shared with your match."
      },
      "step2": {
        "title": "Wednesday drop",
        "desc": "Receive one high-intent match at 7PM.",
        "example": "e.g. Matching with a fellow HKUer",
        "detailQuote": "\"Every Wednesday at 7PM, the magic happens. No more choice paralysis. Just one person.\" ✉️",
        "algoFocus": "Algorithm Focus",
        "algoFocusDesc": "\"High Signal, Low Noise\"",
        "userQuote": "\"I checked my phone at 7:01 and there was this person from my own college. It felt intentional.\" — CUHK Junior"
      },
      "step3": {
        "title": "Share availability",
        "desc": "Confirm a simple meeting time.",
        "example": "e.g. 'Let's meet at Book Cafe!'",
        "detailQuote": "\"We find the overlap in your schedules so you don't have to play text-tag.\" ☕",
        "check1": "Choose from pre-set safe campus spots.",
        "check2": "Suggested under-1-hour date format.",
        "check3": "High commitment, low pressure meets."
      },
      "step4": {
        "title": "Go on a date",
        "desc": "Refine future matches based on feedback.",
        "example": "e.g. 'Had a great vibe, retry!'",
        "detailQuote": "\"Meet in the real world. That's where the chemistry happens.\" 🌟",
        "match": "Match!",
        "friends": "Friends",
        "retry": "Retry",
        "userQuote": "\"Feedback improves the HK campus pool for everyone. Your input shapes the next drop.\""
      }
    },
    "faqTitle": "Common Questions",
    "faqSubtitle": "Everything you need to know about the Wednesday Drop.",
    "faqs": [
      {
        "q": "How does the matching work?",
        "a": "Our algorithm doesn't just look at 'likes'. It analyzes your interests, values, and even your weekly availability. We aim for high-signal connections that have a high probability of a great first campus meet."
      },
      {
        "q": "Is it restricted to .edu.hk emails?",
        "a": "Yes. To ensure safety and a community of peers, we only allow students from supported Hong Kong universities with valid institutional emails."
      },
      {
        "q": "Why only one match per week?",
        "a": "Endless browsing leads to decision fatigue and shallow connections. By giving you one intentional match every Wednesday, we help you focus on really getting to know one person at a time."
      },
      {
        "q": "What if I get a bad match?",
        "a": "You're always in control. After every drop, you can provide feedback. If you identify as a 'pass' or 'rematch', our algorithm learns your preferences for the next cycle. Safety and comfort are our top priorities."
      },
      {
        "q": "Where should we meet?",
        "a": "We always suggest safe, public spots on your own campus. Keep it low-pressure, keep it public, and keep it under an hour for the first meet."
      }
    ],
    "footerTitle": "Ready to meet your <br/> next campus connection?",
    "footerCta": "Get Started Now →",
    "footerDesc": "Join 147k+ Students across HK"
  },
  "join": {
    "title": "Join your next Wednesday drop",
    "pageTitle": "Student onboarding",
    "subtitle": "Use a supported university email, verify with the demo code, then complete a preference profile for the next Wednesday drop.",
    "emailLabel": "University Email",
    "emailPlaceholder": "name@connect.hku.hk",
    "nameLabel": "Full Name",
    "namePlaceholder": "Full name",
    "sendCode": "Send code",
    "verifyCodeLabel": "Verification Code",
    "verifyBtn": "Verify",
    "majorLabel": "Major",
    "majorPlaceholder": "Major",
    "bioLabel": "Bio",
    "bioPlaceholder": "Tell us about yourself...",
    "languages": "Languages",
    "interests": "Interests",
    "availability": "Availability",
    "saveBtn": "Save profile",
    "dashboardBtn": "Open dashboard",
    "demoCodeMsg": "Demo verification code: {code}",
    "verifiedMsg": "Verified. Continue your profile.",
    "verifyFirstMsg": "Please verify your email first to save your profile.",
    "savedMsg": "Profile saved! Redirecting to your dashboard..."
  },
  "student": {
    "title": "Student dashboard",
    "signInPrompt": "Please sign in to view your dashboard.",
    "loading": "Loading profile…",
    "hi": "Hi, {name}!",
    "major": "Major",
    "pending": "Pending",
    "languages": "Languages",
    "currentDrop": "Current Drop",
    "compatibility": "Compatibility score: ",
    "aboutThem": "About them",
    "curatedDate": "Curated Date",
    "scheduling": "Scheduling",
    "waitOverlap": "Wait for overlap",
    "overlap": "Overlap: {slots}",
    "noneYet": "None yet",
    "notesSys": "Notes for System",
    "notesPlaceholder": "What should the system learn?",
    "lovedIt": "Loved it",
    "pass": "Pass",
    "requestRematch": "Request rematch",
    "findingMatch": "Finding you a new match...",
    "feedbackSaved": "Feedback saved.",
    "nextDropView": {
      "title": "You're in the next drop!",
      "desc": "At Ditto, we believe in quality over quantity. Instead of swiping, you get **one intentional match** every Wednesday at 7:00 PM.",
      "countdownTitle": "Next Match Drop In",
      "checkBack": "Check back on Wednesday!",
      "verified": "Verified Students Only",
      "verifiedDesc": "We ensure everyone is a real person from your campus.",
      "highSignal": "High Signal Matching",
      "highSignalDesc": "Our algorithm focuses on shared interests and values."
    }
  },
  "admin": {
    "title": "Admin console",
    "pageTitle": "Operator dashboard",
    "resetDemo": "Reset demo data",
    "runDrop": "Run Wednesday drop",
    "msgCreated": "Created {count} new match(es).",
    "msgReset": "Demo data reset.",
    "stats": {
      "students": "Students",
      "profiles": "Profiles",
      "dates": "Dates",
      "rematch": "Rematch"
    },
    "recentMatches": "Recent matches",
    "score": "score",
    "open": "Open",
    "studentDir": "Student Directory",
    "incomplete": "Incomplete",
    "view": "View",
    "loading": "Loading records…"
  }
}

zh_hk = {
  "brand": "Campus Ditto HK",
  "nav": {
    "how": "點樣運作",
    "safety": "安全",
    "faq": "常見問題",
    "join": "立即加入",
    "signOut": "登出"
  },
  "home": {
    "hero": {
      "getADate": "逢星期三送你",
      "wednesday": "一個約會",
      "atYourSchool": "@你嘅大學",
      "nextDrop": "下一次配對：星期三晚7點",
      "joinDrop": "加入下一次配對 →"
    },
    "stats": "{students} 個學生已加入 • 100% 大學電郵驗證 • {dates} 次成功見面 •",
    "why": {
      "badge": "打破香港的左滑右滑文化",
      "title": "星期三<br/> <1>認真約會</1>",
      "desc": "厭倦咗無止境嘅 Swipe 同埋無下文嘅「Hi」？我哋每個星期三為你送上一個認真嘅配對。無需要估估吓，只做同校高質素配對。",
      "noSwiping": "唔需要 Swipe",
      "noSwipingDesc": "我哋嘅演算法幫你搞掂。",
      "campusSafe": "校園安全",
      "campusSafeDesc": "只限已驗證 .edu.hk 電郵嘅學生。",
      "personalized": "個人化",
      "personalizedDesc": "根據價值觀、Vibe、同得閒時間去配對。"
    },
    "curated": {
      "title": "真係可以<br/>成事嘅<br/>校園約會。",
      "desc": "我哋唔只俾配對你；仲會建議一個你校內安全、氣氛好嘅地方，兼一個簡單嘅破冰話題。",
      "cta": "即刻開始 →"
    },
    "stepsTitle": "點樣有約會",
    "steps": {
      "step1": {
        "title": "話俾我哋知你鍾意咩",
        "desc": "喺星期二晚之前填好你張 Profile。",
        "example": "例如：『我鍾意去尖沙咀睇夜景』",
        "detailQuote": "\"你嘅 Profile 就係你嘅 Digital Vibe。我哋唔單止問你讀咩科，仲想了解你個人。\" ✨",
        "interests": "興趣",
        "interestsDesc": "由廣東歌到科技倫理",
        "vibeTags": "Vibe 標籤",
        "vibeTagsDesc": "追雲者、夜貓子、或圖書館達人",
        "encryptionNote": "你嘅資料已加密，只會分享俾同你配對嘅人。"
      },
      "step2": {
        "title": "星期三配對出爐",
        "desc": "晏晝7點收到一個認真配對。",
        "example": "例如：同一個港大同學 Match",
        "detailQuote": "\"每個星期三夜晚7點，奇蹟發生。唔使再患得患失，就只係一個人。\" ✉️",
        "algoFocus": "算法焦點",
        "algoFocusDesc": "\"高訊號，低噪音\"",
        "userQuote": "\"我 7:01 㩒開電話，見到一個同我同 College 嘅人。感覺好命中注定。\" — 中大 Year 3 學生"
      },
      "step3": {
        "title": "分享有空時間",
        "desc": "確認一個簡單見面時間。",
        "example": "例如：『不如去 Book Cafe 見！』",
        "detailQuote": "\"我哋幫你搵你哋時間表重疊嘅時段，唔使再夾來夾去。\" ☕",
        "check1": "喺預先設定好嘅校園安全地點揀。",
        "check2": "建議一小時內嘅初次約會。",
        "check3": "高誠意、低壓力嘅見面。"
      },
      "step4": {
        "title": "出去約會",
        "desc": "根據反饋改善下次配對。",
        "example": "例如：『氣氛好好，再約！』",
        "detailQuote": "\"喺現實世界見面，先至會有火花。\" 🌟",
        "match": "有 Feel！",
        "friends": "做住朋友先",
        "retry": "再試吓",
        "userQuote": "\"你俾嘅 Feedback 會改善所有人嘅配對質素。下次 Drop 會因為你而變得更好。\""
      }
    },
    "faqTitle": "常見問題",
    "faqSubtitle": "關於星期三配對，你想知嘅一切",
    "faqs": [
      {
        "q": "配對係點運作？",
        "a": "我哋嘅演算法唔單止睇『樣』，仲會分析你嘅興趣、價值觀，甚至你個禮拜幾時得閒，務求幫你搵到個最有可能喺校園見面嘅對象。"
      },
      {
        "q": "淨係可以用 .edu.hk 電郵？",
        "a": "係。為咗確保社群內都係真係學生，所以只限支援嘅香港大學嘅機構電郵。"
      },
      {
        "q": "點解一星期得一次配對？",
        "a": "無止境咁轆只會令人眼花撩亂同埋無誠意。每個星期三俾一個認真嘅 Match 你，幫你專心認識一個人。"
      },
      {
        "q": "如果 Match 得唔好點算？",
        "a": "主導權喺你手。每次配對後你都可以俾 Feedback。如果你揀『Pass』或『Rematch』，演算法會學你口味，下次配對會更好。安全同舒服係我哋首要考慮。"
      },
      {
        "q": "去邊度見面好？",
        "a": "我哋會建議你大學嘅公眾地方，好似港大 Book Cafe 或中大未圓湖。保持低壓力，公開，同埋初次見面一小時內。"
      }
    ],
    "footerTitle": "準備好認識下一個<br/>同校嘅佢未？",
    "footerCta": "即刻開始 →",
    "footerDesc": "超過 147k+ 香港學生已經加入"
  },
  "join": {
    "title": "加入下一次星期三配對",
    "pageTitle": "學生加入",
    "subtitle": "用大學電郵，透過 Demo Code 驗證，然後填好資料等下個星期三配對。",
    "emailLabel": "大學電郵",
    "emailPlaceholder": "name@connect.hku.hk",
    "nameLabel": "全名",
    "namePlaceholder": "全名",
    "sendCode": "傳送驗證碼",
    "verifyCodeLabel": "驗證碼",
    "verifyBtn": "驗證",
    "majorLabel": "主修科目",
    "majorPlaceholder": "主修科目",
    "bioLabel": "簡介",
    "bioPlaceholder": "介紹下你自己...",
    "languages": "語言",
    "interests": "興趣",
    "availability": "得閒時間",
    "saveBtn": "儲存個人檔案",
    "dashboardBtn": "打開控制面板",
    "demoCodeMsg": "示範驗證碼：{code}",
    "verifiedMsg": "已驗證，繼續填寫。",
    "verifyFirstMsg": "請先驗證電郵。",
    "savedMsg": "已儲存！即將跳轉到面板..."
  },
  "student": {
    "title": "學生控制面板",
    "signInPrompt": "請先登入。",
    "loading": "載入中…",
    "hi": "你好, {name}！",
    "major": "主修科目",
    "pending": "未填寫",
    "languages": "語言",
    "currentDrop": "今個星期配對",
    "compatibility": "契合度: ",
    "aboutThem": "關於佢",
    "curatedDate": "建議約會",
    "scheduling": "時間夾檔",
    "waitOverlap": "等緊重疊時間",
    "overlap": "重疊時間：{slots}",
    "noneYet": "暫時未有",
    "notesSys": "俾系統嘅筆記",
    "notesPlaceholder": "有咩想系統學到？",
    "lovedIt": "好鍾意",
    "pass": "Pass",
    "requestRematch": "要求重新配對",
    "findingMatch": "搵緊新配對...",
    "feedbackSaved": "反饋已儲存。",
    "nextDropView": {
      "title": "你已經加入咗下一次配對！",
      "desc": "Ditto 相信重質不重量。唔駛再 Swipe，每個星期三 7:00 PM 你會收到一 個**認真嘅配對**。",
      "countdownTitle": "下一次配對倒數",
      "checkBack": "星期三見！",
      "verified": "只限已驗證學生",
      "verifiedDesc": "確保每個人都係你同學。",
      "highSignal": "高訊號配對",
      "highSignalDesc": "演算法專注喺共同興趣同價值觀。"
    }
  },
  "admin": {
    "title": "管理員控制面板",
    "pageTitle": "管理員控制面板",
    "resetDemo": "重置示範數據",
    "runDrop": "運行星期三配對",
    "msgCreated": "新建立咗 {count} 個配對。",
    "msgReset": "示範數據已重置。",
    "stats": {
      "students": "學生人數",
      "profiles": "完成資料",
      "dates": "約會次數",
      "rematch": "重新配對"
    },
    "recentMatches": "最近配對",
    "score": "分數",
    "open": "打開",
    "studentDir": "學生目錄",
    "incomplete": "未完成",
    "view": "查看",
    "loading": "載入中…"
  }
}

zh_cn = {
  "brand": "Campus Ditto HK",
  "nav": {
    "how": "如何运作",
    "safety": "安全保障",
    "faq": "常见问题",
    "join": "立即加入",
    "signOut": "退出登录"
  },
  "home": {
    "hero": {
      "getADate": "每个星期三为你送上",
      "wednesday": "一个约会",
      "atYourSchool": "@你的大学",
      "nextDrop": "下一次匹配发布：周三 7PM",
      "joinDrop": "加入下一次匹配 →"
    },
    "stats": "{students} 名学生已加入 • 100% 大学邮箱认证 • {dates} 次成功见面 •",
    "why": {
      "badge": "打破香港的无脑滑动文化",
      "title": "周三的<br/> <1>走心约会</1>",
      "desc": "厌倦了无止尽的左滑右滑和石沉大海的“Hi”？我们每周三为你送上一位高质量匹配对象。拒绝无聊游戏，只交本校朋友。",
      "noSwiping": "无需滑动",
      "noSwipingDesc": "我们的算法会为你包揽一切。",
      "campusSafe": "校园安全",
      "campusSafeDesc": "仅限验证过 .edu.hk 邮箱的学生。",
      "personalized": "个性化推荐",
      "personalizedDesc": "基于价值观、氛围感及空闲时间精准匹配。"
    },
    "curated": {
      "title": "真正可以<br/>成行的<br/>校园约会。",
      "desc": "我们不仅为你提供匹配；还会为你推荐校园内安全、氛围好的地点，以及轻松的破冰话题。",
      "cta": "即刻开始 →"
    },
    "stepsTitle": "如何获得一次约会",
    "steps": {
      "step1": {
        "title": "告诉我们你的偏好",
        "desc": "在周二晚上之前完善个人资料。",
        "example": "例如：“我喜欢尖沙咀的夜景”",
        "detailQuote": "\"你的主页就是你的电子名片。我们不仅想知道你的专业，更想了解你的灵魂。\" ✨",
        "interests": "兴趣爱好",
        "interestsDesc": "从粤语流行到科技伦理",
        "vibeTags": "氛围标签",
        "vibeTagsDesc": "追云者、夜猫子或是图书馆常驻",
        "encryptionNote": "你的数据已加密，仅向匹配对象展示。"
      },
      "step2": {
        "title": "周三匹配发布",
        "desc": "下午 7点 收到一个认真匹配。",
        "example": "例如：匹配到一位港大同学",
        "detailQuote": "\"每周三晚上 7点，魔法即刻上演。告别选择困难，只有那特别的一个。\" ✉️",
        "algoFocus": "算法核心",
        "algoFocusDesc": "\"高信号，低噪音\"",
        "userQuote": "\"七点零一分打开手机，看到同学院的他。感觉像命中注定般巧妙。\" — 港中大 大三学生"
      },
      "step3": {
        "title": "分享你的空闲时间",
        "desc": "确认一个简单的见面时间。",
        "example": "例如：“不如 Book Cafe 见！”",
        "detailQuote": "\"系统会自动寻找你们的时间交集，省去来回扯皮。\" ☕",
        "check1": "在预设的校园安全地点中选择。",
        "check2": "强烈推荐时长控制在一小时内。",
        "check3": "高诚意、低压力的初次会面。"
      },
      "step4": {
        "title": "赴约去吧",
        "desc": "提供反馈，优化下次匹配。",
        "example": "例如：“氛围很棒，再试一次！”",
        "detailQuote": "\"在现实中见面，才是火花擦出的瞬间。\" 🌟",
        "match": "来电！",
        "friends": "当朋友就好",
        "retry": "再试一次",
        "userQuote": "\"你的反馈能提升所有人的匹配质量。下周三的匹配将因你而更精准。\""
      }
    },
    "faqTitle": "常见问题",
    "faqSubtitle": "关于周三匹配，你想知道的一切",
    "faqs": [
      {
        "q": "匹配机制是如何工作的？",
        "a": "我们的算法不仅仅看‘脸’。它会综合分析你的兴趣爱好、价值观，甚至是一周日程，致力于促成极具默契的校园初见。"
      },
      {
        "q": "仅限 .edu.hk 邮箱注册吗？",
        "a": "是的。为了保障社区安全和圈子纯粹，我们仅支持使用认证学校机构邮箱登录。"
      },
      {
        "q": "为什么要每周匹配一次？",
        "a": "无止境的列表会造成审美疲劳。每周三送上唯一的高质量匹配，让你专注于好好认识眼前人。"
      },
      {
        "q": "如果遇到不满意的对象怎么办？",
        "a": "主动权永远在你手中。每次见面后你都可以反馈。无论是‘Pass’还是‘重新匹配’，算法都会学习你的偏好，安全与舒适永远排在第一位。"
      },
      {
        "q": "我们在哪里见面最好？",
        "a": "我们建议去本校内的公共场所见面，比如港大的 Book Cafe。尽量保持公开和零压力，首次碰面控制在一小时左右。"
      }
    ],
    "footerTitle": "准备好认识下一个<br/>同校的TA了吗？",
    "footerCta": "即刻开始 →",
    "footerDesc": "超过 147k+ 香港高校生已加入"
  },
  "join": {
    "title": "加入下一次周三匹配",
    "pageTitle": "学生入驻",
    "subtitle": "使用大学邮箱登录，通过验证码验证后完善资料，等待下个周三发布。",
    "emailLabel": "大学邮箱",
    "emailPlaceholder": "name@connect.hku.hk",
    "nameLabel": "真实姓名",
    "namePlaceholder": "姓名全称",
    "sendCode": "发送验证码",
    "verifyCodeLabel": "验证码",
    "verifyBtn": "验证",
    "majorLabel": "主修专业",
    "majorPlaceholder": "专业名",
    "bioLabel": "个人简介",
    "bioPlaceholder": "向大家介绍下自己...",
    "languages": "语言",
    "interests": "兴趣",
    "availability": "空闲时间",
    "saveBtn": "保存主页",
    "dashboardBtn": "打开控制台",
    "demoCodeMsg": "演示验证码：{code}",
    "verifiedMsg": "验证成功，请完善信息。",
    "verifyFirstMsg": "保存资料前，请先验证邮箱。",
    "savedMsg": "保存成功！即将跳转至仪表盘..."
  },
  "student": {
    "title": "学生仪表盘",
    "signInPrompt": "请先登录查看仪表盘。",
    "loading": "加载中…",
    "hi": "你好, {name}！",
    "major": "主修专业",
    "pending": "待完善",
    "languages": "语言",
    "currentDrop": "本周匹配",
    "compatibility": "契合度：",
    "aboutThem": "关于TA",
    "curatedDate": "建议约会安排",
    "scheduling": "时间安排",
    "waitOverlap": "等待重合时段",
    "overlap": "重合时段：{slots}",
    "noneYet": "暂无",
    "notesSys": "给系统的备忘",
    "notesPlaceholder": "告诉系统哪些有用信息？",
    "lovedIt": "非常喜欢",
    "pass": "Pass不感冒",
    "requestRematch": "申请重新匹配",
    "findingMatch": "正在为您寻找新匹配...",
    "feedbackSaved": "反馈已保存。",
    "nextDropView": {
      "title": "你已成功加入下次匹配池！",
      "desc": "Ditto 坚信质量大于数量。告别盲目左滑，你将在每周三晚上 7点 收到一位**认真的匹配对象**。",
      "countdownTitle": "下一次匹配倒计时",
      "checkBack": "周三见！",
      "verified": "仅限实名学生",
      "verifiedDesc": "我们保证每一位都是来自你学校的真实同学。",
      "highSignal": "高契合度匹配",
      "highSignalDesc": "算法精准捕捉共同兴趣和价值观。"
    }
  },
  "admin": {
    "title": "管理控制台",
    "pageTitle": "运营仪表盘",
    "resetDemo": "重置演示数据",
    "runDrop": "执行周三匹配发布",
    "msgCreated": "新创建了 {count} 组匹配。",
    "msgReset": "演示数据已经重置。",
    "stats": {
      "students": "注册学生",
      "profiles": "完整档案",
      "dates": "成功约会",
      "rematch": "重新匹配"
    },
    "recentMatches": "最新匹配记录",
    "score": "得分",
    "open": "打开",
    "studentDir": "学生名录",
    "incomplete": "未完成",
    "view": "查看",
    "loading": "加载记录中…"
  }
}

os.makedirs("src/locales", exist_ok=True)
with open("src/locales/en.json", "w", encoding="utf-8") as f:
    json.dump(en, f, indent=2, ensure_ascii=False)
with open("src/locales/zh-HK.json", "w", encoding="utf-8") as f:
    json.dump(zh_hk, f, indent=2, ensure_ascii=False)
with open("src/locales/zh-CN.json", "w", encoding="utf-8") as f:
    json.dump(zh_cn, f, indent=2, ensure_ascii=False)
