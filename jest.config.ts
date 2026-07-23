import type { Config } from "jest";
import nextJest from "next/jest";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig: Config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  testMatch: [
    "<rootDir>/__tests__/**/*.(spec|test).[jt]s",
    "<rootDir>/__tests__/**/*.(spec|test).[jt]sx",
  ],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/e2e/"],
  clearMocks: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^server-only$": "<rootDir>/__tests__/mocks/server-only.ts",
  },
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
  ],
};

export default createJestConfig(customJestConfig);
