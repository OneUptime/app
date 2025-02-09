import DatabaseService from "./DatabaseService";
import OnCallDutyPolicyScheduleLayerService from "./OnCallDutyPolicyScheduleLayerService";
import OnCallDutyPolicyScheduleLayerUserService from "./OnCallDutyPolicyScheduleLayerUserService";
import SortOrder from "../../Types/BaseDatabase/SortOrder";
import CalendarEvent from "../../Types/Calendar/CalendarEvent";
import { LIMIT_PER_PROJECT } from "../../Types/Database/LimitMax";
import OneUptimeDate from "../../Types/Date";
import ObjectID from "../../Types/ObjectID";
import LayerUtil, { LayerProps } from "../../Types/OnCallDutyPolicy/Layer";
import Model from "Common/Models/DatabaseModels/OnCallDutyPolicySchedule";
import OnCallDutyPolicyScheduleLayer from "Common/Models/DatabaseModels/OnCallDutyPolicyScheduleLayer";
import OnCallDutyPolicyScheduleLayerUser from "Common/Models/DatabaseModels/OnCallDutyPolicyScheduleLayerUser";
import User from "Common/Models/DatabaseModels/User";

export class Service extends DatabaseService<Model> {
  public constructor() {
    super(Model);
  }

  public async getCurrentUserIdInSchedule(
    scheduleId: ObjectID,
  ): Promise<ObjectID | null> {
    // get schedule layers.

    const layers: Array<OnCallDutyPolicyScheduleLayer> =
      await OnCallDutyPolicyScheduleLayerService.findBy({
        query: {
          onCallDutyPolicyScheduleId: scheduleId,
        },
        select: {
          order: true,
          name: true,
          description: true,
          startsAt: true,
          restrictionTimes: true,
          rotation: true,
          onCallDutyPolicyScheduleId: true,
          projectId: true,
          handOffTime: true,
        },
        sort: {
          order: SortOrder.Ascending,
        },
        props: {
          isRoot: true,
        },
        limit: LIMIT_PER_PROJECT,
        skip: 0,
      });

    const layerUsers: Array<OnCallDutyPolicyScheduleLayerUser> =
      await OnCallDutyPolicyScheduleLayerUserService.findBy({
        query: {
          onCallDutyPolicyScheduleId: scheduleId,
        },
        select: {
          user: true,
          order: true,
          onCallDutyPolicyScheduleLayerId: true,
        },
        sort: {
          order: SortOrder.Ascending,
        },
        limit: LIMIT_PER_PROJECT,
        skip: 0,
        props: {
          isRoot: true,
        },
      });

    const currentStartTime: Date = OneUptimeDate.getCurrentDate();
    const currentEndTime: Date = OneUptimeDate.addRemoveSeconds(
      currentStartTime,
      1,
    );

    const layerProps: Array<LayerProps> = [];

    for (const layer of layers) {
      layerProps.push({
        users:
          layerUsers
            .filter((layerUser: OnCallDutyPolicyScheduleLayerUser) => {
              return (
                layerUser.onCallDutyPolicyScheduleLayerId?.toString() ===
                layer.id?.toString()
              );
            })
            .map((layerUser: OnCallDutyPolicyScheduleLayerUser) => {
              return layerUser.user!;
            })
            .filter((user: User) => {
              return Boolean(user);
            }) || [],
        startDateTimeOfLayer: layer.startsAt!,
        restrictionTimes: layer.restrictionTimes!,
        rotation: layer.rotation!,
        handOffTime: layer.handOffTime!,
      });
    }

    const events: Array<CalendarEvent> = LayerUtil.getMultiLayerEvents({
      layers: layerProps,
      calendarStartDate: currentStartTime,
      calendarEndDate: currentEndTime,
    });

    if (events.length === 0) {
      return null;
    }

    const userId: string | undefined = events[0]?.title; // this is user id in string.

    if (!userId) {
      return null;
    }

    return new ObjectID(userId);
  }
}

export default new Service();
