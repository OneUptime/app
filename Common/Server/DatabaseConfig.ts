import GlobalConfigService from "./Services/GlobalConfigService";
import { AccountsRoute, DashboardRoute } from "Common/ServiceRoute";
import Hostname from "Common/Types/API/Hostname";
import Protocol from "Common/Types/API/Protocol";
import URL from "Common/Types/API/URL";
import BadDataException from "Common/Types/Exception/BadDataException";
import { JSONValue } from "Common/Types/JSON";
import ObjectID from "Common/Types/ObjectID";
import GlobalConfig from "Common/Models/DatabaseModels/GlobalConfig";

export default class DatabaseConfig {
  public static async getFromGlobalConfig(key: string): Promise<JSONValue> {
    const globalConfig: GlobalConfig | null =
      await GlobalConfigService.findOneBy({
        query: {
          _id: ObjectID.getZeroObjectID().toString(),
        },
        props: {
          isRoot: true,
        },
        select: {
          [key]: true,
        },
      });

    if (!globalConfig) {
      throw new BadDataException("Global Config not found");
    }

    return globalConfig.getColumnValue(key);
  }

  public static async getHomeUrl(): Promise<URL> {
    const host: Hostname = await DatabaseConfig.getHost();

    const httpProtocol: Protocol = await DatabaseConfig.getHttpProtocol();

    return new URL(httpProtocol, host);
  }

  public static async getHost(): Promise<Hostname> {
    return Promise.resolve(new Hostname(process.env["HOST"] || "localhost"));
  }

  public static async getHttpProtocol(): Promise<Protocol> {
    return Promise.resolve(
      process.env["HTTP_PROTOCOL"] === "https" ? Protocol.HTTPS : Protocol.HTTP,
    );
  }

  public static async getAccountsUrl(): Promise<URL> {
    const host: Hostname = await DatabaseConfig.getHost();
    return new URL(await DatabaseConfig.getHttpProtocol(), host, AccountsRoute);
  }

  public static async getDashboardUrl(): Promise<URL> {
    const host: Hostname = await DatabaseConfig.getHost();
    return new URL(
      await DatabaseConfig.getHttpProtocol(),
      host,
      DashboardRoute,
    );
  }

  public static async shouldDisableSignup(): Promise<boolean> {
    return (await DatabaseConfig.getFromGlobalConfig(
      "disableSignup",
    )) as boolean;
  }
}
