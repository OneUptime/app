// Connect common api's.
import CommonAPI from "../API/Index";
import { StatusAPIOptions } from "../API/StatusAPI";
import { AppVersion } from "../EnvironmentConfig";
import LocalCache from "../Infrastructure/LocalCache";
import "./Environment";
import Express, {
  ExpressApplication,
  ExpressJson,
  ExpressRequest,
  ExpressResponse,
  ExpressStatic,
  ExpressUrlEncoded,
  NextFunction,
  OneUptimeRequest,
  RequestHandler,
} from "./Express";
import logger from "./Logger";
import "./Process";
import Response from "./Response";
import { api } from "@opentelemetry/sdk-node";
import StatusCode from "Common/Types/API/StatusCode";
import Exception from "Common/Types/Exception/Exception";
import NotFoundException from "Common/Types/Exception/NotFoundException";
import ServerException from "Common/Types/Exception/ServerException";
import { PromiseVoidFunction } from "Common/Types/FunctionTypes";
import { JSONObject } from "Common/Types/JSON";
import JSONFunctions from "Common/Types/JSONFunctions";
import Port from "Common/Types/Port";
import Typeof from "Common/Types/Typeof";
import CookieParser from "cookie-parser";
import cors from "cors";
import zlib from "zlib";

// Make sure we have stack trace for debugging.
Error.stackTraceLimit = Infinity;

const app: ExpressApplication = Express.getExpressApp();

app.disable("x-powered-by");
app.set("port", process.env["PORT"]);
app.set("view engine", "ejs");
app.use(CookieParser());

const jsonBodyParserMiddleware: RequestHandler = ExpressJson({
  limit: "50mb",
  extended: true,
}); // 50 MB limit.

const urlEncodedMiddleware: RequestHandler = ExpressUrlEncoded({
  limit: "50mb",
  extended: true,
}); // 50 MB limit.

const setDefaultHeaders: RequestHandler = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction,
): void => {
  if (typeof req.body === Typeof.String) {
    req.body = JSONFunctions.parse(req.body);
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization, DNT, X-CustomHeader, Keep-Alive, User-Agent, If-Modified-Since, Cache-Control, Content-Type",
  );

  next();
};

app.use(cors());
app.use(setDefaultHeaders);

// Set the view engine to ejs
app.set("view engine", "ejs");

/*
 * Add limit of 10 MB to avoid "Request Entity too large error"
 * https://stackoverflow.com/questions/19917401/error-request-entity-too-large
 */

app.use((req: OneUptimeRequest, res: ExpressResponse, next: NextFunction) => {
  if (req.headers["content-encoding"] === "gzip") {
    const buffers: any = [];

    req.on("data", (chunk: any) => {
      buffers.push(chunk);
    });

    req.on("end", () => {
      const buffer: Buffer = Buffer.concat(buffers);
      zlib.gunzip(buffer, (err: unknown, decoded: Buffer) => {
        if (err) {
          logger.error(err);
          return Response.sendErrorResponse(
            req,
            res,
            new ServerException("Error decompressing data"),
          );
        }

        req.body = decoded;

        next();
      });
    });
  } else {
    jsonBodyParserMiddleware(req, res, next);
  }
});

app.use((req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
  if (req.headers["content-encoding"] === "gzip") {
    next();
  } else {
    urlEncodedMiddleware(req, res, next);
  }
});

app.use((_req: ExpressRequest, _res: ExpressResponse, next: NextFunction) => {
  // set span status code to OK by default. If the error occurs, it will be updated in the error handler.
  const span: api.Span | undefined = api.trace.getSpan(api.context.active());
  if (span) {
    span.setStatus({ code: api.SpanStatusCode.OK });
  }

  next();
});

export interface InitFuctionOptions {
  appName: string;
  port?: Port | undefined;
  isFrontendApp?: boolean;
  statusOptions: StatusAPIOptions;
}

type InitFunction = (
  options: InitFuctionOptions,
) => Promise<ExpressApplication>;

const init: InitFunction = async (
  data: InitFuctionOptions,
): Promise<ExpressApplication> => {
  const { appName, port, isFrontendApp = false } = data;

  logger.info(`App Version: ${AppVersion.toString()}`);

  await Express.launchApplication(appName, port);
  LocalCache.setString("app", "name", appName);

  CommonAPI({
    appName,
    statusOptions: data.statusOptions,
  });

  if (isFrontendApp) {
    app.use(ExpressStatic("/usr/src/app/public"));

    app.get(
      [`/${appName}/env.js`, "/env.js"],
      async (req: ExpressRequest, res: ExpressResponse) => {
        // ping api server for database config.

        const env: JSONObject = {
          ...process.env,
        };

        const script: string = `
    if(!window.process){
      window.process = {}
    }

    if(!window.process.env){
      window.process.env = {}
    }
    const envVars = '${JSON.stringify(env)}';
    window.process.env = JSON.parse(envVars);
  `;

        Response.sendJavaScriptResponse(req, res, script);
      },
    );

    app.use(`/${appName}`, ExpressStatic("/usr/src/app/public"));

    app.get(
      `/${appName}/dist/bundle.js`,
      (_req: ExpressRequest, res: ExpressResponse) => {
        res.sendFile("/usr/src/app/public/dist/bundle.js");
      },
    );

    app.get("/*", (_req: ExpressRequest, res: ExpressResponse) => {
      res.sendFile("/usr/src/app/public/index.html");
    });
  }

  return app;
};

const addDefaultRoutes: PromiseVoidFunction = async (): Promise<void> => {
  app.post("*", (req: ExpressRequest, res: ExpressResponse) => {
    return Response.sendErrorResponse(
      req,
      res,
      new NotFoundException(`Page not found - ${req.url}`),
    );
  });

  app.put("*", (req: ExpressRequest, res: ExpressResponse) => {
    return Response.sendErrorResponse(
      req,
      res,
      new NotFoundException(`Page not found - ${req.url}`),
    );
  });

  app.delete("*", (req: ExpressRequest, res: ExpressResponse) => {
    return Response.sendErrorResponse(
      req,
      res,
      new NotFoundException(`Page not found - ${req.url}`),
    );
  });

  app.get("*", (req: ExpressRequest, res: ExpressResponse) => {
    return Response.sendErrorResponse(
      req,
      res,
      new NotFoundException(`Page not found - ${req.url}`),
    );
  });

  // Attach Error Handler.
  app.use(
    (
      err: Error | Exception,
      _req: ExpressRequest,
      res: ExpressResponse,
      next: NextFunction,
    ) => {
      logger.error(err);

      // Mark span as error.
      if (err) {
        const span: api.Span | undefined = api.trace.getSpan(
          api.context.active(),
        );
        if (span) {
          // record exception
          span.recordException(err);

          // set span status code to ERROR
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: err.message,
          });
        }
      }

      if (res.headersSent) {
        return next(err);
      }

      if (err instanceof Promise) {
        err.catch((exception: Exception) => {
          if (StatusCode.isValidStatusCode((exception as Exception).code)) {
            res.status((exception as Exception).code);
            res.send({ error: (exception as Exception).message });
          } else {
            res.status(500);
            res.send({ error: "Server Error" });
          }
        });
      } else if (err instanceof Exception) {
        res.status((err as Exception).code);
        res.send({ error: (err as Exception).message });
      } else {
        res.status(500);
        res.send({ error: "Server Error" });
      }
    },
  );
};

export default { init, addDefaultRoutes };
