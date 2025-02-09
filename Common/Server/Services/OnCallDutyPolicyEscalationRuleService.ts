import { IsBillingEnabled } from "../EnvironmentConfig";
import CreateBy from "../Types/Database/CreateBy";
import DeleteBy from "../Types/Database/DeleteBy";
import { OnCreate, OnDelete, OnUpdate } from "../Types/Database/Hooks";
import Query from "../Types/Database/Query";
import QueryHelper from "../Types/Database/QueryHelper";
import UpdateBy from "../Types/Database/UpdateBy";
import DatabaseService from "./DatabaseService";
import OnCallDutyPolicyEscalationRuleScheduleService from "./OnCallDutyPolicyEscalationRuleScheduleService";
import OnCallDutyPolicyEscalationRuleTeamService from "./OnCallDutyPolicyEscalationRuleTeamService";
import OnCallDutyPolicyEscalationRuleUserService from "./OnCallDutyPolicyEscalationRuleUserService";
import OnCallDutyPolicyExecutionLogService from "./OnCallDutyPolicyExecutionLogService";
import OnCallDutyPolicyExecutionLogTimelineService from "./OnCallDutyPolicyExecutionLogTimelineService";
import OnCallDutyPolicyScheduleService from "./OnCallDutyPolicyScheduleService";
import TeamMemberService from "./TeamMemberService";
import UserNotificationRuleService from "./UserNotificationRuleService";
import DatabaseCommonInteractionProps from "../../Types/BaseDatabase/DatabaseCommonInteractionProps";
import SortOrder from "../../Types/BaseDatabase/SortOrder";
import { PlanType } from "../../Types/Billing/SubscriptionPlan";
import LIMIT_MAX, { LIMIT_PER_PROJECT } from "../../Types/Database/LimitMax";
import OneUptimeDate from "../../Types/Date";
import BadDataException from "../../Types/Exception/BadDataException";
import ObjectID from "../../Types/ObjectID";
import OnCallDutyExecutionLogTimelineStatus from "../../Types/OnCallDutyPolicy/OnCalDutyExecutionLogTimelineStatus";
import PositiveNumber from "../../Types/PositiveNumber";
import UserNotificationEventType from "../../Types/UserNotification/UserNotificationEventType";
import Model from "Common/Models/DatabaseModels/OnCallDutyPolicyEscalationRule";
import OnCallDutyPolicyEscalationRuleSchedule from "Common/Models/DatabaseModels/OnCallDutyPolicyEscalationRuleSchedule";
import OnCallDutyPolicyEscalationRuleTeam from "Common/Models/DatabaseModels/OnCallDutyPolicyEscalationRuleTeam";
import OnCallDutyPolicyEscalationRuleUser from "Common/Models/DatabaseModels/OnCallDutyPolicyEscalationRuleUser";
import OnCallDutyPolicyExecutionLogTimeline from "Common/Models/DatabaseModels/OnCallDutyPolicyExecutionLogTimeline";
import User from "Common/Models/DatabaseModels/User";
import logger from "../Utils/Logger";

export class Service extends DatabaseService<Model> {
  public async startRuleExecution(
    ruleId: ObjectID,
    options: {
      projectId: ObjectID;
      triggeredByIncidentId?: ObjectID | undefined;
      triggeredByAlertId?: ObjectID | undefined;
      userNotificationEventType: UserNotificationEventType;
      onCallPolicyExecutionLogId: ObjectID;
      onCallPolicyId: ObjectID;
    },
  ): Promise<void> {
    logger.debug(`Starting rule execution for ruleId: ${ruleId.toString()}`);

    const rule: Model | null = await this.findOneById({
      id: ruleId,
      select: {
        _id: true,
        order: true,
        escalateAfterInMinutes: true,
      },
      props: {
        isRoot: true,
      },
    });

    if (!rule) {
      throw new BadDataException(
        `On-Call Duty Policy Escalation Rule with id ${ruleId.toString()} not found`,
      );
    }

    logger.debug(`Found rule: ${JSON.stringify(rule)}`);

    await OnCallDutyPolicyExecutionLogService.updateOneById({
      id: options.onCallPolicyExecutionLogId,
      data: {
        lastEscalationRuleExecutedAt: OneUptimeDate.getCurrentDate(),
        lastExecutedEscalationRuleId: ruleId,
        lastExecutedEscalationRuleOrder: rule.order!,
        executeNextEscalationRuleInMinutes: rule.escalateAfterInMinutes || 0,
      },
      props: {
        isRoot: true,
      },
    });

    logger.debug(`Updated execution log for ruleId: ${ruleId.toString()}`);

    type GetNewLogFunction = () => OnCallDutyPolicyExecutionLogTimeline;

    const getNewLog: GetNewLogFunction =
      (): OnCallDutyPolicyExecutionLogTimeline => {
        const log: OnCallDutyPolicyExecutionLogTimeline =
          new OnCallDutyPolicyExecutionLogTimeline();

        log.projectId = options.projectId;
        log.onCallDutyPolicyExecutionLogId = options.onCallPolicyExecutionLogId;
        log.onCallDutyPolicyId = options.onCallPolicyId;
        log.onCallDutyPolicyEscalationRuleId = ruleId;
        log.userNotificationEventType = options.userNotificationEventType;

        if (options.triggeredByIncidentId) {
          log.triggeredByIncidentId = options.triggeredByIncidentId;
        }

        if (options.triggeredByAlertId) {
          log.triggeredByAlertId = options.triggeredByAlertId;
        }

        return log;
      };

    if (
      UserNotificationEventType.IncidentCreated ===
        options.userNotificationEventType &&
      !options.triggeredByIncidentId
    ) {
      throw new BadDataException(
        "triggeredByIncidentId is required when userNotificationEventType is IncidentCreated",
      );
    }

    if (
      UserNotificationEventType.AlertCreated ===
        options.userNotificationEventType &&
      !options.triggeredByAlertId
    ) {
      throw new BadDataException(
        "triggeredByAlertId is required when userNotificationEventType is IncidentCreated",
      );
    }

    const usersInRule: Array<OnCallDutyPolicyEscalationRuleUser> =
      await OnCallDutyPolicyEscalationRuleUserService.findBy({
        query: {
          onCallDutyPolicyEscalationRuleId: ruleId,
        },
        props: {
          isRoot: true,
        },
        skip: 0,
        limit: LIMIT_PER_PROJECT,
        select: {
          userId: true,
        },
      });

    logger.debug(`Found users in rule: ${JSON.stringify(usersInRule)}`);

    const teamsInRule: Array<OnCallDutyPolicyEscalationRuleTeam> =
      await OnCallDutyPolicyEscalationRuleTeamService.findBy({
        query: {
          onCallDutyPolicyEscalationRuleId: ruleId,
        },
        props: {
          isRoot: true,
        },
        skip: 0,
        limit: LIMIT_PER_PROJECT,
        select: {
          teamId: true,
        },
      });

    logger.debug(`Found teams in rule: ${JSON.stringify(teamsInRule)}`);

    const schedulesInRule: Array<OnCallDutyPolicyEscalationRuleSchedule> =
      await OnCallDutyPolicyEscalationRuleScheduleService.findBy({
        query: {
          onCallDutyPolicyEscalationRuleId: ruleId,
        },
        props: {
          isRoot: true,
        },
        skip: 0,
        limit: LIMIT_PER_PROJECT,
        select: {
          onCallDutyPolicyScheduleId: true,
        },
      });

    logger.debug(`Found schedules in rule: ${JSON.stringify(schedulesInRule)}`);

    type StartUserNotificationRuleExecutionFunction = (
      userId: ObjectID,
      teamId: ObjectID | null,
      scheduleId: ObjectID | null,
    ) => Promise<void>;

    const startUserNotificationRuleExecution: StartUserNotificationRuleExecutionFunction =
      async (
        userId: ObjectID,
        teamId: ObjectID | null,
        scheduleId: ObjectID | null,
      ): Promise<void> => {
        logger.debug(
          `Starting notification rule execution for userId: ${userId.toString()}`,
        );
        let log: OnCallDutyPolicyExecutionLogTimeline = getNewLog();
        log.statusMessage = "Sending notification to user.";
        log.status = OnCallDutyExecutionLogTimelineStatus.Executing;
        log.alertSentToUserId = userId;
        if (teamId) {
          log.userBelongsToTeamId = teamId;
        }

        if (scheduleId) {
          log.onCallDutyScheduleId = scheduleId;
        }

        log = await OnCallDutyPolicyExecutionLogTimelineService.create({
          data: log,
          props: {
            isRoot: true,
          },
        });

        await UserNotificationRuleService.startUserNotificationRulesExecution(
          userId,
          {
            userNotificationEventType: options.userNotificationEventType!,
            triggeredByIncidentId: options.triggeredByIncidentId || undefined,
            triggeredByAlertId: options.triggeredByAlertId || undefined,
            onCallPolicyExecutionLogId: options.onCallPolicyExecutionLogId,
            onCallPolicyId: options.onCallPolicyId,
            onCallPolicyEscalationRuleId: ruleId,
            userBelongsToTeamId: teamId || undefined,
            onCallDutyPolicyExecutionLogTimelineId: log.id!,
            projectId: options.projectId,
            onCallScheduleId: scheduleId || undefined,
          },
        );
      };

    const uniqueUserIds: Array<ObjectID> = [];

    for (const teamInRule of teamsInRule) {
      const usersInTeam: Array<User> = await TeamMemberService.getUsersInTeam(
        teamInRule.teamId!,
      );

      for (const user of usersInTeam) {
        if (
          !uniqueUserIds.find((userId: ObjectID) => {
            return user.id?.toString() === userId.toString();
          })
        ) {
          uniqueUserIds.push(user.id!);
          await startUserNotificationRuleExecution(
            user.id!,
            teamInRule.teamId!,
            null,
          );
        } else {
          const log: OnCallDutyPolicyExecutionLogTimeline = getNewLog();
          log.statusMessage =
            "Skipped because notification sent to this user already.";
          log.status = OnCallDutyExecutionLogTimelineStatus.Skipped;
          log.alertSentToUserId = user.id!;
          log.userBelongsToTeamId = teamInRule.teamId!;

          await OnCallDutyPolicyExecutionLogTimelineService.create({
            data: log,
            props: {
              isRoot: true,
            },
          });
        }
      }
    }

    for (const userRule of usersInRule) {
      if (
        !uniqueUserIds.find((userId: ObjectID) => {
          return userRule.userId?.toString() === userId.toString();
        })
      ) {
        uniqueUserIds.push(userRule.userId!);
        await startUserNotificationRuleExecution(userRule.userId!, null, null);
      } else {
        const log: OnCallDutyPolicyExecutionLogTimeline = getNewLog();
        log.statusMessage =
          "Skipped because notification sent to this user already.";
        log.status = OnCallDutyExecutionLogTimelineStatus.Skipped;
        log.alertSentToUserId = userRule.userId!;

        await OnCallDutyPolicyExecutionLogTimelineService.create({
          data: log,
          props: {
            isRoot: true,
          },
        });
      }
    }

    for (const scheduleRule of schedulesInRule) {
      const userIdInSchedule: ObjectID | null =
        await OnCallDutyPolicyScheduleService.getCurrentUserIdInSchedule(
          scheduleRule.onCallDutyPolicyScheduleId!,
        );

      if (!userIdInSchedule) {
        const log: OnCallDutyPolicyExecutionLogTimeline = getNewLog();
        log.statusMessage =
          "Skipped because no active users are found in this schedule.";
        log.status = OnCallDutyExecutionLogTimelineStatus.Skipped;
        log.onCallDutyScheduleId = scheduleRule.onCallDutyPolicyScheduleId!;

        await OnCallDutyPolicyExecutionLogTimelineService.create({
          data: log,
          props: {
            isRoot: true,
          },
        });

        continue;
      }

      if (
        !uniqueUserIds.find((userId: ObjectID) => {
          return userIdInSchedule?.toString() === userId.toString();
        })
      ) {
        uniqueUserIds.push(userIdInSchedule);
        await startUserNotificationRuleExecution(
          userIdInSchedule,
          null,
          scheduleRule.onCallDutyPolicyScheduleId!,
        );
      } else {
        const log: OnCallDutyPolicyExecutionLogTimeline = getNewLog();
        log.statusMessage =
          "Skipped because notification sent to this user already.";
        log.status = OnCallDutyExecutionLogTimelineStatus.Skipped;
        log.alertSentToUserId = userIdInSchedule;
        log.onCallDutyScheduleId = scheduleRule.onCallDutyPolicyScheduleId!;

        await OnCallDutyPolicyExecutionLogTimelineService.create({
          data: log,
          props: {
            isRoot: true,
          },
        });
      }
    }

    if (uniqueUserIds.length === 0) {
      const log: OnCallDutyPolicyExecutionLogTimeline = getNewLog();
      log.statusMessage = "Skipped because no users in this rule.";
      log.status = OnCallDutyExecutionLogTimelineStatus.Skipped;

      await OnCallDutyPolicyExecutionLogTimelineService.create({
        data: log,
        props: {
          isRoot: true,
        },
      });
    }

    logger.debug(`Completed rule execution for ruleId: ${ruleId.toString()}`);
  }

  public constructor() {
    super(Model);
  }

  protected override async onCreateSuccess(
    onCreate: OnCreate<Model>,
    createdItem: Model,
  ): Promise<Model> {
    if (!createdItem.projectId) {
      throw new BadDataException("projectId is required");
    }

    if (!createdItem.id) {
      throw new BadDataException("id is required");
    }

    // add people in escalation rule.

    if (
      onCreate.createBy.miscDataProps &&
      (onCreate.createBy.miscDataProps["teams"] ||
        onCreate.createBy.miscDataProps["users"] ||
        onCreate.createBy.miscDataProps["onCallSchedules"])
    ) {
      await this.addUsersTeamsAndSchedules(
        createdItem.projectId,
        createdItem.id,
        createdItem.onCallDutyPolicyId!,
        (onCreate.createBy.miscDataProps["users"] as Array<ObjectID>) || [],
        (onCreate.createBy.miscDataProps["teams"] as Array<ObjectID>) || [],
        (onCreate.createBy.miscDataProps[
          "onCallSchedules"
        ] as Array<ObjectID>) || [],
        onCreate.createBy.props,
      );
    }

    return createdItem;
  }

  public async addUsersTeamsAndSchedules(
    projectId: ObjectID,
    escalationRuleId: ObjectID,
    onCallDutyPolicyId: ObjectID,
    usersIds: Array<ObjectID>,
    teamIds: Array<ObjectID>,
    onCallScheduleIds: Array<ObjectID>,
    props: DatabaseCommonInteractionProps,
  ): Promise<void> {
    for (const userId of usersIds) {
      await this.addUser(
        projectId,
        escalationRuleId,
        onCallDutyPolicyId,
        userId,
        props,
      );
    }

    for (const teamId of teamIds) {
      await this.addTeam(
        projectId,
        escalationRuleId,
        onCallDutyPolicyId,
        teamId,
        props,
      );
    }

    for (const scheduleId of onCallScheduleIds) {
      await this.addOnCallSchedules(
        projectId,
        escalationRuleId,
        onCallDutyPolicyId,
        scheduleId,
        props,
      );
    }
  }

  public async addTeam(
    projectId: ObjectID,
    escalationRuleId: ObjectID,
    onCallDutyPolicyId: ObjectID,
    teamId: ObjectID,
    props: DatabaseCommonInteractionProps,
  ): Promise<void> {
    const teamInRule: OnCallDutyPolicyEscalationRuleTeam =
      new OnCallDutyPolicyEscalationRuleTeam();
    teamInRule.projectId = projectId;
    teamInRule.onCallDutyPolicyId = onCallDutyPolicyId;
    teamInRule.onCallDutyPolicyEscalationRuleId = escalationRuleId;
    teamInRule.teamId = teamId;

    await OnCallDutyPolicyEscalationRuleTeamService.create({
      data: teamInRule,
      props,
    });
  }

  public async addOnCallSchedules(
    projectId: ObjectID,
    escalationRuleId: ObjectID,
    onCallDutyPolicyId: ObjectID,
    onCallScheduleId: ObjectID,
    props: DatabaseCommonInteractionProps,
  ): Promise<void> {
    const scheduleInRule: OnCallDutyPolicyEscalationRuleSchedule =
      new OnCallDutyPolicyEscalationRuleSchedule();
    scheduleInRule.projectId = projectId;
    scheduleInRule.onCallDutyPolicyId = onCallDutyPolicyId;
    scheduleInRule.onCallDutyPolicyEscalationRuleId = escalationRuleId;
    scheduleInRule.onCallDutyPolicyScheduleId = onCallScheduleId;

    await OnCallDutyPolicyEscalationRuleScheduleService.create({
      data: scheduleInRule,
      props,
    });
  }

  public async addUser(
    projectId: ObjectID,
    escalationRuleId: ObjectID,
    onCallDutyPolicyId: ObjectID,
    userId: ObjectID,
    props: DatabaseCommonInteractionProps,
  ): Promise<void> {
    const userInRule: OnCallDutyPolicyEscalationRuleUser =
      new OnCallDutyPolicyEscalationRuleUser();
    userInRule.projectId = projectId;
    userInRule.onCallDutyPolicyId = onCallDutyPolicyId;
    userInRule.onCallDutyPolicyEscalationRuleId = escalationRuleId;
    userInRule.userId = userId;

    await OnCallDutyPolicyEscalationRuleUserService.create({
      data: userInRule,
      props,
    });
  }

  protected override async onBeforeCreate(
    createBy: CreateBy<Model>,
  ): Promise<OnCreate<Model>> {
    if (IsBillingEnabled && createBy.props.currentPlan === PlanType.Free) {
      // then check no of policies and if it is more than one, return error
      const count: PositiveNumber = await this.countBy({
        query: {
          projectId: createBy.data.projectId!,
          onCallDutyPolicyId:
            createBy.data.onCallDutyPolicyId! ||
            createBy.data.onCallDutyPolicy?._id,
        },
        props: {
          isRoot: true,
        },
      });

      if (count.toNumber() >= 1) {
        throw new BadDataException(
          "You can only create one escalation rule in free plan.",
        );
      }
    }

    if (!createBy.data.onCallDutyPolicyId) {
      throw new BadDataException(
        "Status Page Resource onCallDutyPolicyId is required",
      );
    }

    if (!createBy.data.order) {
      const query: Query<Model> = {
        onCallDutyPolicyId: createBy.data.onCallDutyPolicyId,
      };

      const count: PositiveNumber = await this.countBy({
        query: query,
        props: {
          isRoot: true,
        },
      });

      createBy.data.order = count.toNumber() + 1;
    }

    await this.rearrangeOrder(
      createBy.data.order,
      createBy.data.onCallDutyPolicyId,
      true,
    );

    return {
      createBy: createBy,
      carryForward: null,
    };
  }

  protected override async onBeforeDelete(
    deleteBy: DeleteBy<Model>,
  ): Promise<OnDelete<Model>> {
    if (!deleteBy.query._id && !deleteBy.props.isRoot) {
      throw new BadDataException(
        "_id should be present when deleting status page resource. Please try the delete with objectId",
      );
    }

    let resource: Model | null = null;

    if (!deleteBy.props.isRoot) {
      resource = await this.findOneBy({
        query: deleteBy.query,
        props: {
          isRoot: true,
        },
        select: {
          order: true,
          onCallDutyPolicyId: true,
        },
      });
    }

    return {
      deleteBy,
      carryForward: resource,
    };
  }

  protected override async onDeleteSuccess(
    onDelete: OnDelete<Model>,
    _itemIdsBeforeDelete: ObjectID[],
  ): Promise<OnDelete<Model>> {
    const deleteBy: DeleteBy<Model> = onDelete.deleteBy;
    const resource: Model | null = onDelete.carryForward;

    if (!deleteBy.props.isRoot && resource) {
      if (resource && resource.order && resource.onCallDutyPolicyId) {
        await this.rearrangeOrder(
          resource.order,
          resource.onCallDutyPolicyId,

          false,
        );
      }
    }

    return {
      deleteBy: deleteBy,
      carryForward: null,
    };
  }

  protected override async onBeforeUpdate(
    updateBy: UpdateBy<Model>,
  ): Promise<OnUpdate<Model>> {
    if (updateBy.data.order && !updateBy.props.isRoot && updateBy.query._id) {
      const resource: Model | null = await this.findOneBy({
        query: {
          _id: updateBy.query._id!,
        },
        props: {
          isRoot: true,
        },
        select: {
          order: true,
          onCallDutyPolicyId: true,

          _id: true,
        },
      });

      const currentOrder: number = resource?.order as number;
      const newOrder: number = updateBy.data.order as number;

      const resources: Array<Model> = await this.findBy({
        query: {
          onCallDutyPolicyId: resource?.onCallDutyPolicyId as ObjectID,
        },

        limit: LIMIT_MAX,
        skip: 0,
        props: {
          isRoot: true,
        },
        select: {
          order: true,
          onCallDutyPolicyId: true,

          _id: true,
        },
      });

      if (currentOrder > newOrder) {
        // moving up.

        for (const resource of resources) {
          if (resource.order! >= newOrder && resource.order! < currentOrder) {
            // increment order.
            await this.updateOneBy({
              query: {
                _id: resource._id!,
              },
              data: {
                order: resource.order! + 1,
              },
              props: {
                isRoot: true,
              },
            });
          }
        }
      }

      if (newOrder > currentOrder) {
        // moving down.

        for (const resource of resources) {
          if (resource.order! <= newOrder) {
            // increment order.
            await this.updateOneBy({
              query: {
                _id: resource._id!,
              },
              data: {
                order: resource.order! - 1,
              },
              props: {
                isRoot: true,
              },
            });
          }
        }
      }
    }

    return { updateBy, carryForward: null };
  }

  private async rearrangeOrder(
    currentOrder: number,
    onCallDutyPolicyId: ObjectID,
    increaseOrder: boolean = true,
  ): Promise<void> {
    // get status page resource with this order.
    const resources: Array<Model> = await this.findBy({
      query: {
        order: QueryHelper.greaterThanEqualTo(currentOrder),
        onCallDutyPolicyId: onCallDutyPolicyId,
      },
      limit: LIMIT_MAX,
      skip: 0,
      props: {
        isRoot: true,
      },
      select: {
        _id: true,
        order: true,
      },
      sort: {
        order: SortOrder.Ascending,
      },
    });

    let newOrder: number = currentOrder;

    for (const resource of resources) {
      if (increaseOrder) {
        newOrder = resource.order! + 1;
      } else {
        newOrder = resource.order! - 1;
      }

      await this.updateOneBy({
        query: {
          _id: resource._id!,
        },
        data: {
          order: newOrder,
        },
        props: {
          isRoot: true,
        },
      });
    }
  }
}
export default new Service();
