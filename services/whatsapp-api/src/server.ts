import { getServerAddress } from "./config.js";
import { buildApp } from "./app.js";

const app = buildApp();
const address = getServerAddress();

try {
  await app.listen(address);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
