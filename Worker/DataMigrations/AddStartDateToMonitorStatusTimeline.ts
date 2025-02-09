import DataMigrationBase from "./DataMigrationBase";
import SortOrder from "Common/Types/BaseDatabase/SortOrder";
import LIMIT_MAX from "Common/Types/Database/LimitMax";
import MonitorService from "Common/Server/Services/MonitorService";
import MonitorStatusTimelineService from "Common/Server/Services/MonitorStatusTimelineService";
import ProjectService from "Common/Server/Services/ProjectService";
import QueryHelper from "Common/Server/Types/Database/QueryHelper";
import Monitor from "Common/Models/DatabaseModels/Monitor";
import MonitorStatusTimeline from "Common/Models/DatabaseModels/MonitorStatusTimeline";
import Project from "Common/Models/DatabaseModels/Project";

export default class AddStartDateToMonitorStatusTimeline extends DataMigrationBase {
  public constructor() {
    super("AddStartDateToMonitorStatusTimeline");
  }

  public override async migrate(): Promise<void> {
    // get all the users with email isVerified true.

    const projects: Array<Project> = await ProjectService.findBy({
      query: {},
      select: {
        _id: true,
      },
      skip: 0,
      limit: LIMIT_MAX,
      props: {
        isRoot: true,
      },
    });

    for (const project of projects) {
      // add ended scheduled maintenance state for each of these projects.
      // first fetch resolved state. Ended state order is -1 of resolved state.

      const monitors: Array<Monitor> = await MonitorService.findBy({
        query: {
          projectId: project.id!,
        },
        select: {
          _id: true,
        },
        skip: 0,
        limit: LIMIT_MAX,
        props: {
          isRoot: true,
        },
      });

      for (const monitor of monitors) {
        const statusTimelines: Array<MonitorStatusTimeline> =
          await MonitorStatusTimelineService.findBy({
            query: {
              monitorId: monitor.id!,
              startsAt: QueryHelper.isNull(),
            },
            select: {
              _id: true,
              createdAt: true,
            },
            skip: 0,
            limit: LIMIT_MAX,
            props: {
              isRoot: true,
            },
            sort: {
              createdAt: SortOrder.Ascending,
            },
          });

        for (let i: number = 0; i < statusTimelines.length; i++) {
          const statusTimeline: MonitorStatusTimeline | undefined =
            statusTimelines[i];

          await MonitorStatusTimelineService.updateOneById({
            id: statusTimeline!.id!,
            data: {
              startsAt: statusTimeline!.createdAt!,
            },
            props: {
              isRoot: true,
            },
          });
        }
      }
    }
  }

  public override async rollback(): Promise<void> {
    return;
  }
}
