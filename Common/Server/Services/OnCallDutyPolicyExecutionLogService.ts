import CreateBy from "../Types/Database/CreateBy";
import { OnCreate, OnUpdate } from "../Types/Database/Hooks";
import DatabaseService from "./DatabaseService";
import OnCallDutyPolicyEscalationRuleService from "./OnCallDutyPolicyEscalationRuleService";
import OnCallDutyPolicyStatus from "../../Types/OnCallDutyPolicy/OnCallDutyPolicyStatus";
import UserNotificationEventType from "../../Types/UserNotification/UserNotificationEventType";
import OnCallDutyPolicyEscalationRule from "Common/Models/DatabaseModels/OnCallDutyPolicyEscalationRule";
import Model from "Common/Models/DatabaseModels/OnCallDutyPolicyExecutionLog";
import { IsBillingEnabled } from "../EnvironmentConfig";
import IncidentFeedService from "./IncidentFeedService";
import { IncidentFeedEventType } from "../../Models/DatabaseModels/IncidentFeed";
import { Yellow500 } from "../../Types/BrandColors";
import OnCallDutyPolicy from "../../Models/DatabaseModels/OnCallDutyPolicy";
import OnCallDutyPolicyService from "./OnCallDutyPolicyService";
import ObjectID from "../../Types/ObjectID";

export class Service extends DatabaseService<Model> {
  public constructor() {
    super(Model);
    if (IsBillingEnabled) {
      this.hardDeleteItemsOlderThanInDays("createdAt", 30);
    }
  }

  protected override async onBeforeCreate(
    createBy: CreateBy<Model>,
  ): Promise<OnCreate<Model>> {
    if (!createBy.data.status) {
      createBy.data.status = OnCallDutyPolicyStatus.Scheduled;
    }

    createBy.data.onCallPolicyExecutionRepeatCount = 1;

    return { createBy, carryForward: null };
  }

  protected override async onCreateSuccess(
    _onCreate: OnCreate<Model>,
    createdItem: Model,
  ): Promise<Model> {
    if (createdItem.triggeredByIncidentId) {
      const onCallPolicy: OnCallDutyPolicy | null =
        await OnCallDutyPolicyService.findOneById({
          id: createdItem.onCallDutyPolicyId!,
          select: {
            _id: true,
            projectId: true,
            name: true,
          },
          props: {
            isRoot: true,
          },
        });

      if (onCallPolicy && onCallPolicy.id) {
        await IncidentFeedService.createIncidentFeed({
          incidentId: createdItem.triggeredByIncidentId,
          projectId: createdItem.projectId!,
          incidentFeedEventType: IncidentFeedEventType.OnCallPolicy,
          displayColor: Yellow500,
          feedInfoInMarkdown: `**On Call Policy Started Executing:** On Call Policy **${onCallPolicy.name}** started executing. Users on call on this policy will now be notified.`,
        });
      }
    }

    // get execution rules in this policy adn execute the first rule.
    const executionRule: OnCallDutyPolicyEscalationRule | null =
      await OnCallDutyPolicyEscalationRuleService.findOneBy({
        query: {
          projectId: createdItem.projectId!,
          onCallDutyPolicyId: createdItem.onCallDutyPolicyId!,
          order: 1,
        },
        props: {
          isRoot: true,
        },
        select: {
          _id: true,
        },
      });

    if (executionRule) {
      await this.updateOneById({
        id: createdItem.id!,
        data: {
          status: OnCallDutyPolicyStatus.Started,
          statusMessage: "Execution started...",
        },
        props: {
          isRoot: true,
        },
      });

      await OnCallDutyPolicyEscalationRuleService.startRuleExecution(
        executionRule.id!,
        {
          projectId: createdItem.projectId!,
          triggeredByIncidentId: createdItem.triggeredByIncidentId,
          userNotificationEventType: UserNotificationEventType.IncidentCreated,
          onCallPolicyExecutionLogId: createdItem.id!,
          onCallPolicyId: createdItem.onCallDutyPolicyId!,
        },
      );

      await this.updateOneById({
        id: createdItem.id!,
        data: {
          status: OnCallDutyPolicyStatus.Executing,
          statusMessage: "First escalation rule executed....",
        },
        props: {
          isRoot: true,
        },
      });
    } else {
      await this.updateOneById({
        id: createdItem.id!,
        data: {
          status: OnCallDutyPolicyStatus.Error,
          statusMessage:
            "No Escalation Rules in Policy. Please add escalation rules to this policy.",
        },
        props: {
          isRoot: true,
        },
      });
    }

    return createdItem;
  }

  protected override async onUpdateSuccess(
    onUpdate: OnUpdate<Model>,
    _updatedItemIds: Array<ObjectID>,
  ): Promise<OnUpdate<Model>> {
    // if status is updtaed then check if this on-call is related to the incident, if yes, then add to incident feed.
    if (onUpdate.updateBy.data.status && onUpdate.updateBy.query.id) {
      const id: ObjectID = onUpdate.updateBy.query.id! as ObjectID;

      const onCalldutyPolicyExecutionLog: Model | null = await this.findOneById(
        {
          id: id,
          select: {
            _id: true,
            projectId: true,
            onCallDutyPolicyId: true,
            status: true,
            statusMessage: true,
            triggeredByIncidentId: true,
          },
          props: {
            isRoot: true,
          },
        },
      );

      if (
        onCalldutyPolicyExecutionLog &&
        onCalldutyPolicyExecutionLog.triggeredByIncidentId
      ) {
        const onCallPolicy: OnCallDutyPolicy | null =
          await OnCallDutyPolicyService.findOneById({
            id: onCalldutyPolicyExecutionLog.onCallDutyPolicyId!,
            select: {
              _id: true,
              projectId: true,
              name: true,
            },
            props: {
              isRoot: true,
            },
          });

        if (onCallPolicy && onCallPolicy.id) {
          await IncidentFeedService.createIncidentFeed({
            incidentId: onCalldutyPolicyExecutionLog.triggeredByIncidentId,
            projectId: onCalldutyPolicyExecutionLog.projectId!,
            incidentFeedEventType: IncidentFeedEventType.OnCallPolicy,
            displayColor: Yellow500,
            feedInfoInMarkdown: `**On Call Policy Status Updated: ** On Call Policy **${onCallPolicy.name}** status updated to **${onCalldutyPolicyExecutionLog.status}**. ${onCalldutyPolicyExecutionLog.statusMessage}`,
          });
        }
      }
    }

    return onUpdate;
  }
}
export default new Service();
