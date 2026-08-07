import { loadConfig } from "./config/env";
import { createServer } from "./server";
import { startGatewayReporting } from "./services/gatewayClient";

const config = loadConfig();
const { app, cache } = createServer(config);

app.listen(config.port, () => {
  console.log(
    `[cdn-engine] node=${config.nodeId} region=${config.region} listening on :${config.port} — uploads at ${config.uploadsDir}`
  );
  startGatewayReporting(cache, config);
});
