// Legal Document Classification Guide
// 法律文档分类指南 - 用于标记文档的敏感级别和所属部门

export const DOCUMENT_SENSITIVITY = {
  PUBLIC: "public",
  INTERNAL: "internal",
  CONFIDENTIAL: "confidential",
  RESTRICTED: "restricted",
} as const;

export const DOCUMENT_DEPARTMENTS = {
  HR: "hr",
  LEGAL: "legal",
  FINANCE: "finance",
  ENGINEERING: "engineering",
  GENERAL: "general",
} as const;

export const DEMO_DOCUMENTS = [
  {
    id: "doc-salary-q4-2025",
    title: "2025年Q4薪资调整方案",
    sensitivity: DOCUMENT_SENSITIVITY.CONFIDENTIAL,
    department: DOCUMENT_DEPARTMENTS.HR,
  },
  {
    id: "doc-budget-q4-2025",
    title: "2025年Q4财务预算报告",
    sensitivity: DOCUMENT_SENSITIVITY.CONFIDENTIAL,
    department: DOCUMENT_DEPARTMENTS.FINANCE,
  },
  {
    id: "doc-labor-law-basics",
    title: "劳动法基础知识 - 员工权益保护",
    sensitivity: DOCUMENT_SENSITIVITY.PUBLIC,
    department: DOCUMENT_DEPARTMENTS.LEGAL,
  },
  {
    id: "doc-overtime-policy",
    title: "加班政策与补偿标准",
    sensitivity: DOCUMENT_SENSITIVITY.INTERNAL,
    department: DOCUMENT_DEPARTMENTS.HR,
  },
  {
    id: "doc-wage-dispute-guide",
    title: "工资争议处理指南",
    sensitivity: DOCUMENT_SENSITIVITY.PUBLIC,
    department: DOCUMENT_DEPARTMENTS.LEGAL,
  },
  {
    id: "doc-engineering-standards",
    title: "工程开发规范 V3.0",
    sensitivity: DOCUMENT_SENSITIVITY.INTERNAL,
    department: DOCUMENT_DEPARTMENTS.ENGINEERING,
  },
  {
    id: "doc-severance-policy",
    title: "员工离职补偿标准",
    sensitivity: DOCUMENT_SENSITIVITY.CONFIDENTIAL,
    department: DOCUMENT_DEPARTMENTS.HR,
  },
  {
    id: "doc-merger-plan",
    title: "公司合并方案草案",
    sensitivity: DOCUMENT_SENSITIVITY.RESTRICTED,
    department: DOCUMENT_DEPARTMENTS.LEGAL,
  },
] as const;

export const DEMO_USERS = [
  {
    id: "alice",
    name: "Alice Wang",
    role: "manager",
    departments: ["hr"],
  },
  {
    id: "bob",
    name: "Bob Li",
    role: "employee",
    departments: ["engineering"],
  },
  {
    id: "charlie",
    name: "Charlie Chen",
    role: "manager",
    departments: ["legal", "finance"],
  },
] as const;

export const DEMO_FGA_TUPLES = [
  { user: "user:alice", relation: "member", object: "department:hr" },
  { user: "user:bob", relation: "member", object: "department:engineering" },
  { user: "user:charlie", relation: "member", object: "department:legal" },
  { user: "user:charlie", relation: "member", object: "department:finance" },

  { user: "department:hr#member", relation: "viewer", object: "document:doc-salary-q4-2025" },
  { user: "department:hr#member", relation: "viewer", object: "document:doc-overtime-policy" },
  { user: "department:hr#member", relation: "viewer", object: "document:doc-severance-policy" },
  { user: "department:finance#member", relation: "viewer", object: "document:doc-budget-q4-2025" },
  { user: "department:engineering#member", relation: "viewer", object: "document:doc-engineering-standards" },
  { user: "department:legal#member", relation: "viewer", object: "document:doc-labor-law-basics" },
  { user: "department:legal#member", relation: "viewer", object: "document:doc-wage-dispute-guide" },
  { user: "department:legal#member", relation: "viewer", object: "document:doc-merger-plan" },

  { user: "user:*", relation: "viewer", object: "document:doc-labor-law-basics" },
  { user: "user:*", relation: "viewer", object: "document:doc-wage-dispute-guide" },
] as const;
