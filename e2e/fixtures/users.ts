export interface DemoUser {
  id: string;
  name: string;
  role: "manager" | "employee";
  departments: string[];
}

export const DEMO_USERS: DemoUser[] = [
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
];
