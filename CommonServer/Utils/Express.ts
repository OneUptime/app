import express from 'express';
import logger from './Logger';
import { JSONObjectOrArray } from 'Common/Types/JSON';
import ObjectID from 'Common/Types/ObjectID';

export type RequestHandler = express.RequestHandler;
export type NextFunction = express.NextFunction;

export const ExpressStatic: Function = express.static;
export const ExpressJson: Function = express.json;
export const ExpressUrlEncoded: Function = express.urlencoded;

export type ProbeRequest = {
    id: ObjectID;
};

export type ExpressRequest = express.Request;
export type ExpressResponse = express.Response;
export type ExpressApplication = express.Application;
export type ExpressRouter = express.Router;

export interface OneUptimeRequest extends express.Request {
    probe?: ProbeRequest;
    id: ObjectID;
    requestStartedAt: Date;
    requestEndedAt: Date;
}

export interface OneUptimeResponse extends express.Response {
    logBody: JSONObjectOrArray;
}

class Express {
    private static app: express.Application;

    public static getRouter(): express.Router {
        return express.Router();
    }

    public static setupExpress(): void {
        this.app = express();
    }

    public static getExpressApp(): express.Application {
        if (!this.app) {
            this.setupExpress();
        }

        return this.app;
    }

    public static launchApplication(): express.Application {
        if (!this.app) {
            this.setupExpress();
        }

        this.app.listen(this.app.get('port'), () => {
            // eslint-disable-next-line
            logger.info(`Server started on port: ${this.app.get('port')}`);
        });

        return this.app;
    }
}

export default Express;
