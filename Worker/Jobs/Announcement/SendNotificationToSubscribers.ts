import RunCron from "../../Utils/Cron";
import { FileRoute } from "Common/ServiceRoute";
import Hostname from "Common/Types/API/Hostname";
import Protocol from "Common/Types/API/Protocol";
import URL from "Common/Types/API/URL";
import LIMIT_MAX from "Common/Types/Database/LimitMax";
import OneUptimeDate from "Common/Types/Date";
import EmailTemplateType from "Common/Types/Email/EmailTemplateType";
import SMS from "Common/Types/SMS/SMS";
import { EVERY_MINUTE } from "Common/Utils/CronTime";
import DatabaseConfig from "Common/Server/DatabaseConfig";
import MailService from "Common/Server/Services/MailService";
import ProjectCallSMSConfigService from "Common/Server/Services/ProjectCallSMSConfigService";
import ProjectSMTPConfigService from "Common/Server/Services/ProjectSmtpConfigService";
import SmsService from "Common/Server/Services/SmsService";
import StatusPageAnnouncementService from "Common/Server/Services/StatusPageAnnouncementService";
import StatusPageService from "Common/Server/Services/StatusPageService";
import StatusPageSubscriberService from "Common/Server/Services/StatusPageSubscriberService";
import QueryHelper from "Common/Server/Types/Database/QueryHelper";
import Markdown, { MarkdownContentType } from "Common/Server/Types/Markdown";
import logger from "Common/Server/Utils/Logger";
import StatusPage from "Common/Models/DatabaseModels/StatusPage";
import StatusPageAnnouncement from "Common/Models/DatabaseModels/StatusPageAnnouncement";
import StatusPageSubscriber from "Common/Models/DatabaseModels/StatusPageSubscriber";
import StatusPageEventType from "Common/Types/StatusPage/StatusPageEventType";

RunCron(
  "Announcement:SendNotificationToSubscribers",
  { schedule: EVERY_MINUTE, runOnStartup: false },
  async () => {
    // get all scheduled events of all the projects.
    const announcements: Array<StatusPageAnnouncement> =
      await StatusPageAnnouncementService.findBy({
        query: {
          isStatusPageSubscribersNotified: false,
          shouldStatusPageSubscribersBeNotified: true,
          showAnnouncementAt: QueryHelper.lessThan(
            OneUptimeDate.getCurrentDate(),
          ),
        },
        props: {
          isRoot: true,
        },
        limit: LIMIT_MAX,
        skip: 0,
        select: {
          _id: true,
          title: true,
          description: true,
          statusPages: {
            _id: true,
          },
          showAnnouncementAt: true,
        },
      });

    // change their state to Ongoing.

    const host: Hostname = await DatabaseConfig.getHost();
    const httpProtocol: Protocol = await DatabaseConfig.getHttpProtocol();

    for (const announcement of announcements) {
      if (!announcement.statusPages) {
        continue;
      }

      const statusPages: Array<StatusPage> =
        await StatusPageSubscriberService.getStatusPagesToSendNotification(
          announcement.statusPages.map((sp: StatusPage) => {
            return sp.id!;
          }),
        );

      await StatusPageAnnouncementService.updateOneById({
        id: announcement.id!,
        data: {
          isStatusPageSubscribersNotified: true,
        },
        props: {
          isRoot: true,
          ignoreHooks: true,
        },
      });

      for (const statuspage of statusPages) {
        try {
          if (!statuspage.id) {
            continue;
          }

          const subscribers: Array<StatusPageSubscriber> =
            await StatusPageSubscriberService.getSubscribersByStatusPage(
              statuspage.id!,
              {
                isRoot: true,
                ignoreHooks: true,
              },
            );

          const statusPageURL: string =
            await StatusPageService.getStatusPageURL(statuspage.id);
          const statusPageName: string =
            statuspage.pageTitle || statuspage.name || "Status Page";

          // Send email to Email subscribers.

          for (const subscriber of subscribers) {
            try {
              if (!subscriber._id) {
                continue;
              }

              const shouldNotifySubscriber: boolean =
                StatusPageSubscriberService.shouldSendNotification({
                  subscriber: subscriber,
                  statusPageResources: [], // this is an announcement so we dont care about resources
                  statusPage: statuspage,
                  eventType: StatusPageEventType.Announcement,
                });

              if (!shouldNotifySubscriber) {
                continue;
              }

              const unsubscribeUrl: string =
                StatusPageSubscriberService.getUnsubscribeLink(
                  URL.fromString(statusPageURL),
                  subscriber.id!,
                ).toString();

              if (subscriber.subscriberPhone) {
                const sms: SMS = {
                  message: `
                            Announcement - ${statusPageName}

                            ${announcement.title || ""}

                            To view this announcement, visit ${statusPageURL}

                            To update notification preferences or unsubscribe, visit ${unsubscribeUrl}
                            `,
                  to: subscriber.subscriberPhone,
                };

                // send sms here.
                SmsService.sendSms(sms, {
                  projectId: statuspage.projectId,
                  customTwilioConfig:
                    ProjectCallSMSConfigService.toTwilioConfig(
                      statuspage.callSmsConfig,
                    ),
                }).catch((err: Error) => {
                  logger.error(err);
                });
              }

              if (subscriber.subscriberEmail) {
                // send email here.

                MailService.sendMail(
                  {
                    toEmail: subscriber.subscriberEmail,
                    templateType:
                      EmailTemplateType.SubscriberAnnouncementCreated,
                    vars: {
                      statusPageName: statusPageName,
                      statusPageUrl: statusPageURL,
                      logoUrl: statuspage.logoFileId
                        ? new URL(httpProtocol, host)
                            .addRoute(FileRoute)
                            .addRoute("/image/" + statuspage.logoFileId)
                            .toString()
                        : "",
                      isPublicStatusPage: statuspage.isPublicStatusPage
                        ? "true"
                        : "false",
                      announcementTitle: announcement.title || "",
                      announcementDescription: await Markdown.convertToHTML(
                        announcement.description || "",
                        MarkdownContentType.Email,
                      ),
                      subscriberEmailNotificationFooterText:
                        statuspage.subscriberEmailNotificationFooterText || "",
                      unsubscribeUrl: unsubscribeUrl,
                    },
                    subject: "[Announcement] " + statusPageName,
                  },
                  {
                    mailServer: ProjectSMTPConfigService.toEmailServer(
                      statuspage.smtpConfig,
                    ),
                    projectId: statuspage.projectId,
                  },
                ).catch((err: Error) => {
                  logger.error(err);
                });
              }
            } catch (err) {
              logger.error(err);
            }
          }
        } catch (err) {
          logger.error(err);
        }
      }
    }
  },
);
