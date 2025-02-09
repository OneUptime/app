import ProbeAuthorization from "../Middleware/ProbeAuthorization";
import Email from "Common/Types/Email";
import EmailTemplateType from "Common/Types/Email/EmailTemplateType";
import BadDataException from "Common/Types/Exception/BadDataException";
import { JSONObject } from "Common/Types/JSON";
import JSONFunctions from "Common/Types/JSONFunctions";
import ObjectID from "Common/Types/ObjectID";
import ProbeApiIngestResponse from "Common/Types/Probe/ProbeApiIngestResponse";
import ProbeMonitorResponse from "Common/Types/Probe/ProbeMonitorResponse";
import ProbeStatusReport from "Common/Types/Probe/ProbeStatusReport";
import GlobalConfigService from "Common/Server/Services/GlobalConfigService";
import MailService from "Common/Server/Services/MailService";
import ProbeService from "Common/Server/Services/ProbeService";
import ProjectService from "Common/Server/Services/ProjectService";
import Express, {
  ExpressRequest,
  ExpressResponse,
  ExpressRouter,
  NextFunction,
} from "Common/Server/Utils/Express";
import logger from "Common/Server/Utils/Logger";
import MonitorResourceUtil from "Common/Server/Utils/Monitor/MonitorResource";
import Response from "Common/Server/Utils/Response";
import GlobalConfig from "Common/Models/DatabaseModels/GlobalConfig";
import Probe from "Common/Models/DatabaseModels/Probe";
import User from "Common/Models/DatabaseModels/User";
import MonitorTestService from "Common/Server/Services/MonitorTestService";
import OneUptimeDate from "Common/Types/Date";

const router: ExpressRouter = Express.getRouter();

router.post(
  "/alive",
  ProbeAuthorization.isAuthorizedServiceMiddleware,
  async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
    // Update last alive in probe and return success response.

    const data: JSONObject = req.body;

    const probeId: ObjectID = new ObjectID(data["probeId"] as string);

    await ProbeService.updateOneById({
      id: probeId,
      data: {
        lastAlive: OneUptimeDate.getCurrentDate(),
      },
      props: {
        isRoot: true,
      },
    });

    return Response.sendEmptySuccessResponse(req, res);
  },
);

router.post(
  "/probe/status-report/offline",
  ProbeAuthorization.isAuthorizedServiceMiddleware,
  async (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data: JSONObject = req.body;

      const statusReport: ProbeStatusReport = JSONFunctions.deserialize(
        (data as JSONObject)["statusReport"] as any,
      ) as any;

      if (!statusReport) {
        return Response.sendErrorResponse(
          req,
          res,
          new BadDataException("StatusReport not found"),
        );
      }

      // process status report here.

      let isWebsiteCheckOffline: boolean = false;
      let isPingCheckOffline: boolean = false;
      let isPortCheckOffline: boolean = false;

      if (statusReport["isWebsiteCheckOffline"]) {
        isWebsiteCheckOffline = statusReport[
          "isWebsiteCheckOffline"
        ] as boolean;
      }

      if (statusReport["isPingCheckOffline"]) {
        isPingCheckOffline = statusReport["isPingCheckOffline"] as boolean;
      }

      if (statusReport["isPortCheckOffline"]) {
        isPortCheckOffline = statusReport["isPortCheckOffline"] as boolean;
      }

      if (isWebsiteCheckOffline || isPingCheckOffline || isPortCheckOffline) {
        // email probe owner.
        const probeId: ObjectID = new ObjectID(data["probeId"] as string);

        const probe: Probe | null = await ProbeService.findOneBy({
          query: {
            _id: probeId.toString(),
          },
          select: {
            _id: true,
            projectId: true,
            name: true,
            description: true,
          },
          props: {
            isRoot: true,
          },
        });

        if (!probe) {
          return Response.sendErrorResponse(
            req,
            res,
            new BadDataException("Invalid Probe ID or Probe Key"),
          );
        }

        // If global probe offline? If yes, then email master-admin.
        // If not a global probe then them email project owners.

        const isGlobalProbe: boolean = !probe.projectId;
        const emailsToNotify: Email[] = [];

        let emailReason: string = "";

        if (isGlobalProbe) {
          // email master-admin

          const globalConfig: GlobalConfig | null =
            await GlobalConfigService.findOneBy({
              query: {},
              select: {
                _id: true,
                adminNotificationEmail: true,
              },
              props: {
                isRoot: true,
              },
            });

          if (!globalConfig) {
            return Response.sendErrorResponse(
              req,
              res,
              new BadDataException("Global config not found"),
            );
          }

          const adminNotificationEmail: Email | undefined =
            globalConfig.adminNotificationEmail;

          if (adminNotificationEmail) {
            // email adminNotificationEmail
            emailsToNotify.push(adminNotificationEmail);

            emailReason =
              "This email is sent to you becuse you have listed this email as a notification email in the Admin Dashobard. To change this email, please visit the Admin Dashboard > Settings > Email.";
          }
        } else {
          if (!probe.projectId) {
            return Response.sendErrorResponse(
              req,
              res,
              new BadDataException("Invalid Project ID"),
            );
          }

          // email project owners.
          const owners: Array<User> = await ProjectService.getOwners(
            probe.projectId!,
          );

          for (const owner of owners) {
            if (owner.email) {
              emailsToNotify.push(owner.email);
            }
          }

          emailReason =
            "This email is sent to you because you are listed as an owner of the project that this probe is associated with. To change this email, please visit the Project Dashboard > Settings > Teams and Members > Owners.";
        }

        let issue: string = "";

        if (isWebsiteCheckOffline) {
          issue += "This probe cannot reach out to monitor websites.";
        }

        if (isPingCheckOffline) {
          issue +=
            " This probe cannot reach out to ping other servers / hostnames or IP addresses. ";
        }

        if (!isWebsiteCheckOffline && isPingCheckOffline) {
          issue +=
            "Looks like ICMP is blocked. We will fallback to port monitoring (on default port 80) to monitor the uptime of resources.";
        }

        if (isPortCheckOffline) {
          issue += " This probe cannot reach out to monitor ports.";
        }

        // now send an email to all the emailsToNotify
        for (const email of emailsToNotify) {
          MailService.sendMail(
            {
              toEmail: email,
              templateType: EmailTemplateType.ProbeOffline,
              subject: "ACTION REQUIRED: Probe Offline Notification",
              vars: {
                probeName: probe.name || "",
                probeDescription: probe.description || "",
                projectId: probe.projectId?.toString() || "",
                probeId: probe.id?.toString() || "",
                hostname: statusReport["hostname"]?.toString() || "",
                emailReason: emailReason,
                issue: issue,
              },
            },
            {
              projectId: probe.projectId,
            },
          ).catch((err: Error) => {
            logger.error(err);
          });
        }
      }

      return Response.sendJsonObjectResponse(req, res, {
        message: "Status Report received",
      });
    } catch (err) {
      return next(err);
    }
  },
);

router.post(
  "/probe/response/ingest",
  ProbeAuthorization.isAuthorizedServiceMiddleware,
  async (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const probeResponse: ProbeMonitorResponse = JSONFunctions.deserialize(
        req.body["probeMonitorResponse"],
      ) as any;

      if (!probeResponse) {
        return Response.sendErrorResponse(
          req,
          res,
          new BadDataException("ProbeMonitorResponse not found"),
        );
      }

      // process probe response here.
      const probeApiIngestResponse: ProbeApiIngestResponse =
        await MonitorResourceUtil.monitorResource(probeResponse);

      return Response.sendJsonObjectResponse(req, res, {
        probeApiIngestResponse: probeApiIngestResponse,
      } as any);
    } catch (err) {
      return next(err);
    }
  },
);

router.post(
  "/probe/response/monitor-test-ingest/:testId",
  ProbeAuthorization.isAuthorizedServiceMiddleware,
  async (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const probeResponse: ProbeMonitorResponse = JSONFunctions.deserialize(
        req.body["probeMonitorResponse"],
      ) as any;

      const testId: ObjectID = new ObjectID(req.params["testId"] as string);

      if (!testId) {
        return Response.sendErrorResponse(
          req,
          res,
          new BadDataException("TestId not found"),
        );
      }

      if (!probeResponse) {
        return Response.sendErrorResponse(
          req,
          res,
          new BadDataException("ProbeMonitorResponse not found"),
        );
      }

      // save the probe response to the monitor test.

      await MonitorTestService.updateOneById({
        id: testId,
        data: {
          monitorStepProbeResponse: {
            [probeResponse.monitorStepId.toString()]: {
              ...JSON.parse(JSON.stringify(probeResponse)),
              monitoredAt: OneUptimeDate.getCurrentDate(),
            },
          } as any,
        },
        props: {
          isRoot: true,
        },
      });

      // send success response.

      return Response.sendEmptySuccessResponse(req, res);
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
