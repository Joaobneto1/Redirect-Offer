import "dotenv/config";
import app from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();

const server = app.listen(config.PORT, () => {
  console.log(`Redirect Offer listening on http://localhost:${config.PORT}`);
  console.log(`  /go/:slug — link inteligente`);
  console.log(`  /health  — health check`);
});

export { server };

// start auto-checker background job (global poll interval in seconds, env optional)
import { startAutoChecker } from "./services/auto-checker.js";
const GLOBAL_POLL = Number(process.env.AUTO_CHECK_POLL_SEC ?? "15");
startAutoChecker(GLOBAL_POLL);
