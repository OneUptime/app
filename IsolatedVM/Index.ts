import VmAPI from "./API/VM";
import { PromiseVoidFunction } from "Common/Types/FunctionTypes";
import Express, { ExpressApplication } from "Common/Server/Utils/Express";
import logger from "Common/Server/Utils/Logger";
import App from "Common/Server/Utils/StartServer";
import Telemetry from "Common/Server/Utils/Telemetry";
import process from "process";

const APP_NAME: string = "isolated-vm";

const app: ExpressApplication = Express.getExpressApp();

app.use([`/${APP_NAME}`, "/"], VmAPI);

const init: PromiseVoidFunction = async (): Promise<void> => {
  try {
    // Initialize telemetry
    Telemetry.init({
      serviceName: APP_NAME,
    });

    // init the app
    await App.init({
      appName: APP_NAME,
      port: undefined,
      isFrontendApp: false,
      statusOptions: {
        liveCheck: async () => {},
        readyCheck: async () => {},
      },
    });
    logger.debug("App Init Success");

    // add default routes
    await App.addDefaultRoutes();
  } catch (err) {
    logger.error("App Init Failed:");
    logger.error(err);
    throw err;
  }
};

init().catch((err: Error) => {
  logger.error(err);
  logger.error("Exiting node process");
  process.exit(1);
});
