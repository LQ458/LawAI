// Legal Document Classification Guide
// 法律文档分类指南 - 用于标记文档的敏感级别和所属部门

import { toFgaUserObject } from "./fgaIdentity";

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

function syntheticDemoMetadata(documentId: string) {
  return {
    documentId,
    fgaObjectId: documentId,
    source: "LawAI access-control demo",
    sourceKind: "synthetic" as const,
    sourceUrl: `synthetic://lawai/access-control-demo/${documentId}`,
    version: "demo-v1",
    needsReview: false,
    syntheticMetric: true,
  };
}

export const DEMO_DOCUMENTS = [
  {
    id: "doc-salary-q4-2025",
    ...syntheticDemoMetadata("doc-salary-q4-2025"),
    title: "2025年Q4薪资调整方案",
    visibility: "restricted",
    sensitivity: DOCUMENT_SENSITIVITY.CONFIDENTIAL,
    department: DOCUMENT_DEPARTMENTS.HR,
  },
  {
    id: "doc-budget-q4-2025",
    ...syntheticDemoMetadata("doc-budget-q4-2025"),
    title: "2025年Q4财务预算报告",
    visibility: "restricted",
    sensitivity: DOCUMENT_SENSITIVITY.CONFIDENTIAL,
    department: DOCUMENT_DEPARTMENTS.FINANCE,
  },
  {
    id: "doc-labor-law-basics",
    ...syntheticDemoMetadata("doc-labor-law-basics"),
    title: "劳动法基础知识 - 员工权益保护",
    visibility: "public",
    sensitivity: DOCUMENT_SENSITIVITY.PUBLIC,
    department: DOCUMENT_DEPARTMENTS.LEGAL,
  },
  {
    id: "doc-overtime-policy",
    ...syntheticDemoMetadata("doc-overtime-policy"),
    title: "加班政策与补偿标准",
    visibility: "restricted",
    sensitivity: DOCUMENT_SENSITIVITY.INTERNAL,
    department: DOCUMENT_DEPARTMENTS.HR,
  },
  {
    id: "doc-wage-dispute-guide",
    ...syntheticDemoMetadata("doc-wage-dispute-guide"),
    title: "工资争议处理指南",
    visibility: "public",
    sensitivity: DOCUMENT_SENSITIVITY.PUBLIC,
    department: DOCUMENT_DEPARTMENTS.LEGAL,
  },
  {
    id: "doc-engineering-standards",
    ...syntheticDemoMetadata("doc-engineering-standards"),
    title: "工程开发规范 V3.0",
    visibility: "restricted",
    sensitivity: DOCUMENT_SENSITIVITY.INTERNAL,
    department: DOCUMENT_DEPARTMENTS.ENGINEERING,
  },
  {
    id: "doc-severance-policy",
    ...syntheticDemoMetadata("doc-severance-policy"),
    title: "员工离职补偿标准",
    visibility: "restricted",
    sensitivity: DOCUMENT_SENSITIVITY.CONFIDENTIAL,
    department: DOCUMENT_DEPARTMENTS.HR,
  },
  {
    id: "doc-merger-plan",
    ...syntheticDemoMetadata("doc-merger-plan"),
    title: "公司合并方案草案",
    visibility: "restricted",
    sensitivity: DOCUMENT_SENSITIVITY.RESTRICTED,
    department: DOCUMENT_DEPARTMENTS.LEGAL,
  },
] as const;

export const DEMO_USERS = [
  {
    id: "manager-placeholder",
    name: "Demo Manager (placeholder)",
    role: "manager",
    departments: ["hr"],
  },
  {
    id: "employee-placeholder",
    name: "Demo Employee (placeholder)",
    role: "employee",
    departments: ["engineering"],
  },
  {
    id: "legal-finance-placeholder",
    name: "Demo Legal/Finance User (placeholder)",
    role: "manager",
    departments: ["legal", "finance"],
  },
] as const;

const RESTRICTED_DEMO_DOCUMENT_TUPLES = [
  {
    user: "department:hr#member",
    relation: "viewer",
    object: "document:doc-salary-q4-2025",
  },
  {
    user: "department:hr#member",
    relation: "viewer",
    object: "document:doc-overtime-policy",
  },
  {
    user: "department:hr#member",
    relation: "viewer",
    object: "document:doc-severance-policy",
  },
  {
    user: "department:finance#member",
    relation: "viewer",
    object: "document:doc-budget-q4-2025",
  },
  {
    user: "department:engineering#member",
    relation: "viewer",
    object: "document:doc-engineering-standards",
  },
  {
    user: "department:legal#member",
    relation: "viewer",
    object: "document:doc-merger-plan",
  },
] as const;

export interface DemoAuth0Subjects {
  managerSubject: string;
  employeeSubject: string;
  legalFinanceSubject?: string;
}

export function buildDemoFgaTuples(subjects: DemoAuth0Subjects) {
  const membershipTuples = [
    {
      user: toFgaUserObject(subjects.managerSubject),
      relation: "member",
      object: "department:hr",
    },
    {
      user: toFgaUserObject(subjects.employeeSubject),
      relation: "member",
      object: "department:engineering",
    },
  ];

  if (subjects.legalFinanceSubject) {
    const legalFinanceUser = toFgaUserObject(subjects.legalFinanceSubject);
    membershipTuples.push(
      {
        user: legalFinanceUser,
        relation: "member",
        object: "department:legal",
      },
      {
        user: legalFinanceUser,
        relation: "member",
        object: "department:finance",
      },
    );
  }

  return [...membershipTuples, ...RESTRICTED_DEMO_DOCUMENT_TUPLES];
}

export const RESTRICTED_DEMO_DOCUMENT_TUPLE_COUNT =
  RESTRICTED_DEMO_DOCUMENT_TUPLES.length;
