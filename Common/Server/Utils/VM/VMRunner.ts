import Dictionary from "Common/Types/Dictionary";
import GenericObject from "Common/Types/GenericObject";
import ReturnResult from "Common/Types/IsolatedVM/ReturnResult";
import { JSONObject, JSONValue } from "Common/Types/JSON";
import axios from "axios";
import http from "http";
import https from "https";
import vm, { Context } from "node:vm";

export default class VMRunner {
  public static async runCodeInSandbox(data: {
    code: string;
    options: {
      timeout?: number;
      args?: JSONObject | undefined;
      context?: Dictionary<GenericObject> | undefined;
    };
  }): Promise<ReturnResult> {
    const { code, options } = data;

    const logMessages: string[] = [];

    let sandbox: Context = {
      console: {
        log: (...args: JSONValue[]) => {
          logMessages.push(args.join(" "));
        },
      },
      http: http,
      https: https,
      axios: axios,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      ...options.context,
    };

    if (options.args) {
      sandbox = {
        ...sandbox,
        args: options.args,
      };
    }

    vm.createContext(sandbox); // Contextify the object.

    const script: string =
      `(async()=>{
            ${code}
        })()` || "";

    const returnVal: any = await vm.runInContext(script, sandbox, {
      timeout: options.timeout || 5000,
    }); // run the script

    return {
      returnValue: returnVal,
      logMessages,
    };
  }
}
