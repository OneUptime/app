import CreateBy from "../Types/Database/CreateBy";
import { OnCreate } from "../Types/Database/Hooks";
import logger from "../Utils/Logger";
import CallService from "./CallService";
import DatabaseService from "./DatabaseService";
import MailService from "./MailService";
import SmsService from "./SmsService";
import TeamMemberService from "./TeamMemberService";
import UserCallService from "./UserCallService";
import UserEmailService from "./UserEmailService";
import UserSmsService from "./UserSmsService";
import { CallRequestMessage } from "../../Types/Call/CallRequest";
import { LIMIT_PER_PROJECT } from "../../Types/Database/LimitMax";
import { EmailEnvelope } from "../../Types/Email/EmailMessage";
import BadDataException from "../../Types/Exception/BadDataException";
import NotificationSettingEventType from "../../Types/NotificationSetting/NotificationSettingEventType";
import ObjectID from "../../Types/ObjectID";
import PositiveNumber from "../../Types/PositiveNumber";
import { SMSMessage } from "../../Types/SMS/SMS";
import UserCall from "Common/Models/DatabaseModels/UserCall";
import UserEmail from "Common/Models/DatabaseModels/UserEmail";
import UserNotificationSetting from "Common/Models/DatabaseModels/UserNotificationSetting";
import UserSMS from "Common/Models/DatabaseModels/UserSMS";

export class Service extends DatabaseService<UserNotificationSetting> {
  public constructor() {
    super(UserNotificationSetting);
  }

  public async sendUserNotification(data: {
    userId: ObjectID;
    projectId: ObjectID;
    eventType: NotificationSettingEventType;
    emailEnvelope: EmailEnvelope;
    smsMessage: SMSMessage;
    callRequestMessage: CallRequestMessage;
  }): Promise<void> {
    if (!data.projectId) {
      throw new BadDataException(
        "ProjectId is required for SendUserNotification",
      );
    }

    const notificationSettings: UserNotificationSetting | null =
      await this.findOneBy({
        query: {
          userId: data.userId,
          projectId: data.projectId,
          eventType: data.eventType,
        },
        select: {
          alertByEmail: true,
          alertBySMS: true,
          alertByCall: true,
        },
        props: {
          isRoot: true,
        },
      });

    if (notificationSettings) {
      if (notificationSettings.alertByEmail) {
        // get all the emails of the user.
        const userEmails: Array<UserEmail> = await UserEmailService.findBy({
          query: {
            userId: data.userId,
            projectId: data.projectId,
            isVerified: true,
          },
          select: {
            email: true,
          },
          limit: LIMIT_PER_PROJECT,
          skip: 0,
          props: {
            isRoot: true,
          },
        });

        for (const userEmail of userEmails) {
          MailService.sendMail(
            {
              ...data.emailEnvelope,
              toEmail: userEmail.email!,
            },
            {
              projectId: data.projectId,
            },
          ).catch((err: Error) => {
            logger.error(err);
          });
        }
      }

      if (notificationSettings.alertBySMS) {
        const userSmses: Array<UserSMS> = await UserSmsService.findBy({
          query: {
            userId: data.userId,
            projectId: data.projectId,
            isVerified: true,
          },
          select: {
            phone: true,
          },
          limit: LIMIT_PER_PROJECT,
          skip: 0,
          props: {
            isRoot: true,
          },
        });

        for (const userSms of userSmses) {
          SmsService.sendSms(
            {
              ...data.smsMessage,
              to: userSms.phone!,
            },
            {
              projectId: data.projectId,
            },
          ).catch((err: Error) => {
            logger.error(err);
          });
        }
      }

      if (notificationSettings.alertByCall) {
        const userCalls: Array<UserCall> = await UserCallService.findBy({
          query: {
            userId: data.userId,
            projectId: data.projectId,
            isVerified: true,
          },
          select: {
            phone: true,
          },
          limit: LIMIT_PER_PROJECT,
          skip: 0,
          props: {
            isRoot: true,
          },
        });

        for (const userCall of userCalls) {
          CallService.makeCall(
            {
              ...data.callRequestMessage,
              to: userCall.phone!,
            },
            {
              projectId: data.projectId,
            },
          ).catch((err: Error) => {
            logger.error(err);
          });
        }
      }
    }
  }

  public async removeDefaultNotificationSettingsForUser(
    userId: ObjectID,
    projectId: ObjectID,
  ): Promise<void> {
    // check if this user is not in the project anymore.
    const count: PositiveNumber = await TeamMemberService.countBy({
      query: {
        projectId,
        userId,
        hasAcceptedInvitation: true,
      },
      props: {
        isRoot: true,
      },
    });

    if (count.toNumber() === 0) {
      await this.deleteBy({
        query: {
          projectId,
          userId,
        },
        limit: LIMIT_PER_PROJECT,
        skip: 0,
        props: {
          isRoot: true,
        },
      });
    }
  }

  public async addDefaultNotificationSettingsForUser(
    userId: ObjectID,
    projectId: ObjectID,
  ): Promise<void> {
    const probeOwnerAddedNotificationEvent: PositiveNumber = await this.countBy(
      {
        query: {
          userId,
          projectId,
          eventType:
            NotificationSettingEventType.SEND_PROBE_OWNER_ADDED_NOTIFICATION,
        },
        props: {
          isRoot: true,
        },
      },
    );

    if (probeOwnerAddedNotificationEvent.toNumber() === 0) {
      const item: UserNotificationSetting = new UserNotificationSetting();
      item.userId = userId;
      item.projectId = projectId;
      item.eventType =
        NotificationSettingEventType.SEND_PROBE_OWNER_ADDED_NOTIFICATION;
      item.alertByEmail = true;

      await this.create({
        data: item,
        props: {
          isRoot: true,
        },
      });
    }

    const probeStatusChangedNotificationEvent: PositiveNumber =
      await this.countBy({
        query: {
          userId,
          projectId,
          eventType:
            NotificationSettingEventType.SEND_PROBE_STATUS_CHANGED_OWNER_NOTIFICATION,
        },
        props: {
          isRoot: true,
        },
      });

    if (probeStatusChangedNotificationEvent.toNumber() === 0) {
      const item: UserNotificationSetting = new UserNotificationSetting();
      item.userId = userId;
      item.projectId = projectId;
      item.eventType =
        NotificationSettingEventType.SEND_PROBE_STATUS_CHANGED_OWNER_NOTIFICATION;
      item.alertByEmail = true;

      await this.create({
        data: item,
        props: {
          isRoot: true,
        },
      });
    }

    const incidentCreatedNotificationEvent: PositiveNumber = await this.countBy(
      {
        query: {
          userId,
          projectId,
          eventType:
            NotificationSettingEventType.SEND_INCIDENT_CREATED_OWNER_NOTIFICATION,
        },
        props: {
          isRoot: true,
        },
      },
    );

    if (incidentCreatedNotificationEvent.toNumber() === 0) {
      const item: UserNotificationSetting = new UserNotificationSetting();
      item.userId = userId;
      item.projectId = projectId;
      item.eventType =
        NotificationSettingEventType.SEND_INCIDENT_CREATED_OWNER_NOTIFICATION;
      item.alertByEmail = true;

      await this.create({
        data: item,
        props: {
          isRoot: true,
        },
      });
    }

    const alertCreatedNotificationEvent: PositiveNumber = await this.countBy({
      query: {
        userId,
        projectId,
        eventType:
          NotificationSettingEventType.SEND_ALERT_CREATED_OWNER_NOTIFICATION,
      },
      props: {
        isRoot: true,
      },
    });

    if (alertCreatedNotificationEvent.toNumber() === 0) {
      const item: UserNotificationSetting = new UserNotificationSetting();
      item.userId = userId;
      item.projectId = projectId;
      item.eventType =
        NotificationSettingEventType.SEND_ALERT_CREATED_OWNER_NOTIFICATION;
      item.alertByEmail = true;

      await this.create({
        data: item,
        props: {
          isRoot: true,
        },
      });
    }

    // check monitor state changed notification
    const monitorStateChangedNotificationEvent: PositiveNumber =
      await this.countBy({
        query: {
          userId,
          projectId,
          eventType:
            NotificationSettingEventType.SEND_MONITOR_STATUS_CHANGED_OWNER_NOTIFICATION,
        },
        props: {
          isRoot: true,
        },
      });

    if (monitorStateChangedNotificationEvent.toNumber() === 0) {
      const item: UserNotificationSetting = new UserNotificationSetting();
      item.userId = userId;
      item.projectId = projectId;
      item.eventType =
        NotificationSettingEventType.SEND_MONITOR_STATUS_CHANGED_OWNER_NOTIFICATION;
      item.alertByEmail = true;

      await this.create({
        data: item,
        props: {
          isRoot: true,
        },
      });
    }

    // SEND_MONITOR_NOTIFICATION_WHEN_NO_PROBES_ARE_MONITORING_THE_MONITOR

    const monitorNoProbesNotificationEvent: PositiveNumber = await this.countBy(
      {
        query: {
          userId,
          projectId,
          eventType:
            NotificationSettingEventType.SEND_MONITOR_NOTIFICATION_WHEN_NO_PROBES_ARE_MONITORING_THE_MONITOR,
        },
        props: {
          isRoot: true,
        },
      },
    );

    if (monitorNoProbesNotificationEvent.toNumber() === 0) {
      const item: UserNotificationSetting = new UserNotificationSetting();
      item.userId = userId;
      item.projectId = projectId;
      item.eventType =
        NotificationSettingEventType.SEND_MONITOR_NOTIFICATION_WHEN_NO_PROBES_ARE_MONITORING_THE_MONITOR;
      item.alertByEmail = true;

      await this.create({
        data: item,
        props: {
          isRoot: true,
        },
      });
    }

    // SEND_MONITOR_NOTIFICATION_WHEN_PORBE_STATUS_CHANGES

    const monitorProbeStatusChangedNotificationEvent: PositiveNumber =
      await this.countBy({
        query: {
          userId,
          projectId,
          eventType:
            NotificationSettingEventType.SEND_MONITOR_NOTIFICATION_WHEN_PORBE_STATUS_CHANGES,
        },
        props: {
          isRoot: true,
        },
      });

    if (monitorProbeStatusChangedNotificationEvent.toNumber() === 0) {
      const item: UserNotificationSetting = new UserNotificationSetting();
      item.userId = userId;
      item.projectId = projectId;
      item.eventType =
        NotificationSettingEventType.SEND_MONITOR_NOTIFICATION_WHEN_PORBE_STATUS_CHANGES;
      item.alertByEmail = true;

      await this.create({
        data: item,
        props: {
          isRoot: true,
        },
      });
    }

    // check incident state changed notification
    const incidentStateChangedNotificationEvent: PositiveNumber =
      await this.countBy({
        query: {
          userId,
          projectId,
          eventType:
            NotificationSettingEventType.SEND_INCIDENT_STATE_CHANGED_OWNER_NOTIFICATION,
        },
        props: {
          isRoot: true,
        },
      });

    if (incidentStateChangedNotificationEvent.toNumber() === 0) {
      const item: UserNotificationSetting = new UserNotificationSetting();
      item.userId = userId;
      item.projectId = projectId;
      item.eventType =
        NotificationSettingEventType.SEND_INCIDENT_STATE_CHANGED_OWNER_NOTIFICATION;
      item.alertByEmail = true;

      await this.create({
        data: item,
        props: {
          isRoot: true,
        },
      });
    }

    // check alert state changed notification
    const alertStateChangedNotificationEvent: PositiveNumber =
      await this.countBy({
        query: {
          userId,
          projectId,
          eventType:
            NotificationSettingEventType.SEND_ALERT_STATE_CHANGED_OWNER_NOTIFICATION,
        },
        props: {
          isRoot: true,
        },
      });

    if (alertStateChangedNotificationEvent.toNumber() === 0) {
      const item: UserNotificationSetting = new UserNotificationSetting();
      item.userId = userId;
      item.projectId = projectId;
      item.eventType =
        NotificationSettingEventType.SEND_ALERT_STATE_CHANGED_OWNER_NOTIFICATION;
      item.alertByEmail = true;

      await this.create({
        data: item,
        props: {
          isRoot: true,
        },
      });
    }
  }

  protected override async onBeforeCreate(
    createBy: CreateBy<UserNotificationSetting>,
  ): Promise<OnCreate<UserNotificationSetting>> {
    // check if the same event for same user is added.
    if (!createBy.data.projectId) {
      throw new BadDataException(
        "ProjectId is required for UserNotificationSetting",
      );
    }

    if (!createBy.data.userId) {
      throw new BadDataException(
        "UserId is required for UserNotificationSetting",
      );
    }

    if (!createBy.data.eventType) {
      throw new BadDataException(
        "EventType is required for UserNotificationSetting",
      );
    }

    const count: PositiveNumber = await this.countBy({
      query: {
        projectId: createBy.data.projectId,
        userId: createBy.data.userId,
        eventType: createBy.data.eventType,
      },
      props: {
        isRoot: true,
      },
    });

    if (count.toNumber() > 0) {
      throw new BadDataException(
        "Notification Setting of the same event type already exists for the user.",
      );
    }

    return {
      createBy,
      carryForward: undefined,
    };
  }
}

export default new Service();
