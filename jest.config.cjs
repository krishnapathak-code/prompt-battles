module.exports = {
	testEnvironment: "jsdom",
	transform: {
		"^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
	},
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
	collectCoverage: true,
	collectCoverageFrom: [
		"**/*.{ts,tsx,js,jsx}", // include all source files anywhere
		"!**/*.d.ts", // exclude type definitions
		"!**/__tests__/**", // exclude test files
		"!**/node_modules/**", // exclude dependencies
		"!.next/**", // exclude Next.js build output
		"!coverage/**", // exclude coverage reports
		"!dist/**", // exclude build output if you ever create dist/
	],


  coverageDirectory: "coverage",
	coverageThreshold: {
		global: {
			branches: 0,
			functions: 0,
			lines: 0,
			statements: 0,
		},
	},
	// Optional: show verbose test results for CI logs
	verbose: true,
};
