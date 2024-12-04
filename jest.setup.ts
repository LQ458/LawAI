// 测试环境配置
import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// 使用类型断言解决类型不兼容问题
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock PrimeReact CSS
jest.mock("primereact/resources/themes/saga-blue/theme.css", () => ({}));
jest.mock("primereact/resources/primereact.min.css", () => ({}));
jest.mock("primeicons/primeicons.css", () => ({}));

// Mock style-loader
jest.mock(
  "style-loader!css-loader!primereact/resources/themes/saga-blue/theme.css",
  () => ({}),
);
jest.mock(
  "style-loader!css-loader!primereact/resources/primereact.min.css",
  () => ({}),
);
jest.mock("style-loader!css-loader!primeicons/primeicons.css", () => ({}));

// Suppress CSS parsing errors
const originalError = console.error;
console.error = function (message: unknown, ...args: unknown[]) {
  if (
    typeof message === "string" &&
    message.includes("Could not parse CSS stylesheet")
  ) {
    return;
  }
  if (
    typeof message === "string" &&
    message.includes("Error: Could not parse CSS stylesheet")
  ) {
    return;
  }
  originalError.call(console, message, ...args);
};
