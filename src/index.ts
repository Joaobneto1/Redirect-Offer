import app from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();

const server = app.listen(config.PORT, () => {
  console.log(`Redirect Offer listening on http://localhost:${config.PORT}`);
  console.log(`  /go/:slug — link inteligente`);
  console.log(`  /health  — health check`);
});

export { server };
