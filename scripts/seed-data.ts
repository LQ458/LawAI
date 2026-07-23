/**
 * Seed Demo Data
 *
 * Creates explicitly synthetic Chinese labor-law teaching examples in MongoDB,
 * then optionally ingests them into Pinecone.
 *
 * Usage:
 *   npx tsx scripts/seed-data.ts               # seed MongoDB only
 *   npx tsx scripts/seed-data.ts --pinecone     # seed MongoDB + ingest Pinecone
 */

import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as path from "path";
import { spawnSync } from "child_process";
import { createStableDocumentId } from "./lib/document-metadata";
import {
  getIntegerArg,
  hasFlag,
  readCheckpoint,
  resolveCheckpointPath,
  safeFailureMessage,
  withRetry,
  writeCheckpoint,
} from "./lib/safe-cli";

dotenv.config({ path: path.resolve(__dirname, "../.env.local"), quiet: true });

const args = process.argv.slice(2);

interface SeedCheckpoint {
  schemaVersion: 1;
  nextIndex: number;
  written: number;
}

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/seed-data.ts [options]

Options:
  --dry-run                    Plan only; no MongoDB or Pinecone writes
  --batch-size=N               MongoDB upsert batch size (default: 25)
  --resume-from=N              Resume at zero-based demo example N
  --checkpoint=PATH            Resume from/write a checkpoint
  --pinecone                   Run non-destructive Pinecone upsert afterward
  --help                       Show this help
`);
}

interface SeedRecord {
  title: string;
  description: string;
  content: string;
  date: string;
  link: string;
  tags: string[];
  category: string;
}

const DEMO_CASES: SeedRecord[] = [
  // === 工伤 / Workplace Injury ===
  {
    title: "建筑工人工伤认定与赔偿案例",
    description:
      "建筑工人在工地高处作业时坠落受伤，用人单位未在30日内申请工伤认定，工人自行申请获得认定",
    content:
      "张某在深圳市龙岗区某建筑工地从事外墙装修工作。2024年3月15日，张某在6米高处作业时因脚手架不稳坠落，造成腰椎骨折。用人单位深圳市XX建筑工程有限公司未在事故发生后30日内向人社局申请工伤认定。张某家属自行向龙岗区人社局提交工伤认定申请，提供了医院诊断书、工友证言、微信工作群聊天记录等证据。人社局经调查认定张某为工伤。根据《工伤保险条例》第十七条，张某有权获得医疗费、停工留薪期工资、一次性伤残补助金等赔偿。最终经劳动仲裁，用人单位支付各项赔偿共计28万元。",
    date: "2024-05-20",
    link: "https://example.com/case/sz-injury-001",
    tags: ["工伤", "建筑", "赔偿", "工伤认定"],
    category: "work_injury",
  },
  {
    title: "工厂机器操作工伤赔偿纠纷",
    description:
      "电子厂操作工被冲压机压伤手指，用人单位辩称是工人操作失误拒绝赔偿",
    content:
      "李某在东莞市某电子厂担任冲压机操作工。2024年1月8日，李某在操作冲压机时右手食指和中指被机器压伤，造成部分功能丧失。用人单位以李某违反操作规程为由拒绝承担工伤保险责任。李某向东莞市人社局申请工伤认定，同时向劳动监察大队投诉。根据《工伤保险条例》第十四条，在工作时间和工作场所内因工作原因受到事故伤害的应当认定为工伤。李某的情况符合工伤认定条件，即使存在操作不当，用人单位仍需承担工伤保险责任。经调解，用人单位支付医疗费3.2万元、停工留薪期工资2.4万元、一次性伤残补助金5万元。",
    date: "2024-03-10",
    link: "https://example.com/case/dg-injury-002",
    tags: ["工伤", "工厂", "手指", "机器"],
    category: "work_injury",
  },
  {
    title: "外卖骑手送餐途中交通事故工伤认定",
    description:
      "外卖骑手在送餐途中发生交通事故，平台以非雇佣关系为由拒绝承担工伤责任",
    content:
      "王某是一名外卖平台众包骑手。2024年6月20日，王某在送餐途中与一辆小轿车发生碰撞，造成左腿骨折。平台以王某与平台是合作关系而非劳动关系为由拒绝承担任何责任。王某向当地人社局申请工伤认定。根据最高人民法院相关司法解释，新就业形态劳动者与平台之间存在事实劳动关系的，应当认定为工伤。经调查，平台对王某实行排班管理、绩效考核、按单计酬，实质上形成了管理与被管理的关系。人社局最终认定王某的受伤属于工伤，平台需承担相应的工伤保险待遇责任。",
    date: "2024-08-15",
    link: "https://example.com/case/rider-injury-003",
    tags: ["工伤", "外卖骑手", "交通事故", "新就业形态"],
    category: "work_injury",
  },
  {
    title: "职业病患者维权案例",
    description:
      "化工厂工人长期接触有毒物质患上职业病，工厂拒绝承认与工作环境有关",
    content:
      "赵某在江苏省某化工厂工作8年，长期接触苯类化学物质。2023年底，赵某出现持续性头晕、乏力、牙龈出血等症状，经医院诊断为慢性苯中毒（再生障碍性贫血）。赵某向工厂提出职业病认定申请，工厂拒绝提供工作环境检测报告和相关材料。赵某向当地卫生行政部门投诉，要求进行职业病诊断。根据《职业病防治法》和《工伤保险条例》，职业病的诊断和认定不以用人单位同意为前提。经职业病诊断机构诊断，确认赵某的病情与长期接触苯类化学物质有因果关系。赵某被认定为职业病工伤，获得医疗费用报销、伤残津贴、一次性伤残补助金等共计45万元。",
    date: "2024-02-28",
    link: "https://example.com/case/occupational-004",
    tags: ["工伤", "职业病", "化工", "苯中毒"],
    category: "work_injury",
  },
  // === 工资拖欠 / Wage Arrears ===
  {
    title: "建筑工地农民工工资集体拖欠案",
    description: "30余名农民工在工程项目完工后被拖欠工资共计80余万元",
    content:
      "2024年春节前，深圳市某大型住宅项目工地的32名农民工被总包单位和分包单位互相推诿，拖欠工资共计82万元。工人们多次讨要无果。根据《保障农民工工资支付条例》，施工总承包单位对农民工工资支付负总责。农民工代表向深圳市住建局和人社局进行了投诉举报。劳动监察大队介入调查后发现，总包单位未按规定设立农民工工资专用账户，分包单位也未与农民工签订劳动合同。经行政处理，责令总包单位在5日内先行清偿全部拖欠工资，并对总包和分包单位各处以罚款5万元。",
    date: "2024-01-25",
    link: "https://example.com/case/wage-collective-005",
    tags: ["工资拖欠", "建筑", "农民工", "集体维权"],
    category: "wage_dispute",
  },
  {
    title: "餐饮业员工三个月工资被拖欠",
    description: "饭店因经营不善拖欠员工工资，员工通过劳动仲裁维权",
    content:
      "陈某在广州市天河区某餐厅担任厨师，月薪8000元。2024年4月至6月，餐厅以经营困难为由连续拖欠陈某三个月工资共2.4万元。陈某保留了微信转账记录、排班表、工作群聊天记录等证据。2024年7月，陈某向天河区劳动人事争议仲裁委员会申请仲裁。根据《劳动合同法》第八十五条，用人单位未及时足额支付劳动报酬的，劳动行政部门责令限期支付。仲裁庭裁决餐厅支付陈某全部拖欠工资及额外25%的经济补偿金共3万元。",
    date: "2024-07-18",
    link: "https://example.com/case/wage-restaurant-006",
    tags: ["工资拖欠", "餐饮", "劳动仲裁", "证据"],
    category: "wage_dispute",
  },
  {
    title: "疫情期间隔离工资争议",
    description: "员工因疫情防控被隔离期间，用人单位拒发工资",
    content:
      "王某为北京市某科技公司员工。2024年1月，王某因密切接触确诊患者被要求集中隔离14天。隔离期满后，公司以王某未正常出勤为由扣发该期间工资。王某认为隔离是疫情防控需要，公司应支付正常工资。根据人社部相关规定，对新型冠状病毒感染的肺炎患者、疑似病人、密切接触者因被采取隔离治疗、隔离观察等隔离措施导致不能提供正常劳动的，企业应当支付职工在此期间的工作报酬。经劳动监察大队调解，公司补发了王某隔离期间的工资4200元。",
    date: "2024-02-10",
    link: "https://example.com/case/wage-isolation-007",
    tags: ["工资拖欠", "疫情", "隔离", "劳动监察"],
    category: "wage_dispute",
  },
  // === 劳动合同 / Labor Contract ===
  {
    title: "未签订劳动合同双倍工资争议",
    description:
      "员工工作14个月未签劳动合同，离职后要求用人单位支付双倍工资差额",
    content:
      "刘某在上海市某物流公司担任司机，从2023年1月入职至2024年3月离职，共计工作14个月，公司始终未与其签订书面劳动合同。刘某月薪为6000元。离职后，刘某向上海市劳动仲裁委申请仲裁，要求公司支付未签劳动合同期间的双倍工资差额。根据《劳动合同法》第八十二条，用人单位自用工之日起超过一个月不满一年未与劳动者订立书面劳动合同的，应当向劳动者每月支付二倍的工资。仲裁委支持了刘某的请求，裁决公司支付11个月的双倍工资差额共计6.6万元。",
    date: "2024-04-15",
    link: "https://example.com/case/contract-double-008",
    tags: ["劳动合同", "双倍工资", "未签合同", "劳动仲裁"],
    category: "labor_contract",
  },
  {
    title: "试用期超过法定期限劳动争议",
    description: "用人单位设置6个月试用期且到期后不转正，员工起诉",
    content:
      "李某2023年9月入职成都市某互联网公司，双方签订了为期2年的劳动合同，约定试用期为6个月。2024年3月试用期满后，公司以李某能力不足为由拒绝转正但继续用工。根据《劳动合同法》第十九条，劳动合同期限一年以上不满三年的，试用期不得超过二个月。公司约定的6个月试用期违法，且试用期满后继续用工视为自动转正。李某向劳动仲裁委申请仲裁，要求确认劳动关系、支付试用期满至申请期间的工资差额以及违法约定试用期的赔偿。仲裁委全额支持了李某的请求。",
    date: "2024-05-08",
    link: "https://example.com/case/contract-probation-009",
    tags: ["劳动合同", "试用期", "违法解除", "赔偿"],
    category: "labor_contract",
  },
  {
    title: "大学生实习期间劳动关系认定案",
    description: "大学实习生工作内容与正式员工相同，主张存在事实劳动关系",
    content:
      "张某为武汉某大学大四学生，2023年10月经学校安排到武汉市某科技有限公司实习。实习期间，张某从事的工作内容与公司正式员工完全一致，每天工作8小时，接受公司考勤管理，公司按每月2000元支付实习补贴。2024年6月毕业后，公司以实习期结束为由不再继续用工。张某认为其实习期间已经构成事实劳动关系。根据相关规定，在校学生利用业余时间勤工助学不视为就业，但如果以就业为目的、接受用人单位管理、从事有报酬的劳动，可以认定为劳动关系。仲裁委认定张某在毕业后与公司存在劳动关系，公司应支付经济补偿金。",
    date: "2024-07-20",
    link: "https://example.com/case/contract-intern-010",
    tags: ["劳动合同", "实习", "劳动关系认定", "大学生"],
    category: "labor_contract",
  },
  // === 加班费 / Overtime ===
  {
    title: "互联网公司996工作制加班费争议",
    description: "程序员长期超时加班，公司以弹性工作制为由拒付加班费",
    content:
      "王某在杭州市某互联网公司担任软件工程师，合同约定月薪1.5万元，工作时间为标准工时制。实际工作中，公司推行996工作制（早9点至晚9点、每周工作6天），远超法定标准工时。公司以实行弹性工作制和绩效工资为由不支付加班费。根据《劳动法》第三十六条和第四十四条，标准工时为每日不超过8小时、每周不超过40小时。超过标准工时的应当支付加班费。经计算，王某每月加班约80小时。劳动仲裁委裁决公司支付王某入职一年来的加班费共计约6.8万元。",
    date: "2024-06-12",
    link: "https://example.com/case/ot-996-011",
    tags: ["加班费", "996", "互联网", "标准工时"],
    category: "overtime",
  },
  {
    title: "工厂12小时工作制加班费计算",
    description: "电子厂工人每天工作12个小时，加班费按正常工资计算引发争议",
    content:
      "黄某在深圳市某电子厂担任生产线操作工，月基本工资2360元（深圳市最低工资标准）。工厂实行两班倒制度，每班12小时，每月休息2天。工厂按正常小时工资支付加班费而非法定倍数。根据《劳动法》规定，工作日延长工作时间应支付150%工资、休息日工作不补休应支付200%工资、法定节假日工作应支付300%工资。经计算，黄某每月应得加班费约为4200元，而工厂实际支付仅约2000元。劳动监察大队责令工厂补发加班费差额，并处以罚款。",
    date: "2024-04-08",
    link: "https://example.com/case/ot-factory-012",
    tags: ["加班费", "工厂", "12小时", "最低工资"],
    category: "overtime",
  },
  // === 社保 / Social Insurance ===
  {
    title: "公司长期未缴纳社保的赔偿责任",
    description: "员工工作5年公司从未缴纳社保，离职后要求赔偿社保损失",
    content:
      "孙某在济南市某贸易公司工作5年（2019年3月至2024年3月），期间公司从未为其缴纳社会保险。2024年3月，孙某因病住院花费医疗费3.2万元，因无医保全部自费。孙某离职后向劳动仲裁委申请仲裁，要求公司赔偿因未缴纳社保导致的医疗费损失及养老、失业等社保损失。根据《社会保险法》规定，用人单位应当自用工之日起三十日内为职工办理社会保险登记。因用人单位未缴纳社保导致职工无法享受社保待遇的，应当赔偿损失。仲裁委支持了孙某的医疗费赔偿请求，并裁决公司补缴社保费用及滞纳金共计约4.8万元。",
    date: "2024-05-30",
    link: "https://example.com/case/social-insurance-013",
    tags: ["社保", "未缴社保", "医疗费", "赔偿责任"],
    category: "social_insurance",
  },
  {
    title: "灵活就业人员社保缴纳争议",
    description: "平台兼职人员要求平台为其缴纳社保",
    content:
      "张某通过某众包平台从事兼职配送工作，月均收入约5000元。张某要求平台为其缴纳社保，平台以双方是合作关系为由拒绝。2024年，广东省出台了新就业形态劳动者权益保障相关政策，要求平台企业为符合条件的劳动者参加特定人员工伤保险。同时，灵活就业人员可以个人身份参加职工基本养老保险和基本医疗保险。人社部门指导张某以灵活就业人员身份参保，并协调平台按照新政策为其缴纳工伤保险。",
    date: "2024-08-01",
    link: "https://example.com/case/social-insurance-flex-014",
    tags: ["社保", "灵活就业", "平台经济", "工伤保险"],
    category: "social_insurance",
  },
  // === 裁员 / Severance ===
  {
    title: "企业经济性裁员补偿金计算争议",
    description: "公司以经济性裁员为由解除劳动合同，员工质疑补偿标准",
    content:
      "2024年3月，北京市某制造企业以生产经营发生严重困难为由进行经济性裁员，一次性裁员50余人。其中员工周某在该公司工作8年，月平均工资9000元。公司提出按工作年限每年支付一个月工资作为经济补偿，共计8个月7.2万元。周某认为公司未履行法定裁员程序（未提前30日向工会说明、未向劳动行政部门报告），要求按违法解除支付赔偿金（2倍经济补偿金）。根据《劳动合同法》第四十一条和第四十七条，经济性裁员需履行法定程序，经济补偿按劳动者在本单位工作的年限每满一年支付一个月工资。仲裁委认定公司裁员程序存在瑕疵，裁决支付2倍赔偿金14.4万元。",
    date: "2024-04-22",
    link: "https://example.com/case/severance-layoff-015",
    tags: ["裁员", "经济补偿", "赔偿金", "程序违法"],
    category: "severance",
  },
  {
    title: "疫情期间企业裁员特殊规定",
    description: "疫情期间企业以经营困难裁员，员工主张特殊保护",
    content:
      "2024年初，武汉市某餐饮企业因疫情影响经营困难，以经济性裁员为由解除了15名员工的劳动合同。其中员工李某正处于医疗期（因病休假），员工王某处于孕期。根据《劳动合同法》第四十二条，劳动者在医疗期、孕期、产期、哺乳期的，用人单位不得依照第四十条、第四十一条的规定解除劳动合同。仲裁委认定公司对李某和王某的解除属于违法解除，裁决撤销解除决定、恢复劳动关系并补发工资。对其他员工的裁员，因符合经济性裁员条件，裁决支付法定经济补偿金。",
    date: "2024-03-15",
    link: "https://example.com/case/severance-covid-016",
    tags: ["裁员", "疫情", "医疗期", "孕期保护"],
    category: "severance",
  },
  // === 非法解雇 / Wrongful Termination ===
  {
    title: "怀孕女职工被违法解除劳动合同",
    description: "公司以绩效考核不合格为由辞退怀孕5个月女员工",
    content:
      "林某在厦门市某外贸公司工作3年，2024年2月怀孕。2024年7月（孕期5个月），公司以林某绩效考核不合格、不能胜任工作为由单方面解除劳动合同。林某向劳动仲裁委申请仲裁。根据《劳动合同法》第四十二条和《女职工劳动保护特别规定》，女职工在孕期、产期、哺乳期的，用人单位不得解除劳动合同。仲裁委认定公司的解除行为违法，裁决撤销解除决定、恢复劳动关系、补发工资，并赔偿精神损害抚慰金1万元。",
    date: "2024-08-10",
    link: "https://example.com/case/wrongful-pregnant-017",
    tags: ["非法解雇", "孕期", "女职工保护", "恢复劳动关系"],
    category: "wrongful_termination",
  },
  {
    title: "员工举报违规后被报复性辞退",
    description: "员工向监管部门举报企业违规行为后遭辞退，主张打击报复",
    content:
      "陈某在苏州市某化工企业担任安全员，发现企业存在重大安全隐患和违规排污行为。2024年5月，陈某向应急管理部门和环保部门进行了实名举报。2024年6月，企业以陈某违反公司规章为由将其辞退。根据《劳动法》和《劳动合同法》，劳动者对用人单位违法行为进行举报投诉属于合法行为，用人单位不得因此对劳动者进行打击报复。仲裁委认定企业的解除行为属于违法解除，裁决支付赔偿金并恢复劳动关系。同时，相关部门对企业违法行为进行了查处，罚款20万元。",
    date: "2024-07-28",
    link: "https://example.com/case/wrongful-whistleblower-018",
    tags: ["非法解雇", "举报", "打击报复", "违法解除"],
    category: "wrongful_termination",
  },
  // === 最低工资 / Minimum Wage ===
  {
    title: "包吃住工资低于最低工资标准争议",
    description: "饭店以包吃住为由支付低于最低工资标准的工资",
    content:
      "何某在成都市某饭店担任服务员，月薪1800元，饭店包吃住。2024年成都市月最低工资标准为2100元。何某认为其工资低于最低工资标准，向饭店提出涨薪要求被拒。根据《最低工资规定》，最低工资标准是指劳动者在法定工作时间提供了正常劳动的前提下，用人单位应支付的最低劳动报酬。用人单位提供食宿不能抵扣最低工资。劳动监察大队责令饭店补发工资差额并处以罚款。何某获补发差额工资5400元（18个月差额）。",
    date: "2024-05-25",
    link: "https://example.com/case/minimum-wage-019",
    tags: ["最低工资", "包吃住", "工资差额", "劳动监察"],
    category: "minimum_wage",
  },
  // === 试用期 / Probation ===
  {
    title: "试用期6个月不转正不交社保",
    description: "公司以延长试用期为由，一年内不转正不缴纳社保",
    content:
      "韩某2023年5月入职西安市某教育培训机构，签订了3年期限的劳动合同，约定试用期6个月。2023年11月试用期满后，公司以经营调整为由单方面延长试用期至2024年5月（共计12个月）。且整个试用期期间公司未为韩某缴纳社保。根据《劳动合同法》第十九条，三年以上固定期限劳动合同试用期不得超过6个月，且同一用人单位与同一劳动者只能约定一次试用期。仲裁委裁决公司立即为韩某办理转正手续、补缴全部社保费用、支付试用期满至转正期间的工资差额。",
    date: "2024-06-01",
    link: "https://example.com/case/probation-extend-020",
    tags: ["试用期", "社保未缴", "延长试用期", "违法"],
    category: "probation",
  },
  // === 劳务派遣 / Labor Dispatch ===
  {
    title: "派遣工同工同酬权益纠纷",
    description: "派遣工与正式工同岗位但工资待遇差距大",
    content:
      "吴某经某劳务派遣公司派遣至北京市某大型国企担任行政文员，月薪4500元。与该岗位的正式员工（月薪8000元）从事完全相同的工作，但工资待遇悬殊。吴某工作2年后发现此情况，向劳动仲裁委申请仲裁。根据《劳动合同法》第六十三条，被派遣劳动者享有与用工单位的劳动者同工同酬的权利。用工单位应当按照同工同酬原则，对被派遣劳动者与本单位同类岗位的劳动者实行相同的劳动报酬分配办法。仲裁委裁决用工单位补发吴某工资差额共计约7万元。",
    date: "2024-04-30",
    link: "https://example.com/case/dispatch-equal-pay-021",
    tags: ["劳务派遣", "同工同酬", "工资差额", "国企"],
    category: "labor_dispatch",
  },
  // === 年假 / Annual Leave ===
  {
    title: "未休年假工资补偿争议",
    description: "员工3年未休年假，离职时要求补偿",
    content:
      "郑某在杭州市某广告公司工作3年，从未休过年假。2024年8月，郑某因个人原因提出离职并主张未休年假的工资补偿。根据《职工带薪年休假条例》和《企业职工带薪年休假实施办法》，累计工作满1年不满10年的职工年休假5天。对应休未休的年假天数，单位应当按照职工日工资收入的300%支付年休假工资报酬。仲裁委裁决公司支付郑某3年未休年假共计15天的补偿工资约7200元。",
    date: "2024-08-25",
    link: "https://example.com/case/annual-leave-022",
    tags: ["年假", "未休年假", "300%补偿", "离职"],
    category: "annual_leave",
  },
  // === More general cases ===
  {
    title: "农民工法律援助成功追索劳动报酬案",
    description: "法律援助中心帮助12名农民工追索劳务报酬60余万元",
    content:
      "2024年初，12名河南籍农民工在浙江省湖州市某建筑工地打工，工程完工后包工头失联，拖欠工资共计63万元。农民工向湖州市法律援助中心申请法律援助。援助律师通过调查取证，锁定了总承包单位的法定责任。根据《保障农民工工资支付条例》第三十条，分包单位拖欠农民工工资的，由施工总承包单位先行清偿。经法院判决，总承包单位向12名农民工全额支付了拖欠工资及利息共计65.8万元。",
    date: "2024-03-20",
    link: "https://example.com/case/legal-aid-023",
    tags: ["法律援助", "农民工", "工资拖欠", "总包责任"],
    category: "wage_dispute",
  },
  {
    title: "女职工生育保险待遇纠纷",
    description: "女职工生育后因单位未缴生育保险无法领取生育津贴",
    content:
      "余某在南京市某私企工作3年，公司一直未为她缴纳生育保险。2024年2月，余某剖腹产生育一子，因无生育保险无法领取生育津贴和报销医疗费。根据《社会保险法》和《女职工劳动保护特别规定》，用人单位应为女职工缴纳生育保险。因单位未缴纳导致无法享受生育保险待遇的，由用人单位支付。仲裁委裁决公司支付余某生育医疗费1.2万元和生育津贴2.4万元。",
    date: "2024-04-10",
    link: "https://example.com/case/maternity-insurance-024",
    tags: ["生育保险", "女职工", "生育津贴", "社保"],
    category: "social_insurance",
  },
  {
    title: "竞业限制补偿金争议案",
    description: "员工离职后被要求履行竞业限制但公司未支付补偿金",
    content:
      "彭某原为深圳市某科技公司高级工程师，掌握核心技术秘密。2023年底彭某离职时与公司签订了2年竞业限制协议，约定公司每月支付竞业限制补偿金8000元。但公司仅支付了2个月后便停止支付。根据《劳动合同法》第二十三条，用人单位应在竞业限制期限内按月给予劳动者经济补偿。因用人单位的原因导致三个月未支付经济补偿的，劳动者可以请求解除竞业限制约定。仲裁委支持彭某解除竞业限制，并裁决公司支付已产生的补偿金及违约金。",
    date: "2024-06-18",
    link: "https://example.com/case/non-compete-025",
    tags: ["竞业限制", "补偿金", "技术秘密", "违约责任"],
    category: "labor_contract",
  },
  {
    title: "外卖骑手劳动关系确认案",
    description: "通过平台用工模式判断是否存在事实劳动关系",
    content:
      "杨某在某外卖平台从事配送工作一年半，平台以合作协议而非劳动合同为名管理骑手。杨某在配送途中受伤，平台否认存在劳动关系拒不承担工伤责任。法院审理认为，虽然双方签订的是合作协议，但从用工管理实质来看，平台通过算法对杨某进行派单、定价、考核奖惩，杨某对平台具有经济从属性和人身从属性，应认定为事实劳动关系。法院判决确认双方存在劳动关系，平台需承担工伤保险责任。",
    date: "2024-07-15",
    link: "https://example.com/case/gig-worker-026",
    tags: ["劳动关系", "外卖骑手", "平台经济", "工伤"],
    category: "labor_contract",
  },
  {
    title: "退休年龄争议与再就业权益保障",
    description: "达到退休年龄后继续工作的劳动者主张同工同酬",
    content:
      "王某（女，52岁）在广州市某物业公司从事保洁工作5年。2024年，公司以王某已达退休年龄为由将其工资降低30%。根据最高人民法院相关司法解释和《劳动合同法》，达到法定退休年龄但未享受养老保险待遇的劳动者与用人单位之间形成的是劳动关系而非劳务关系。仲裁委认定公司降薪行为违法，裁决恢复原工资标准并补发工资差额。",
    date: "2024-08-05",
    link: "https://example.com/case/retirement-age-027",
    tags: ["退休", "同工同酬", "劳动关系认定", "再就业"],
    category: "labor_contract",
  },
  {
    title: "保安公司违章安排超时工作争议",
    description: "保安员连续工作24小时后突发疾病，用人单位拒绝承认工伤",
    content:
      "钟某在上海市某保安服务公司工作，经常被安排连续值班24小时甚至36小时。2024年3月的一天，钟某在连续工作30小时后突发脑溢血，经抢救脱离危险但留下后遗症。公司以钟某有高血压病史为由拒绝承担工伤责任。根据《工伤保险条例》第十五条，在工作时间和工作岗位突发疾病死亡或在48小时内抢救无效死亡的视同工伤。仲裁委经调查认定钟某的长期超时工作与突发疾病有直接因果关系，裁定公司承担全部医疗费用并给予伤残赔偿。",
    date: "2024-05-12",
    link: "https://example.com/case/security-overtime-028",
    tags: ["超时工作", "工伤认定", "职业病", "保安"],
    category: "overtime",
  },
  {
    title: "公司搬迁后员工辞职经济补偿案",
    description: "公司跨市搬迁，员工不愿随迁提出辞职并要求经济补偿",
    content:
      "某公司在未与员工协商的情况下决定将办公地点从上海搬迁至昆山，部分员工不愿随迁提出辞职，并要求公司支付经济补偿金。根据《劳动合同法》第四十条，劳动合同订立时所依据的客观情况发生重大变化（如工作地点变更）导致合同无法履行的，用人单位应支付经济补偿。仲裁委支持了员工的请求，裁决公司按工作年限支付经济补偿。",
    date: "2024-06-28",
    link: "https://example.com/case/relocation-029",
    tags: ["公司搬迁", "经济补偿", "工作地点变更", "辞职"],
    category: "severance",
  },
  {
    title: "非法用工单位伤亡人员一次性赔偿案",
    description: "无营业执照的小作坊发生工人死亡事故，近亲属主张赔偿",
    content:
      "某无证经营的小作坊发生事故造成一名工人死亡，死者家属要求作坊主赔偿。根据《非法用工单位伤亡人员一次性赔偿办法》，无营业执照或未经依法登记备案的单位以及被依法吊销营业执照的单位受到事故伤害的职工，由单位给予一次性赔偿。赔偿标准不低于工伤保险待遇。经调解，作坊主一次性赔偿死者家属95万元。",
    date: "2024-01-30",
    link: "https://example.com/case/illegal-employment-030",
    tags: ["非法用工", "事故赔偿", "无证经营", "死亡赔偿"],
    category: "work_injury",
  },
];

async function seed() {
  if (hasFlag(args, "--help")) {
    printHelp();
    return;
  }

  const dryRun = hasFlag(args, "--dry-run");
  const batchSize = getIntegerArg(args, "--batch-size", 25, {
    min: 1,
    max: 500,
  });
  const explicitResume = args.some(
    (arg) => arg === "--resume-from" || arg.startsWith("--resume-from="),
  );
  const resumeFrom = getIntegerArg(args, "--resume-from", 0, {
    min: 0,
    max: DEMO_CASES.length,
  });
  const explicitCheckpoint = args.some(
    (arg) => arg === "--checkpoint" || arg.startsWith("--checkpoint="),
  );
  const checkpointPath = resolveCheckpointPath(args, "seed-data.json");
  const checkpoint = explicitCheckpoint
    ? readCheckpoint<SeedCheckpoint>(checkpointPath)
    : undefined;
  const startIndex = explicitResume ? resumeFrom : checkpoint?.nextIndex || 0;

  console.log("Synthetic seed-data upsert");
  console.log(`Mode: ${dryRun ? "dry-run" : "MongoDB upsert"}`);
  console.log(`Examples: ${DEMO_CASES.length}; start index: ${startIndex}`);
  console.log(
    `Batch size: ${batchSize}; visibility: public; source: synthetic`,
  );

  if (dryRun) {
    console.log("External writes=0; document text output=0.");
    return;
  }

  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) throw new Error("MONGODB_URL not set");

  await mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;
  const collection = db.collection("records");

  let written = explicitResume ? 0 : checkpoint?.written || 0;
  try {
    for (
      let offset = startIndex;
      offset < DEMO_CASES.length;
      offset += batchSize
    ) {
      const cases = DEMO_CASES.slice(offset, offset + batchSize);
      const operations = cases.map((example, relativeIndex) => {
        const index = offset + relativeIndex;
        const documentId = createStableDocumentId(
          "lawai-synthetic-seed",
          example.link || String(index),
        );
        const disclaimer =
          "【合成教学示例，非真实裁判事实】人物、机构、日期、地点、金额及处理结果均为虚构，仅用于学习。";
        const document = {
          ...example,
          documentId,
          visibility: "public",
          sensitivity: "public",
          source: "LawAI synthetic seed dataset",
          sourceKind: "synthetic",
          sourceUrl: "synthetic://lawai/seed-data",
          version: "seed-v1",
          needsReview: false,
          syntheticMetric: true,
          title: `[合成示例] ${example.title}`,
          link: `synthetic://lawai/seed-example/${documentId}`,
          description: `${disclaimer}${example.description}`,
          content: `${disclaimer}\n${example.content}`,
          date: "synthetic-example",
          tags: Array.from(new Set([...example.tags, "合成示例"])),
          views: 0,
          likes: 0,
          bookmarks: 0,
          interactionScore: 0,
          lastUpdateTime: new Date(),
          updatedAt: new Date(),
        };
        return {
          updateOne: {
            filter: { documentId },
            update: {
              $set: document,
              $setOnInsert: { createdAt: new Date() },
            },
            upsert: true,
          },
        };
      });

      await withRetry(
        () => collection.bulkWrite(operations, { ordered: false }),
        {
          onRetry: (attempt) =>
            console.warn(
              `MongoDB batch retry ${attempt}/3; record data omitted.`,
            ),
        },
      );
      written += operations.length;
      const nextIndex = offset + operations.length;
      writeCheckpoint<SeedCheckpoint>(checkpointPath, {
        schemaVersion: 1,
        nextIndex,
        written,
      });
      console.log(`Progress: written=${written}, nextIndex=${nextIndex}.`);
    }
  } finally {
    await mongoose.disconnect();
  }
  console.log(`MongoDB seed complete: written=${written}.`);

  if (hasFlag(args, "--pinecone")) {
    const child = spawnSync(
      "npx",
      [
        "tsx",
        "scripts/ingest-pinecone.ts",
        `--batch-size=${Math.min(batchSize, 96)}`,
      ],
      {
        cwd: path.resolve(__dirname, ".."),
        stdio: "inherit",
      },
    );
    if (child.status !== 0) {
      throw new Error("Pinecone follow-up failed");
    }
  }
}

seed().catch((error) => {
  console.error(safeFailureMessage("Synthetic seed-data upsert", error));
  process.exitCode = 1;
});
