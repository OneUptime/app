import { AppApiHostname } from "../EnvironmentConfig";
import ClusterKeyAuthorization from "../Middleware/ClusterKeyAuthorization";
import BaseService from "./BaseService";
import EmptyResponseData from "../../Types/API/EmptyResponse";
import HTTPResponse from "../../Types/API/HTTPResponse";
import Protocol from "../../Types/API/Protocol";
import Route from "../../Types/API/Route";
import URL from "../../Types/API/URL";
import Email from "../../Types/Email/EmailMessage";
import EmailServer from "../../Types/Email/EmailServer";
import { JSONObject } from "../../Types/JSON";
import ObjectID from "../../Types/ObjectID";
import API from "Common/Utils/API";

export class MailService extends BaseService {
  public async sendMail(
    mail: Email,
    options?: {
      mailServer?: EmailServer | undefined;
      userOnCallLogTimelineId?: ObjectID;
      projectId?: ObjectID | undefined;
    },
  ): Promise<HTTPResponse<EmptyResponseData>> {
    const body: JSONObject = {
      ...mail,
      toEmail: mail.toEmail.toString(),
    };

    if (options && options.mailServer) {
      body["SMTP_ID"] = options.mailServer.id?.toString();
      body["SMTP_USERNAME"] = options.mailServer.username || undefined;
      body["SMTP_EMAIL"] = options.mailServer.fromEmail.toString();
      body["SMTP_FROM_NAME"] = options.mailServer.fromName;
      body["SMTP_IS_SECURE"] = options.mailServer.secure;
      body["SMTP_PORT"] = options.mailServer.port.toNumber();
      body["SMTP_HOST"] = options.mailServer.host.toString();
      body["SMTP_PASSWORD"] = options.mailServer.password || undefined;
    }

    if (options?.userOnCallLogTimelineId) {
      body["userOnCallLogTimelineId"] =
        options.userOnCallLogTimelineId.toString();
    }

    if (options?.projectId) {
      body["projectId"] = options.projectId.toString();
    }

    return await API.post<EmptyResponseData>(
      new URL(
        Protocol.HTTP,
        AppApiHostname,
        new Route("/api/notification/email/send"),
      ),
      body,
      {
        ...ClusterKeyAuthorization.getClusterKeyHeaders(),
      },
    );
  }
}

export default new MailService();
