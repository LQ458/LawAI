export interface TestQuery {
  id: number;
  category: string;
  query: string;
  expectedBehavior: string;
  minScore?: number;
}

export const TEST_QUERIES: TestQuery[] = [
  {
    id: 1,
    category: "工伤",
    query: "我在工地搬砖时砸伤了脚，老板不给医药费，我该怎么办？",
    expectedBehavior:
      "先询问受伤时间、地点、用人单位名称、受伤部位、医院诊断、医疗费用等具体信息，然后提供工伤认定流程和维权途径",
    minScore: 70,
  },
  {
    id: 2,
    category: "工资拖欠",
    query: "老板拖欠了三个月的工资，总共两万多块钱，我怎么才能要回来？",
    expectedBehavior:
      "先询问是否有劳动合同、工资支付方式(现金/转账)、是否有欠条或聊天记录、用人单位全称，然后告知劳动监察投诉和劳动仲裁途径",
    minScore: 70,
  },
  {
    id: 3,
    category: "劳动合同",
    query: "我在一个饭店打工一年了，没有签劳动合同，现在被开除了，我有什么权利？",
    expectedBehavior:
      "告知未签劳动合同的法律后果(双倍工资)、事实劳动关系的认定、经济补偿金的计算。先询问工资标准、工作期间、被开除原因",
    minScore: 70,
  },
  {
    id: 4,
    category: "加班费",
    query: "我在电子厂每天工作12个小时，加班费一直按正常工资算，这样合理吗？",
    expectedBehavior:
      "先询问月薪/时薪标准、是否有考勤记录、合同约定的工作时间。告知加班费法定倍率(150%/200%/300%)和维权途径",
    minScore: 70,
  },
  {
    id: 5,
    category: "社保",
    query: "公司一直没给我交社保，我现在生病住院了，自己能报销吗？该怎么办？",
    expectedBehavior:
      "告知社保是法定义务，提供12333热线和劳动监察投诉渠道。先询问在哪个城市、工作多久、是否有工资流水证明劳动关系",
    minScore: 70,
  },
  {
    id: 6,
    category: "裁员",
    query: "公司突然通知裁员，说只给一个月工资补偿，我已经干了五年了，应该拿多少？",
    expectedBehavior:
      "先询问月平均工资、是否有书面裁员通知、裁员原因。告知经济补偿金N+1标准和非法裁员的赔偿标准",
    minScore: 70,
  },
  {
    id: 7,
    category: "非法解雇",
    query: "我怀孕五个月了，公司找借口把我辞退了，我能告他们吗？",
    expectedBehavior:
      "告知孕期保护是法定的，明确公司行为违法。询问是否有书面辞退通知、公司名称、工作年限。提供劳动仲裁和投诉渠道",
    minScore: 70,
  },
  {
    id: 8,
    category: "职业病",
    query: "我在化工厂工作了三年，最近查出肺部有问题，医生说可能和化工原料有关，这算工伤吗？",
    expectedBehavior:
      "先询问具体诊断结果、在哪家医院诊断、工厂名称、接触的化工原料类型。告知职业病诊断流程和工伤认定程序",
    minScore: 70,
  },
  {
    id: 9,
    category: "最低工资",
    query: "我在深圳打工，老板说包吃住，每月只给1800块工资，这样合法吗？",
    expectedBehavior:
      "告知深圳最低工资标准、包吃住不等于可以低于最低工资。先询问是否全职、每天工作几小时、是否有合同",
    minScore: 70,
  },
  {
    id: 10,
    category: "试用期",
    query: "我在一家公司上班半年了，还是试用期，不给转正也不交社保，这正常吗？",
    expectedBehavior:
      "告知试用期法定期限(最长6个月)、试用期必须交社保。先询问合同约定的试用期长度、是否签了合同",
    minScore: 70,
  },
  {
    id: 11,
    category: "劳务派遣",
    query: "我是派遣工，和正式工干一样的活但工资少一半，这样合理吗？",
    expectedBehavior:
      "告知同工同酬原则。先询问派遣公司名称、用工单位、合同内容、工资差异具体情况",
    minScore: 70,
  },
  {
    id: 12,
    category: "年假",
    query: "我在公司工作两年了，从来没有休过年假，公司也没提过，怎么办？",
    expectedBehavior:
      "告知年假法定天数(1-10年工龄为5天)、未休年假的补偿标准(300%)。先询问是否有申请过年假、公司是否拒绝",
    minScore: 70,
  },
];
