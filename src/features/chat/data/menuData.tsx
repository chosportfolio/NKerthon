import FAQ from "../../../assets/FAQ.png";
import Scholarships from "../../../assets/Scholarships.png";
import AcademicCalendar from "../../../assets/AcademicCalendar.png";
import CampusContacts from "../../../assets/CampusContacts.png";
import CertificateIssuance from "../../../assets/CertificateIssuance.png";
import CampusMap from "../../../assets/CampusMap.png";
import ShuttleBus from "../../../assets/ShuttleBus.png";
import Dormitory from "../../../assets/Dormitory.png";
import Library from "../../../assets/Library.png";
import GraduationRequirements from "../../../assets/GraduationRequirements.png";
import TLS from "../../../assets/TLS.png";
import AcademicInformationSystem from "../../../assets/AcademicInformationSystem.png";
import CourseRegistrationSystem from "../../../assets/CourseRegistration.png";
import ku_logo from "../../../assets/ku_logo.png";

import type { Menu } from "../types/chat";

export const menuData: Menu[] = [
  {
    title: {
      ko: "FAQ/챗봇소개",
      en: "FAQ / About KUBI",
      zh: "FAQ / 库比介绍",
    },
    icon: FAQ,

    showInMenu: true,
    page: 0,

    keywords: [
      "faq",
      "챗봇",
      "챗봇소개",
      "쿠비",
      "사용법",
      "뭐야",
      "소개",
      "chatbot",
      "kubi",
      "about",
      "introduction",
      "how to use",
      "what is kubi",
      "聊天机器人",
      "库比",
      "介绍",
      "使用方法",
      "是什么",
    ],

    userText: {
      ko: "챗봇 소개해주세요",
      en: "Please introduce the chatbot.",
      zh: "请介绍一下聊天机器人。",
    },

    botText: {
      ko: "쿠비를 소개해드릴게요!😄",
      en: "Let me introduce KUBI!😄",
      zh: "我来介绍一下库比！😄",
    },

    description: {
      ko:
        "쿠비는 건국대학교 마스코트인 쿠와 비서의 비를 결합한 이름이에요.\n\n" +
        "학생들이 학교생활 중 필요한 정보를 쉽고 빠르게 확인할 수 있도록 돕는 건국대학교 맞춤형 챗봇 비서라는 의미를 담고 있어요.\n\n" +
        "증명서 발급, 버스, 기숙사, 학사일정 등 자주 찾는 정보를 빠르게 안내해줘요.\n궁금한 것이 있으면 언제든지 물어보세요!",

      en:
        "KUBI is a customized chatbot assistant for Konkuk University students.\n\n" +
        "The name combines Konkuk University's mascot and the idea of a helpful assistant.\n\n" +
        "KUBI can help you quickly find information about certificates, buses, dormitories, academic calendars, scholarships, and more.\nFeel free to ask anytime!",

      zh:
        "库比是为建国大学学生提供帮助的定制聊天机器人助手。\n\n" +
        "这个名字结合了建国大学吉祥物和“助手”的含义。\n\n" +
        "库比可以帮助你快速了解证明书办理、公交、宿舍、学事日程、奖学金等常用信息。\n有问题的话可以随时问我！",
    },
  },

  {
    title: {
      ko: "장학",
      en: "Scholarships",
      zh: "奖学金",
    },
    icon: Scholarships,

    showInMenu: true,
    page: 0,

    keywords: [
      "장학",
      "장학금",
      "국가장학금",
      "교내장학",
      "교외장학",
      "장학 신청",
      "scholarship",
      "scholarships",
      "national scholarship",
      "campus scholarship",
      "financial aid",
      "奖学金",
      "国家奖学金",
      "校内奖学金",
      "校外奖学金",
      "申请奖学金",
    ],

    userText: {
      ko: "장학금 정보 알려주세요",
      en: "Please tell me about scholarships.",
      zh: "请告诉我奖学金信息。",
    },

    botText: {
      ko: "장학금 정보를 안내해드릴게요!😄",
      en: "Here is the scholarship information!😄",
      zh: "下面为你介绍奖学金信息！😄",
    },

    description: {
      ko:
        "장학금은 국가장학금, 교내장학금, 교외장학금 등으로 구분됩니다.\n\n" +
        "신청 기간, 선발 기준, 지급 방식은 장학 종류에 따라 다를 수 있으니 아래 버튼에서 원하는 장학 정보를 확인해주세요👇",

      en:
        "Scholarships are generally divided into national scholarships, on-campus scholarships, and external scholarships.\n\n" +
        "Application periods, eligibility requirements, and payment methods may differ depending on the scholarship type. Please check the links below for details👇",

      zh:
        "奖学金一般分为国家奖学金、校内奖学金和校外奖学金。\n\n" +
        "申请时间、选拔标准和发放方式可能会因奖学金类型而不同。请通过下面的按钮确认详细信息👇",
    },

    buttons: [
      {
        text: {
          ko: "장학금 안내",
          en: "Scholarship Guide",
          zh: "奖学金指南",
        },
        url: "https://scholarship.kku.ac.kr/index.do#a",
      },
      {
        text: {
          ko: "장학금 공지",
          en: "Scholarship Notices",
          zh: "奖学金公告",
        },
        url: "https://www.kku.ac.kr/cms/FR_CON/index.do?MENU_ID=1750#page1",
      },
      {
        text: {
          ko: "국가 장학금",
          en: "National Scholarship",
          zh: "国家奖学金",
        },
        url: "https://scholarship.kku.ac.kr/cms/FR_CON/index.do?MENU_ID=50",
      },
    ],
  },

  {
    title: {
      ko: "학사일정",
      en: "Academic Calendar",
      zh: "学事日程",
    },
    icon: AcademicCalendar,

    showInMenu: true,
    page: 0,

    keywords: [
      "학사일정",
      "일정",
      "개강",
      "종강",
      "시험",
      "중간고사",
      "기말고사",
      "방학",
      "학위수여식",
      "수업일수",
      "등록휴학",
      "academic calendar",
      "schedule",
      "semester",
      "class starts",
      "midterm",
      "midterm exam",
      "final",
      "final exam",
      "vacation",
      "graduation ceremony",
      "学事日程",
      "日程",
      "开学",
      "考试",
      "期中考试",
      "期末考试",
      "假期",
      "毕业典礼",
    ],

    userText: {
      ko: "학사일정 알려주세요",
      en: "Please tell me the academic calendar.",
      zh: "请告诉我学事日程。",
    },

    botText: {
      ko: "2026학년도 학사일정을 안내해드릴게요!📅",
      en: "Here is the 2026 academic calendar!📅",
      zh: "下面为你介绍2026学年度学事日程！📅",
    },

    description: {
      ko:
        "2026학년도 주요 학사일정을 월별로 정리해드릴게요.\n" +
        "등록된 일정이 없는 달은 제외하고, 학생들이 자주 확인하는 개강·시험·방학 일정을 중심으로 안내합니다.\n\n" +
        "📌 2월\n" +
        "• 02.20  2026년도 전기 학위수여식\n\n" +
        "📌 3월\n" +
        "• 03.03  2026학년도 1학기 개강 및 학기개시일\n" +
        "• 12.20 ~ 03.02  동계방학\n\n" +
        "📌 4월\n" +
        "• 04.08  수업일수 1/3선\n" +
        "• 04.21 ~ 04.27  중간고사\n" +
        "  ※ 04.20(월)까지 등록휴학 가능\n\n" +
        "📌 5월\n" +
        "• 05.12  학원창립 95주년 기념일\n" +
        "• 05.15  개교 80주년 기념일\n\n" +
        "📌 6월\n" +
        "• 06.16 ~ 06.22  기말고사\n" +
        "• 06.23 ~ 08.30  하계방학\n\n" +
        "📌 8월\n" +
        "• 08.31  2026학년도 2학기 개강 및 학기개시일\n\n" +
        "📌 10월\n" +
        "• 10.06  수업일수 1/3선\n" +
        "• 10.19 ~ 10.23  중간고사\n" +
        "  ※ 10.18(일)까지 등록휴학 가능\n\n" +
        "📌 12월\n" +
        "• 12.14 ~ 12.18  기말고사\n" +
        "• 12.21 ~ 02.26  동계방학\n\n" +
        "정확한 일정이나 변경사항은 학교 학사일정 페이지에서 다시 한 번 확인해주세요👇",

      en:
        "Here are the major academic events for 2026.\n\n" +
        "📌 February\n" +
        "• 02.20  2026 Spring Graduation Ceremony\n\n" +
        "📌 March\n" +
        "• 03.03  Start of the 2026 Spring Semester\n" +
        "• 12.20 ~ 03.02  Winter Vacation\n\n" +
        "📌 April\n" +
        "• 04.08  One-third point of the semester\n" +
        "• 04.21 ~ 04.27  Midterm Exams\n" +
        "  ※ Leave of absence with registration is available until 04.20.\n\n" +
        "📌 May\n" +
        "• 05.12  95th Foundation Anniversary\n" +
        "• 05.15  80th University Anniversary\n\n" +
        "📌 June\n" +
        "• 06.16 ~ 06.22  Final Exams\n" +
        "• 06.23 ~ 08.30  Summer Vacation\n\n" +
        "📌 August\n" +
        "• 08.31  Start of the 2026 Fall Semester\n\n" +
        "📌 October\n" +
        "• 10.06  One-third point of the semester\n" +
        "• 10.19 ~ 10.23  Midterm Exams\n" +
        "  ※ Leave of absence with registration is available until 10.18.\n\n" +
        "📌 December\n" +
        "• 12.14 ~ 12.18  Final Exams\n" +
        "• 12.21 ~ 02.26  Winter Vacation\n\n" +
        "Please check the official academic calendar page for the most accurate updates👇",

      zh:
        "下面是2026学年度主要学事日程。\n\n" +
        "📌 2月\n" +
        "• 02.20  2026年前期学位授予仪式\n\n" +
        "📌 3月\n" +
        "• 03.03  2026学年度第一学期开学\n" +
        "• 12.20 ~ 03.02  冬季假期\n\n" +
        "📌 4月\n" +
        "• 04.08  学期三分之一节点\n" +
        "• 04.21 ~ 04.27  期中考试\n" +
        "  ※ 可办理注册休学至04.20。\n\n" +
        "📌 5月\n" +
        "• 05.12  学园创立95周年纪念日\n" +
        "• 05.15  建校80周年纪念日\n\n" +
        "📌 6月\n" +
        "• 06.16 ~ 06.22  期末考试\n" +
        "• 06.23 ~ 08.30  暑假\n\n" +
        "📌 8月\n" +
        "• 08.31  2026学年度第二学期开学\n\n" +
        "📌 10月\n" +
        "• 10.06  学期三分之一节点\n" +
        "• 10.19 ~ 10.23  期中考试\n" +
        "  ※ 可办理注册休学至10.18。\n\n" +
        "📌 12月\n" +
        "• 12.14 ~ 12.18  期末考试\n" +
        "• 12.21 ~ 02.26  冬季假期\n\n" +
        "具体日程可能会变动，请通过学校官网再次确认👇",
    },

    buttons: [
      {
        text: {
          ko: "학사일정 바로가기",
          en: "Go to Academic Calendar",
          zh: "查看学事日程",
        },
        url: "https://www.kku.ac.kr/cms/FR_CON/index.do?MENU_ID=1350&SCH_GBN=CAL&SCH_YEAR=2026",
      },
    ],
  },

  {
    title: {
      ko: "교내 연락처",
      en: "Campus Contacts",
      zh: "校内联系方式",
    },
    icon: CampusContacts,

    showInMenu: true,
    page: 0,

    keywords: [
      "연락처",
      "교내 연락처",
      "전화번호",
      "대표전화",
      "학과 전화번호",
      "학과사무실",
      "행정실",
      "대학본부",
      "교직원 전화번호",
      "컴퓨터공학과",
      "도서관",
      "contact",
      "contacts",
      "phone",
      "phone number",
      "campus contacts",
      "department office",
      "administration office",
      "computer engineering",
      "library",
      "联系方式",
      "电话",
      "电话号码",
      "校内电话",
      "办公室",
      "行政室",
      "计算机工程",
      "图书馆",
    ],

    userText: {
      ko: "교내 연락처 알려주세요",
      en: "Please tell me the campus contact numbers.",
      zh: "请告诉我校内联系电话。",
    },

    botText: {
      ko: "교내 주요 연락처를 안내해드릴게요!☎️",
      en: "Here are the main campus contact numbers!☎️",
      zh: "下面为你介绍校内主要联系电话！☎️",
    },

    description: {
      ko:
        "건국대학교 글로컬캠퍼스의 주요 전화번호를 안내해드릴게요.\n\n" +
        "📌 대표전화\n" +
        "• 건국대학교 글로컬캠퍼스 대표전화: 043-840-3114\n\n" +
        "📌 대학별 주요 연락처\n" +
        "• 인문사회융합대학 행정실: 043-840-3402\n" +
        "• 디자인대학 행정실: 043-840-3633\n" +
        "• 과학기술대학 행정실: 043-840-3518\n" +
        "• 의료생명대학 행정실: 043-840-3922\n" +
        "• KU글로컬혁신대학 관련 문의는 주요 전화번호 페이지에서 확인해주세요.\n\n" +
        "📌 학과/전공 사무실 예시\n" +
        "• 컴퓨터공학과: 043-840-3513\n" +
        "• 메카트로닉스공학과: 043-840-3514\n" +
        "• 간호학과: 043-840-3925\n" +
        "• 경영학과: 043-840-3411\n" +
        "• 유아교육과/교직과: 043-840-3404\n\n" +
        "📌 대학원 연락처\n" +
        "• 일반대학원 행정실: 043-840-3234, 3235\n" +
        "• 창의융합대학원 행정실: 043-840-3233\n" +
        "• 교육대학원 행정실: 043-840-3233\n\n" +
        "찾고 싶은 부서나 학과가 있다면 아래 버튼에서 주요 전화번호 또는 교직원 전화번호 검색을 이용해주세요.",

      en:
        "Here are the main contact numbers for Konkuk University Glocal Campus.\n\n" +
        "📌 Main Number\n" +
        "• Konkuk University Glocal Campus: 043-840-3114\n\n" +
        "📌 Major College Offices\n" +
        "• College of Humanities and Social Convergence: 043-840-3402\n" +
        "• College of Design: 043-840-3633\n" +
        "• College of Science and Technology: 043-840-3518\n" +
        "• College of Biomedical and Health Science: 043-840-3922\n\n" +
        "📌 Department Office Examples\n" +
        "• Computer Engineering: 043-840-3513\n" +
        "• Mechatronics Engineering: 043-840-3514\n" +
        "• Nursing: 043-840-3925\n" +
        "• Business Administration: 043-840-3411\n" +
        "• Early Childhood Education / Teaching: 043-840-3404\n\n" +
        "If you are looking for a specific office or department, please use the contact search page below.",

      zh:
        "下面是建国大学GLOCAL校区主要联系电话。\n\n" +
        "📌 代表电话\n" +
        "• 建国大学GLOCAL校区代表电话：043-840-3114\n\n" +
        "📌 各学院主要联系方式\n" +
        "• 人文社会融合学院行政室：043-840-3402\n" +
        "• 设计学院行政室：043-840-3633\n" +
        "• 科学技术学院行政室：043-840-3518\n" +
        "• 医疗生命学院行政室：043-840-3922\n\n" +
        "📌 学科/专业办公室示例\n" +
        "• 计算机工程系：043-840-3513\n" +
        "• 机电一体化工程系：043-840-3514\n" +
        "• 护理学系：043-840-3925\n" +
        "• 经营学系：043-840-3411\n" +
        "• 幼儿教育/教职相关：043-840-3404\n\n" +
        "如果想查找特定部门或学科，请使用下面的联系方式搜索页面。",
    },

    buttons: [
      {
        text: {
          ko: "주요 전화번호 바로가기",
          en: "Main Contact Numbers",
          zh: "主要联系电话",
        },
        url: "https://www.kku.ac.kr/cms/FR_CON/index.do?MENU_ID=650&CONTENTS_NO=3&P_TAB_NO=3",
      },
      {
        text: {
          ko: "교직원 전화번호 검색",
          en: "Search Staff Contacts",
          zh: "搜索教职员联系方式",
        },
        url: "https://www.kku.ac.kr/cms/FR_CON/index.do?MENU_ID=660",
      },
    ],
  },

  {
    title: {
      ko: "증명서 발급",
      en: "Certificates",
      zh: "证明书办理",
    },
    icon: CertificateIssuance,

    showInMenu: true,
    page: 0,

    keywords: [
      "증명서",
      "증명서 발급",
      "재학증명서",
      "휴학증명서",
      "성적증명서",
      "졸업증명서",
      "수료증명서",
      "등록금 납부확인서",
      "교육비 납입증명서",
      "장학금 수혜증명서",
      "인터넷 발급",
      "우편 발급",
      "팩스민원",
      "자동발급기",

      "certificate",
      "certificates",
      "certificate issuance",
      "enrollment certificate",
      "transcript",
      "graduation certificate",
      "tuition payment certificate",

      "证明书",
      "证明书办理",
      "在学证明",
      "成绩证明",
      "毕业证明",
      "学费缴纳确认书",
    ],

    userText: {
      ko: "증명서 발급 알려주세요",
      en: "Please tell me how to issue certificates.",
      zh: "请告诉我如何办理证明书。",
    },

    botText: {
      ko: "증명서 발급 방법을 안내해드릴게요!📄",
      en: "Here is how to issue certificates!📄",
      zh: "下面为你介绍证明书办理方法！📄",
    },

    description: {
      ko:
        "재학증명서, 성적증명서, 졸업증명서, 수료증명서 등 각종 증명서는 온라인, 우편, 팩스민원, 카카오톡 전자증명서, 교내 자동발급기, 학사지원팀 방문 등을 통해 발급할 수 있습니다.\n\n" +
        "증명서 종류마다 발급 가능 시점이나 조건이 다를 수 있으니, 자세한 내용은 아래 공식 안내 페이지에서 확인해주세요.\n\n" +
        "📌 교내 자동발급기\n" +
        "• 위치: 행정관(U1) 1층\n" +
        "• 이용시간: 09:00~17:30\n" +
        "• 월~금 운영, 공휴일 제외\n\n" +
        "📞 문의\n" +
        "• 학사지원팀: 043-840-3256\n" +
        "• 이메일: academy@kku.ac.kr",

      en:
        "Certificates such as enrollment certificates, transcripts, graduation certificates, and completion certificates can be issued online, by mail, through fax civil service, KakaoTalk electronic certificates, on-campus certificate machines, or by visiting the Academic Support Team.\n\n" +
        "The availability and conditions may differ depending on the certificate type, so please check the official guide page below.\n\n" +
        "📌 On-campus Certificate Machine\n" +
        "• Location: Administration Hall U1, 1st floor\n" +
        "• Hours: 09:00~17:30\n" +
        "• Monday to Friday, excluding public holidays\n\n" +
        "📞 Inquiries\n" +
        "• Academic Support Team: 043-840-3256\n" +
        "• Email: academy@kku.ac.kr",

      zh:
        "在学证明书、成绩证明书、毕业证明书、结业证明书等各类证明书，可通过网上办理、邮寄、传真民愿、KakaoTalk电子证明书、校内自动证明书机器或访问学事支援组办理。\n\n" +
        "不同证明书的办理时间和条件可能不同，请通过下面的官方 안내 页面确认详细信息。\n\n" +
        "📌 校内自动证明书机器\n" +
        "• 位置：行政馆 U1 1楼\n" +
        "• 时间：09:00~17:30\n" +
        "• 周一至周五运营，公休日除外\n\n" +
        "📞 咨询\n" +
        "• 学事支援组：043-840-3256\n" +
        "• 邮箱：academy@kku.ac.kr",
    },

    buttons: [
      {
        text: {
          ko: "증명서 발급 안내",
          en: "Certificate Issuance Guide",
          zh: "证明书办理指南",
        },
        url: "https://www.kku.ac.kr/cms/FR_CON/index.do?MENU_ID=1390",
      },
      {
        text: {
          ko: "학사정보시스템 바로가기",
          en: "Go to Academic Info System",
          zh: "进入学事信息系统",
        },
        url: "https://kis.kku.ac.kr/index.do",
      },
    ],
  },

  {
    title: {
      ko: "캠퍼스 맵",
      en: "Campus Map",
      zh: "校园地图",
    },
    icon: CampusMap,

    showInMenu: true,
    page: 0,

    keywords: [
      "캠퍼스",
      "캠퍼스맵",
      "지도",
      "건물",
      "위치",
      "강의동",
      "campus",
      "campus map",
      "map",
      "building",
      "location",
      "lecture hall",
      "校园",
      "校园地图",
      "地图",
      "建筑",
      "位置",
      "教学楼",
    ],

    userText: {
      ko: "캠퍼스 맵 알려주세요",
      en: "Please show me the campus map.",
      zh: "请给我看校园地图。",
    },

    botText: {
      ko: "건국대학교 글로컬캠퍼스의 캠퍼스맵을 안내해드릴게요!😄",
      en: "Here is the campus map for Konkuk University Glocal Campus!😄",
      zh: "下面为你介绍建国大学GLOCAL校区地图！😄",
    },

    description: {
      ko: "건물 및 편의시설의 위치를 캠퍼스 맵에서 확인할 수 있어요!👇",
      en: "You can check the locations of buildings and campus facilities on the campus map👇",
      zh: "你可以在校园地图中确认建筑物和便利设施的位置👇",
    },

    buttons: [
      {
        text: {
          ko: "캠퍼스 맵",
          en: "Campus Map",
          zh: "校园地图",
        },
        url: "https://www.kku.ac.kr/campusMap.do?MENU_ID=670",
      },
    ],
  },

  {
    title: {
      ko: "통학교통",
      en: "Commuting Bus",
      zh: "通学交通",
    },
    icon: ShuttleBus,

    showInMenu: true,
    page: 0,

    keywords: [
      "버스",
      "셔틀",
      "통학버스",
      "시내버스",
      "교통",
      "건국터미널",
      "건터",
      "동서울",
      "안양",
      "부천",
      "안산",
      "인천",
      "통학",
      "bus",
      "shuttle",
      "commuting bus",
      "transportation",
      "terminal",
      "dongseoul",
      "anyang",
      "bucheon",
      "ansan",
      "incheon",
      "公交",
      "巴士",
      "校车",
      "通学巴士",
      "交通",
      "东首尔",
      "安养",
      "富川",
      "安山",
      "仁川",
    ],

    userText: {
      ko: "통학교통 알려주세요",
      en: "Please tell me about commuting buses.",
      zh: "请告诉我通学交通信息。",
    },

    botText: {
      ko: "통학교통 시간표를 안내해드릴게요!🚌",
      en: "Here is the commuting bus schedule!🚌",
      zh: "下面为你介绍通学交通时间表！🚌",
    },

    description: {
      ko:
        "아래 시간표는 2026년 3월 3일 기준 통학교통 안내입니다.\n" +
        "운행 시간은 변경될 수 있으니, 정확한 내용은 학교 통학교통 안내 페이지를 함께 확인해주세요.\n\n" +
        "📌 동서울 방면\n" +
        "• 08:10 수안보발\n" +
        "• 09:00 수안보발\n" +
        "• 09:50 직통\n" +
        "• 10:45 직통\n" +
        "• 13:35 직통\n" +
        "• 14:00 수안보발\n" +
        "• 14:15 직통\n" +
        "• 14:35 직통\n" +
        "• 15:00 수안보발\n" +
        "• 16:40 수안보발\n" +
        "• 18:30 직통\n" +
        "• 19:20 직통\n\n" +
        "✅ 동서울 이용 참고사항\n" +
        "• 일요일과 공휴일에는 수안보 출발 차량만 운행됩니다.\n" +
        "• 건대 출발 동서울행은 약 2시간 정도 소요됩니다.\n" +
        "• 경유지: 수안보 → 건대 → 교통대 → 주덕 → 용원 → 생극 → 일죽 → 동서울\n" +
        "• 좌석제 예매가 가능합니다.\n\n" +
        "📌 안양 · 부천 방면\n" +
        "• 18:25 QR 현장 발권 후 탑승\n\n" +
        "📌 안산 · 인천 방면\n" +
        "• 08:30 승차권 또는 QR 탑승\n" +
        "• 13:20 승차권 또는 QR 탑승\n" +
        "• 17:30 승차권 또는 QR 탑승\n\n" +
        "✅ 안산 · 인천 이용 참고사항\n" +
        "• 화요일과 수요일은 운행하지 않습니다.\n" +
        "• 목, 금, 토, 일, 월요일에 운행됩니다.\n\n" +
        "📞 문의 전화\n" +
        "• 안산 · 인천: 천선고속 043-844-2605\n" +
        "• 그 외 노선: 경기고속 043-848-2748\n\n" +
        "⚠️ 승차권 예매 후 발권은 출발 5분 전까지 반드시 완료해주세요.",

      en:
        "The following commuting bus schedule is based on March 3, 2026.\n" +
        "Schedules may change, so please check the official transportation page for the latest information.\n\n" +
        "📌 Dongseoul Route\n" +
        "• 08:10 From Suanbo\n" +
        "• 09:00 From Suanbo\n" +
        "• 09:50 Direct\n" +
        "• 10:45 Direct\n" +
        "• 13:35 Direct\n" +
        "• 14:00 From Suanbo\n" +
        "• 14:15 Direct\n" +
        "• 14:35 Direct\n" +
        "• 15:00 From Suanbo\n" +
        "• 16:40 From Suanbo\n" +
        "• 18:30 Direct\n" +
        "• 19:20 Direct\n\n" +
        "✅ Notes for Dongseoul\n" +
        "• On Sundays and public holidays, only buses departing from Suanbo operate.\n" +
        "• It takes about 2 hours from campus to Dongseoul.\n" +
        "• Route: Suanbo → Campus → Korea National Univ. of Transportation → Judeok → Yongwon → Saenggeuk → Iljuk → Dongseoul\n" +
        "• Reserved seating is available.\n\n" +
        "📌 Anyang · Bucheon Route\n" +
        "• 18:25 Board after QR on-site ticketing\n\n" +
        "📌 Ansan · Incheon Route\n" +
        "• 08:30 Ticket or QR boarding\n" +
        "• 13:20 Ticket or QR boarding\n" +
        "• 17:30 Ticket or QR boarding\n\n" +
        "✅ Notes for Ansan · Incheon\n" +
        "• No service on Tuesdays and Wednesdays.\n" +
        "• Service operates on Thursday, Friday, Saturday, Sunday, and Monday.\n\n" +
        "📞 Contact\n" +
        "• Ansan · Incheon: Cheonseon Express 043-844-2605\n" +
        "• Other routes: Gyeonggi Express 043-848-2748\n\n" +
        "⚠️ After reserving a ticket, please make sure to issue it at least 5 minutes before departure.",

      zh:
        "以下通学交通时间表以2026年3月3日为准。\n" +
        "运行时间可能会变动，请同时通过学校通学交通页面确认最新信息。\n\n" +
        "📌 东首尔方向\n" +
        "• 08:10 水安堡出发\n" +
        "• 09:00 水安堡出发\n" +
        "• 09:50 直达\n" +
        "• 10:45 直达\n" +
        "• 13:35 直达\n" +
        "• 14:00 水安堡出发\n" +
        "• 14:15 直达\n" +
        "• 14:35 直达\n" +
        "• 15:00 水安堡出发\n" +
        "• 16:40 水安堡出发\n" +
        "• 18:30 直达\n" +
        "• 19:20 直达\n\n" +
        "✅ 东首尔方向注意事项\n" +
        "• 星期日和公休日只运行水安堡出发车辆。\n" +
        "• 从校园出发到东首尔约需2小时。\n" +
        "• 经由：水安堡 → 建国大学 → 交通大学 → 周德 → 龙院 → 生极 → 一竹 → 东首尔\n" +
        "• 可进行座位预约。\n\n" +
        "📌 安养 · 富川方向\n" +
        "• 18:25 现场QR发券后乘车\n\n" +
        "📌 安山 · 仁川方向\n" +
        "• 08:30 车票或QR乘车\n" +
        "• 13:20 车票或QR乘车\n" +
        "• 17:30 车票或QR乘车\n\n" +
        "✅ 安山 · 仁川方向注意事项\n" +
        "• 星期二和星期三不运行。\n" +
        "• 星期四、星期五、星期六、星期日、星期一运行。\n\n" +
        "📞 联系电话\n" +
        "• 安山 · 仁川：天善高速 043-844-2605\n" +
        "• 其他路线：京畿高速 043-848-2748\n\n" +
        "⚠️ 预约车票后，请务必在出发前5分钟完成发券。",
    },

    buttons: [
      {
        text: {
          ko: "통학교통 바로가기",
          en: "Go to Transportation Guide",
          zh: "查看通学交通",
        },
        url: "https://www.kku.ac.kr/cms/FR_CON/index.do?MENU_ID=1090&CONTENTS_NO=2&P_TAB_NO=1",
      },
    ],
  },

  {
    title: {
      ko: "기숙사",
      en: "Dormitory",
      zh: "宿舍",
    },
    icon: Dormitory,

    showInMenu: true,
    page: 0,

    keywords: [
      "기숙사",
      "생활관",
      "입사",
      "퇴사",
      "모시래",
      "해오름",
      "기숙사 연락처",
      "기숙사 홈페이지",
      "dormitory",
      "dorm",
      "residence hall",
      "housing",
      "mosirae",
      "haeoreum",
      "move in",
      "move out",
      "宿舍",
      "生活馆",
      "入住",
      "退宿",
      "宿舍联系方式",
      "宿舍主页",
    ],

    userText: {
      ko: "기숙사 정보 알려주세요",
      en: "Please tell me about the dormitory.",
      zh: "请告诉我宿舍信息。",
    },

    botText: {
      ko: "기숙사 정보를 알려드릴게요!😄",
      en: "Here is the dormitory information!😄",
      zh: "下面为你介绍宿舍信息！😄",
    },

    description: {
      ko:
        "건국대학교 글로컬캠퍼스의 기숙사인 모시래학사와 해오름학사는 학생들이 학업에 열중할 수 있도록 기본적인 주거환경과 편의시설을 제공하고 있습니다.\n\n" +
        "입사, 퇴사, 생활 안내 등 자세한 내용은 아래 버튼에서 확인해주세요👇",

      en:
        "Mosirae Hall and Haeoreum Hall are dormitories at Konkuk University Glocal Campus.\n\n" +
        "They provide residential facilities and services to help students focus on their studies.\n\n" +
        "Please check the links below for details about move-in, move-out, and dormitory life👇",

      zh:
        "木西来学舍和海奥름学舍是建国大学GLOCAL校区的学生宿舍。\n\n" +
        "宿舍为学生提供基本住宿环境和便利设施，帮助学生专心学习。\n\n" +
        "入住、退宿和宿舍生活相关信息请通过下面的按钮确认👇",
    },

    buttons: [
      {
        text: {
          ko: "모시래 학사",
          en: "Mosirae Hall",
          zh: "木西来学舍",
        },
        url: "https://dorm.kku.ac.kr",
      },
      {
        text: {
          ko: "해오름 학사",
          en: "Haeoreum Hall",
          zh: "海奥름学舍",
        },
        url: "https://dorm.kku.ac.kr",
      },
    ],
  },

  {
    title: {
      ko: "도서관",
      en: "Library",
      zh: "图书馆",
    },
    icon: Library,

    showInMenu: true,
    page: 1,

    keywords: [
      "도서관",
      "책",
      "열람실",
      "자료실",
      "도서 대출",
      "library",
      "book",
      "reading room",
      "loan",
      "borrow books",
      "library hours",
      "图书馆",
      "书",
      "阅览室",
      "资料室",
      "借书",
    ],

    userText: {
      ko: "도서관 정보 알려주세요",
      en: "Please tell me about the library.",
      zh: "请告诉我图书馆信息。",
    },

    botText: {
      ko: "도서관 정보를 안내해드릴게요!😄",
      en: "Here is the library information!😄",
      zh: "下面为你介绍图书馆信息！😄",
    },

    description: {
      ko:
        "중원도서관은 학생들의 연구 및 학습 활동을 지원하기 위해 학술자료 제공, 도서 대출, 열람실 운영 등 다양한 서비스를 제공하고 있습니다.\n\n" +
        "자세한 이용 정보는 아래 버튼에서 확인하세요👇",

      en:
        "Jungwon Library provides various services such as academic resources, book loans, reading rooms, and learning support for students.\n\n" +
        "Please check the link below for detailed library information👇",

      zh:
        "中原图书馆为学生的研究和学习活动提供学术资料、图书借阅、阅览室等多种服务。\n\n" +
        "详细使用信息请通过下面的按钮确认👇",
    },

    buttons: [
      {
        text: {
          ko: "도서관 바로가기",
          en: "Go to Library",
          zh: "进入图书馆",
        },
        url: "https://lib.kku.ac.kr/",
      },
    ],
  },

  {
    title: {
      ko: "졸업 요건",
      en: "Graduation Requirements",
      zh: "毕业条件",
    },
    icon: GraduationRequirements,

    showInMenu: true,
    page: 1,

    keywords: [
      "졸업",
      "졸업요건",
      "졸업학점",
      "졸업 조건",
      "이수학점",
      "졸업논문",
      "졸업사정",
      "학위수여",
      "졸업유예",
      "미졸자",
      "등록",
      "graduation",
      "graduation requirements",
      "graduation credits",
      "credits",
      "thesis",
      "degree",
      "graduation deferment",
      "毕业",
      "毕业条件",
      "毕业学分",
      "学分",
      "毕业论文",
      "学位",
      "延迟毕业",
      "注册",
    ],

    userText: {
      ko: "졸업요건 알려주세요",
      en: "Please tell me the graduation requirements.",
      zh: "请告诉我毕业条件。",
    },

    botText: {
      ko: "졸업에 대해 안내해드릴게요!🎓",
      en: "Here are the graduation requirements!🎓",
      zh: "下面为你介绍毕业条件！🎓",
    },

    description: {
      ko:
        "졸업은 등록, 졸업기준학점 이수, 졸업논문 통과, 외국어인증 등 소정의 요건을 모두 갖춘 재학생을 대상으로 졸업사정을 통해 결정됩니다.\n\n" +
        "매 학기 개강 전 소속학과 또는 전공 지도교수님께 수강지도를 받아 졸업에 필요한 사항을 확인한 뒤 수강신청하는 것이 좋습니다.\n\n" +
        "공통사항 외에 소속학과 또는 전공별 추가 요건이 있을 수 있으므로, 자세한 내용은 학과 사무실에 확인해야 합니다.\n\n" +
        "📌 등록 기준\n" +
        "• 정규학기 8회 이상 등록해야 합니다.\n" +
        "• 의과대학은 12회 이상 등록해야 합니다.\n" +
        "• 편입생은 정규학기 4회 이상 등록해야 합니다.\n" +
        "• 의과대학 편입생은 8회 이상 등록해야 합니다.\n\n" +
        "📌 대학별 졸업이수학점\n" +
        "• KU글로컬혁신대학 라이프설계융합학과, 첨단산업융합학과: 120학점\n" +
        "• 인문사회융합대학 유아교육과 제외: 124학점\n" +
        "• 의료생명대학 사회복지학과: 124학점\n" +
        "• 디자인대학: 132학점\n" +
        "• 과학기술대학: 132학점\n" +
        "• 의료생명대학 간호학과, 사회복지학과 제외: 132학점\n" +
        "• 의료생명대학 간호학과: 135학점\n" +
        "• 인문사회융합대학 유아교육과: 140학점\n" +
        "• 의과대학: 233학점\n\n" +
        "📌 졸업논문\n" +
        "소속 학부, 학과, 전공의 졸업논문 기준을 충족해야 합니다.\n" +
        "졸업논문은 졸업시험, 졸업작품, 실습보고서, 실기발표, 외국어시험 등으로 운영될 수 있습니다.\n\n" +
        "📌 졸업유예\n" +
        "졸업요건을 모두 충족한 졸업예정자 중 해당 학기 졸업을 연기하고 싶은 학생은 졸업유예를 신청할 수 있습니다.\n" +
        "• 신청시기: 매년 1월, 7월 중\n" +
        "• 신청방법: 학사정보시스템 → 미졸자관리 → 졸업유예 신청/취소\n\n" +
        "📌 미졸자 신청학점별 등록금\n" +
        "• 1~3학점: 등록금의 1/6 납부\n" +
        "• 4~6학점: 등록금의 1/3 납부\n" +
        "• 7~9학점: 등록금의 1/2 납부\n" +
        "• 10학점 이상: 등록금 전액 납부",

      en:
        "Graduation is determined through a graduation evaluation for students who have completed all required conditions, such as registration, required credits, thesis or graduation exam, and foreign language certification.\n\n" +
        "Before each semester begins, students should consult their academic advisor or department office to confirm graduation requirements before registering for courses.\n\n" +
        "📌 Registration Requirement\n" +
        "• Students must register for at least 8 regular semesters.\n" +
        "• College of Medicine students must register for at least 12 semesters.\n" +
        "• Transfer students must register for at least 4 regular semesters.\n" +
        "• Transfer students in the College of Medicine must register for at least 8 semesters.\n\n" +
        "📌 Required Graduation Credits by College\n" +
        "• KU Glocal Innovation College: 120 credits\n" +
        "• College of Humanities and Social Convergence, excluding Early Childhood Education: 124 credits\n" +
        "• Department of Social Welfare: 124 credits\n" +
        "• College of Design: 132 credits\n" +
        "• College of Science and Technology: 132 credits\n" +
        "• College of Biomedical and Health Science, excluding Nursing and Social Welfare: 132 credits\n" +
        "• Nursing: 135 credits\n" +
        "• Early Childhood Education: 140 credits\n" +
        "• College of Medicine: 233 credits\n\n" +
        "📌 Graduation Thesis or Exam\n" +
        "Students must satisfy the graduation thesis, graduation exam, project, practice report, performance, or foreign language exam requirements set by their department or major.\n\n" +
        "📌 Graduation Deferment\n" +
        "Students who meet all graduation requirements but wish to postpone graduation may apply for graduation deferment.\n" +
        "• Application period: Around January and July each year\n" +
        "• Method: Academic Information System → Non-graduate Management → Apply/Cancel Graduation Deferment\n\n" +
        "📌 Tuition for Students Who Have Not Graduated\n" +
        "• 1–3 credits: 1/6 of tuition\n" +
        "• 4–6 credits: 1/3 of tuition\n" +
        "• 7–9 credits: 1/2 of tuition\n" +
        "• 10 or more credits: Full tuition",

      zh:
        "毕业对象为已完成注册、毕业基准学分、毕业论文或毕业考试、外语认证等规定条件的在校生，并通过毕业审查决定是否毕业。\n\n" +
        "建议每学期开学前向所属学科或专业指导教授确认毕业所需事项后再进行选课。\n\n" +
        "📌 注册条件\n" +
        "• 一般学生需注册8个正规学期以上。\n" +
        "• 医科大学学生需注册12个学期以上。\n" +
        "• 插班生需注册4个正规学期以上。\n" +
        "• 医科大学插班生需注册8个学期以上。\n\n" +
        "📌 各学院毕业所需学分\n" +
        "• KU GLOCAL创新学院：120学分\n" +
        "• 人文社会融合学院，不含幼儿教育科：124学分\n" +
        "• 医疗生命学院社会福利学科：124学分\n" +
        "• 设计学院：132学分\n" +
        "• 科学技术学院：132学分\n" +
        "• 医疗生命学院，不含护理学科和社会福利学科：132学分\n" +
        "• 护理学科：135学分\n" +
        "• 幼儿教育科：140学分\n" +
        "• 医科大学：233学分\n\n" +
        "📌 毕业论文\n" +
        "学生需要满足所属学部、学科或专业规定的毕业论文、毕业考试、毕业作品、实习报告、实技发表或外语考试等要求。\n\n" +
        "📌 延迟毕业\n" +
        "已满足毕业条件但希望推迟毕业的预定毕业生可以申请延迟毕业。\n" +
        "• 申请时间：每年1月、7月左右\n" +
        "• 申请方法：学事信息系统 → 未毕业者管理 → 延迟毕业申请/取消\n\n" +
        "📌 未毕业者按申请学分缴纳学费\n" +
        "• 1~3学分：缴纳学费的1/6\n" +
        "• 4~6学分：缴纳学费的1/3\n" +
        "• 7~9学分：缴纳学费的1/2\n" +
        "• 10学分以上：缴纳全额学费",
    },

    buttons: [
      {
        text: {
          ko: "졸업요건 바로가기",
          en: "Graduation Requirements",
          zh: "查看毕业条件",
        },
        url: "https://www.kku.ac.kr/cms/FR_CON/index.do?MENU_ID=1320&CONTENTS_NO=5&P_TAB_NO=5",
      },
      {
        text: {
          ko: "졸업논문(시험)관련 시행 요강",
          en: "Graduation Thesis / Exam Guidelines",
          zh: "毕业论文/考试相关规定",
        },
        url: "https://wwwold.kku.ac.kr/common/downLoad.do?siteId=wwwkr&fileSeq=117195",
      },
    ],
  },

  {
    title: {
      ko: "수강신청시스템",
      en: "Course Registration",
      zh: "选课系统",
    },
    icon: CourseRegistrationSystem,

    showInMenu: true,
    page: 1,

    keywords: [
      "수강신청",
      "수강",
      "수강신청시스템",
      "강의 신청",
      "시간표",
      "장바구니",
      "정정기간",
      "course registration",
      "course",
      "register classes",
      "class registration",
      "timetable",
      "schedule",
      "shopping cart",
      "add drop",
      "选课",
      "选课系统",
      "课程申请",
      "课程表",
      "时间表",
      "更正期间",
    ],

    userText: {
      ko: "수강신청 정보 알려주세요",
      en: "Please tell me about course registration.",
      zh: "请告诉我选课信息。",
    },

    botText: {
      ko: "수강신청 정보를 안내해드릴게요!😄",
      en: "Here is the course registration information!😄",
      zh: "下面为你介绍选课信息！😄",
    },

    description: {
      ko:
        "수강신청은 정해진 기간에 수강신청 시스템을 통해 진행됩니다.\n\n" +
        "기간은 보통 1학기 2월 중, 여름계절 5월 말, 2학기 8월 중, 겨울계절 11월 말에 진행됩니다.\n\n" +
        "아래 버튼을 눌러 상세 일정과 수강신청 시스템을 확인해보세요👇",

      en:
        "Course registration is completed through the course registration system during the designated period.\n\n" +
        "It is usually held around February for the spring semester, late May for the summer session, August for the fall semester, and late November for the winter session.\n\n" +
        "Please check the detailed schedule and course registration system below👇",

      zh:
        "选课需在指定期间通过选课系统进行。\n\n" +
        "一般第一学期选课在2月左右，夏季学期在5月末，第二学期在8月左右，冬季学期在11月末进行。\n\n" +
        "请通过下面按钮确认详细日程和选课系统👇",
    },

    buttons: [
      {
        text: {
          ko: "상세 일정",
          en: "Detailed Schedule",
          zh: "详细日程",
        },
        url: "https://www.kku.ac.kr/cms/FR_CON/index.do?MENU_ID=1350&SCH_GBN=CAL&SCH_YEAR=2026",
      },
      {
        text: {
          ko: "수강신청 시스템 바로가기",
          en: "Go to Course Registration",
          zh: "进入选课系统",
        },
        url: "https://kupis.kku.ac.kr/wsugang/",
      },
    ],
  },

  {
    title: {
      ko: "TLS",
      en: "TLS",
      zh: "TLS",
    },
    icon: TLS,

    showInMenu: true,
    page: 1,

    keywords: [
      "tls",
      "이캠퍼스",
      "강의자료",
      "온라인강의",
      "과제",
      "e-campus",
      "online class",
      "lecture materials",
      "assignment",
      "homework",
      "在线课程",
      "课程资料",
      "作业",
      "网上课程",
    ],

    userText: {
      ko: "TLS 알려주세요",
      en: "Please tell me about TLS.",
      zh: "请告诉我TLS信息。",
    },

    botText: {
      ko: "TLS에 대해 안내해드릴게요!😄",
      en: "Here is the TLS information!😄",
      zh: "下面为你介绍TLS信息！😄",
    },

    description: {
      ko:
        "TLS는 통합 교육포털 플랫폼으로서 학생들에게 학습 환경을 제공하고 교수님들의 강의 활동을 지원하는 교육정보시스템입니다.\n\n" +
        "강의자료, 과제, 온라인 강의, 공지사항 등을 확인할 수 있어요👇",

      en:
        "TLS is an integrated educational portal system that supports students' learning and professors' teaching activities.\n\n" +
        "You can check lecture materials, assignments, online lectures, and notices through TLS👇",

      zh:
        "TLS是综合教育门户平台，为学生提供学习环境，并支持教授的课程活动。\n\n" +
        "你可以在TLS中查看课程资料、作业、线上课程和公告等信息👇",
    },

    buttons: [
      {
        text: {
          ko: "TLS 바로가기",
          en: "Go to TLS",
          zh: "进入TLS",
        },
        url: "https://tls.kku.ac.kr/login.php",
      },
    ],
  },

  {
    title: {
      ko: "학사정보시스템",
      en: "Academic Info System",
      zh: "学事信息系统",
    },
    icon: AcademicInformationSystem,

    showInMenu: true,
    page: 1,

    keywords: [
      "학사정보",
      "학사정보시스템",
      "종합정보",
      "성적",
      "등록",
      "학적",
      "kis",
      "academic information system",
      "student portal",
      "grades",
      "registration",
      "academic record",
      "student record",
      "学事信息",
      "学事信息系统",
      "成绩",
      "注册",
      "学籍",
      "综合信息",
    ],

    userText: {
      ko: "학사정보시스템 알려주세요",
      en: "Please tell me about the academic information system.",
      zh: "请告诉我学事信息系统。",
    },

    botText: {
      ko: "학사정보시스템에 대해 안내해드릴게요!😄",
      en: "Here is the academic information system!😄",
      zh: "下面为你介绍学事信息系统！😄",
    },

    description: {
      ko:
        "학사정보시스템에서는 성적, 등록, 학적, 수강 정보 등 학업과 관련된 정보들을 확인할 수 있습니다.\n\n" +
        "아래 버튼을 눌러 확인해보세요👇",

      en:
        "In the Academic Information System, you can check academic-related information such as grades, registration, student records, and course information.\n\n" +
        "Please check it through the button below👇",

      zh:
        "在学事信息系统中，可以查看成绩、注册、学籍、选课信息等与学业相关的信息。\n\n" +
        "请通过下面的按钮确认👇",
    },

    buttons: [
      {
        text: {
          ko: "학사정보시스템 바로가기",
          en: "Go to Academic Info System",
          zh: "进入学事信息系统",
        },
        url: "https://kis.kku.ac.kr/index.do",
      },
    ],
  },

  {
    title: {
      ko: "입학처",
      en: "Admissions",
      zh: "招生处",
    },
    icon: ku_logo,

    showInMenu: true,
    page: 1,

    keywords: [
      "입학",
      "입학처",
      "수시",
      "정시",
      "편입",
      "입시",
      "admission",
      "admissions",
      "application",
      "transfer",
      "freshman admission",
      "招生",
      "招生处",
      "入学",
      "申请",
      "插班",
      "转学",
    ],

    userText: {
      ko: "입학처 정보 알려주세요",
      en: "Please tell me about admissions.",
      zh: "请告诉我招生处信息。",
    },

    botText: {
      ko: "입학처 정보를 안내해드릴게요!😄",
      en: "Here is the admissions information!😄",
      zh: "下面为你介绍招生处信息！😄",
    },

    description: {
      ko:
        "입학처에서는 수시, 정시, 편입, 모집요강, 합격자 발표 등 입학과 관련된 정보를 확인할 수 있습니다.\n\n" +
        "아래 버튼을 눌러 확인해보세요👇",

      en:
        "The admissions office provides information about admissions, applications, transfer admissions, recruitment guidelines, and admission results.\n\n" +
        "Please check the admissions page below👇",

      zh:
        "招生处提供关于入学、申请、插班、招生简章、合格者发表等相关信息。\n\n" +
        "请通过下面的按钮确认👇",
    },

    buttons: [
      {
        text: {
          ko: "입학처 바로가기",
          en: "Go to Admissions",
          zh: "进入招生处",
        },
        url: "https://enter.kku.ac.kr/intro/",
      },
    ],
  },
];

export const getMenuPages = (): Menu[][] => {
  const visibleMenus = menuData.filter((menu) => menu.showInMenu);

  const pageCount =
    Math.max(...visibleMenus.map((menu) => menu.page ?? 0)) + 1;

  return Array.from({ length: pageCount }, (_, pageIndex) =>
    visibleMenus.filter((menu) => menu.page === pageIndex)
  );
};
