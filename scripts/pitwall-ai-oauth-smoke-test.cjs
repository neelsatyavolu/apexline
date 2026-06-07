const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainProcess = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");
const settings = fs.readFileSync(path.join(root, "ui_kits/pitwall/Settings.jsx"), "utf8");
const dataProvider = fs.readFileSync(path.join(root, "ui_kits/pitwall/DataProvider.jsx"), "utf8");
const copilot = fs.readFileSync(path.join(root, "ui_kits/pitwall/Copilot.jsx"), "utf8");
const liveRacing = fs.readFileSync(path.join(root, "ui_kits/pitwall/LiveRacing.jsx"), "utf8");

assert.match(mainProcess, /app_EMoamEEZ73f0CkXaXp7hrann/, "Codex OAuth should use the Codex CLI client id");
assert.match(mainProcess, /https:\/\/auth\.openai\.com\/oauth\/authorize/, "Codex OAuth should build an OpenAI authorize URL");
assert.match(mainProcess, /https:\/\/chatgpt\.com\/backend-api\/codex\/responses/, "Codex OAuth should call the ChatGPT Codex backend");
assert.match(mainProcess, /b1a00492-073a-47ea-816f-4c329264a828/, "Grok OAuth should use the Grok Build client id");
assert.match(mainProcess, /https:\/\/auth\.x\.ai\/oauth2\/authorize/, "Grok OAuth should build an xAI authorize URL");
assert.match(mainProcess, /https:\/\/api\.x\.ai\/v1\/chat\/completions/, "Grok OAuth should call the xAI chat completions API");
assert.match(mainProcess, /"codex"/, "Codex OAuth session should be an allowed local provider");
assert.match(mainProcess, /"grok"/, "Grok OAuth session should be an allowed local provider");
assert.match(mainProcess, /pitwall:ai:authStatus/, "Electron main should expose AI OAuth status IPC");
assert.match(mainProcess, /pitwall:ai:authStart/, "Electron main should expose AI OAuth start IPC");
assert.match(mainProcess, /pitwall:ai:authDisconnect/, "Electron main should expose AI OAuth disconnect IPC");
assert.match(mainProcess, /preferred === "codex"/, "AI router should honor Codex as a preferred provider");
assert.match(mainProcess, /preferred === "grok"/, "AI router should honor Grok as a preferred provider");
assert.match(mainProcess, /gpt-5\.4-mini/, "AI model list should include GPT 5.4 mini");
assert.match(mainProcess, /requestCodexResponsesStream/, "Codex OAuth should use the streaming Codex responses contract");
assert.match(mainProcess, /instructions:\s*AI_SYSTEM_PROMPT/, "Codex OAuth should send system guidance as top-level instructions");
assert.match(mainProcess, /stream:\s*true/, "Codex OAuth should request the required streaming response");

assert.match(preload, /authStatus/, "Preload should expose AI OAuth status");
assert.match(preload, /authStart/, "Preload should expose AI OAuth start");
assert.match(preload, /authDisconnect/, "Preload should expose AI OAuth disconnect");

assert.match(settings, /ChatGPT \(Codex\)/, "Settings should offer ChatGPT/Codex OAuth");
assert.match(settings, /Grok/, "Settings should offer Grok OAuth");
assert.match(settings, /function ProviderLogo/, "Settings should render brand provider logos");
assert.match(settings, /M9\.205 8\.658/, "Settings should include the ChatGPT\/OpenAI logo path");
assert.match(settings, /M13\.827 3\.52h3\.603/, "Settings should include the Anthropic logo path");
assert.match(settings, /m557\.09 211\.99 8\.31 326\.37/, "Settings should include the xAI\/Grok logo path");
assert.match(settings, /OpenAI fallback/, "Settings should show OpenAI as an icon-backed fallback provider");
assert.match(settings, /GPT-5\.4 mini/, "Settings should show GPT 5.4 mini as a model option");
assert.match(settings, /pw-ai-model/, "Settings should persist the preferred AI model");
assert.match(dataProvider, /authStatus/, "Connection status should include OAuth sessions");
assert.match(copilot, /aiRequestOptions/, "Copilot should send the selected AI provider/model");
assert.match(liveRacing, /aiRequestOptions/, "Live Racing chat should send the selected AI provider/model");

console.log("PitWall AI OAuth smoke checks passed");
