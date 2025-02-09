import logger from "./Logger";
import Dictionary from "Common/Types/Dictionary";
import GenericFunction from "Common/Types/GenericFunction";
import { JSONObject, JSONObjectOrArray } from "Common/Types/JSON";
import JSONWebTokenData from "Common/Types/JsonWebTokenData";
import ObjectID from "Common/Types/ObjectID";
import {
  UserGlobalAccessPermission,
  UserTenantAccessPermission,
} from "Common/Types/Permission";
import Port from "Common/Types/Port";
import UserType from "Common/Types/UserType";
import "ejs";
import express from "express";
import { Server, createServer } from "http";

export type RequestHandler = express.RequestHandler;
export type NextFunction = express.NextFunction;

export const ExpressStatic: GenericFunction = express.static;
export const ExpressJson: GenericFunction = express.json;
export const ExpressUrlEncoded: GenericFunction = express.urlencoded;

export type ProbeRequest = {
  id: ObjectID;
};

export type ExpressRequest = express.Request;
export type ExpressResponse = express.Response;
export type ExpressApplication = express.Application;
export type ExpressRouter = express.Router;

export interface OneUptimeRequest extends express.Request {
  bearerTokenData?: JSONObject | string | undefined; //  if bearer token is passed then this is populated.
  probe?: ProbeRequest;
  userType?: UserType;
  userAuthorization?: JSONWebTokenData;
  tenantId?: ObjectID;
  userGlobalAccessPermission?: UserGlobalAccessPermission;
  userTenantAccessPermission?: Dictionary<UserTenantAccessPermission>; // tenantId <-> UserTenantAccessPermission;
  rawBody?: string; // raw body of the request before json parsing.
}

export interface OneUptimeResponse extends express.Response {
  logBody: JSONObjectOrArray;
}

class Express {
  private static app: express.Application;
  private static httpServer: Server;

  public static getRouter(): express.Router {
    return express.Router();
  }

  public static setupExpress(): void {
    this.app = express();
  }

  public static getHttpServer(): Server {
    return this.httpServer;
  }

  public static getExpressApp(): express.Application {
    if (!this.app) {
      this.setupExpress();
    }

    return this.app;
  }

  public static async launchApplication(
    appName: string,
    port?: Port,
  ): Promise<express.Application> {
    if (!this.app) {
      this.setupExpress();
    }

    if (!this.httpServer) {
      this.httpServer = createServer(this.app);
    }

    type ResolveFunction = (app: express.Application) => void;

    return new Promise<express.Application>((resolve: ResolveFunction) => {
      this.httpServer.listen(port?.toNumber() || this.app.get("port"), () => {
        logger.debug(
          `${appName} server started on port: ${port?.toNumber() || this.app.get("port")}`,
        );
        return resolve(this.app);
      });
    });
  }
}

export default Express;
