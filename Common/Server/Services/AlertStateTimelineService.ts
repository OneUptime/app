import CreateBy from "../Types/Database/CreateBy";
import DeleteBy from "../Types/Database/DeleteBy";
import { OnCreate, OnDelete } from "../Types/Database/Hooks";
import QueryHelper from "../Types/Database/QueryHelper";
import DatabaseService from "./DatabaseService";
import AlertService from "./AlertService";
import AlertStateService from "./AlertStateService";
import UserService from "./UserService";
import SortOrder from "../../Types/BaseDatabase/SortOrder";
import OneUptimeDate from "../../Types/Date";
import BadDataException from "../../Types/Exception/BadDataException";
import { JSONObject } from "../../Types/JSON";
import ObjectID from "../../Types/ObjectID";
import PositiveNumber from "../../Types/PositiveNumber";
import AlertState from "Common/Models/DatabaseModels/AlertState";
import AlertStateTimeline from "Common/Models/DatabaseModels/AlertStateTimeline";
import User from "Common/Models/DatabaseModels/User";
import { IsBillingEnabled } from "../EnvironmentConfig";

export class Service extends DatabaseService<AlertStateTimeline> {
  public constructor() {
    super(AlertStateTimeline);
    if(IsBillingEnabled){
    this.hardDeleteItemsOlderThanInDays("createdAt", 120);
    }
  }

  public async getResolvedStateIdForProject(
    projectId: ObjectID,
  ): Promise<ObjectID> {
    const resolvedState: AlertState | null =
      await AlertStateService.findOneBy({
        query: {
          projectId: projectId,
          isResolvedState: true,
        },
        props: {
          isRoot: true,
        },
        select: {
          _id: true,
        },
      });

    if (!resolvedState) {
      throw new BadDataException("No resolved state found for the project");
    }

    return resolvedState.id!;
  }

  protected override async onBeforeCreate(
    createBy: CreateBy<AlertStateTimeline>,
  ): Promise<OnCreate<AlertStateTimeline>> {
    if (!createBy.data.alertId) {
      throw new BadDataException("alertId is null");
    }

    if (!createBy.data.startsAt) {
      createBy.data.startsAt = OneUptimeDate.getCurrentDate();
    }

    if (
      (createBy.data.createdByUserId ||
        createBy.data.createdByUser ||
        createBy.props.userId) &&
      !createBy.data.rootCause
    ) {
      let userId: ObjectID | undefined = createBy.data.createdByUserId;

      if (createBy.props.userId) {
        userId = createBy.props.userId;
      }

      if (createBy.data.createdByUser && createBy.data.createdByUser.id) {
        userId = createBy.data.createdByUser.id;
      }

      const user: User | null = await UserService.findOneBy({
        query: {
          _id: userId?.toString() as string,
        },
        select: {
          _id: true,
          name: true,
          email: true,
        },
        props: {
          isRoot: true,
        },
      });

      if (user) {
        createBy.data.rootCause = `Alert state created by ${user.name} (${user.email})`;
      }
    }

    const lastAlertStateTimeline: AlertStateTimeline | null =
      await this.findOneBy({
        query: {
          alertId: createBy.data.alertId,
        },
        sort: {
          createdAt: SortOrder.Descending,
        },
        props: {
          isRoot: true,
        },
        select: {
          _id: true,
        },
      });


    return {
      createBy,
      carryForward: {
        lastAlertStateTimelineId: lastAlertStateTimeline?.id || null,
      },
    };
  }

  protected override async onCreateSuccess(
    onCreate: OnCreate<AlertStateTimeline>,
    createdItem: AlertStateTimeline,
  ): Promise<AlertStateTimeline> {
    if (!createdItem.alertId) {
      throw new BadDataException("alertId is null");
    }

    if (!createdItem.alertStateId) {
      throw new BadDataException("alertStateId is null");
    }

    // update the last status as ended.

    if (onCreate.carryForward.lastAlertStateTimelineId) {
      await this.updateOneById({
        id: onCreate.carryForward.lastAlertStateTimelineId!,
        data: {
          endsAt: createdItem.createdAt || OneUptimeDate.getCurrentDate(),
        },
        props: {
          isRoot: true,
        },
      });
    }

    await AlertService.updateOneBy({
      query: {
        _id: createdItem.alertId?.toString(),
      },
      data: {
        currentAlertStateId: createdItem.alertStateId,
      },
      props: onCreate.createBy.props,
    });

    return createdItem;
  }

  protected override async onBeforeDelete(
    deleteBy: DeleteBy<AlertStateTimeline>,
  ): Promise<OnDelete<AlertStateTimeline>> {
    if (deleteBy.query._id) {
      const alertStateTimelineToBeDeleted: AlertStateTimeline | null =
        await this.findOneById({
          id: new ObjectID(deleteBy.query._id as string),
          select: {
            alertId: true,
            startsAt: true,
          },
          props: {
            isRoot: true,
          },
        });

      const alertId: ObjectID | undefined =
        alertStateTimelineToBeDeleted?.alertId;

      if (alertId) {
        const alertStateTimeline: PositiveNumber = await this.countBy({
          query: {
            alertId: alertId,
          },
          props: {
            isRoot: true,
          },
        });

        if (alertStateTimeline.isOne()) {
          throw new BadDataException(
            "Cannot delete the only state timeline. Alert should have at least one state in its timeline.",
          );
        }

        if (alertStateTimelineToBeDeleted?.startsAt) {
          const beforeState: AlertStateTimeline | null =
            await this.findOneBy({
              query: {
                alertId: alertId,
                startsAt: QueryHelper.lessThan(
                  alertStateTimelineToBeDeleted?.startsAt,
                ),
              },
              sort: {
                createdAt: SortOrder.Descending,
              },
              props: {
                isRoot: true,
              },
              select: {
                _id: true,
                startsAt: true,
              },
            });

          if (beforeState) {
            const afterState: AlertStateTimeline | null =
              await this.findOneBy({
                query: {
                  alertId: alertId,
                  startsAt: QueryHelper.greaterThan(
                    alertStateTimelineToBeDeleted?.startsAt,
                  ),
                },
                sort: {
                  createdAt: SortOrder.Ascending,
                },
                props: {
                  isRoot: true,
                },
                select: {
                  _id: true,
                  startsAt: true,
                },
              });

            if (!afterState) {
              // if there's nothing after then end date of before state is null.

              await this.updateOneById({
                id: beforeState.id!,
                data: {
                  endsAt: null as any,
                },
                props: {
                  isRoot: true,
                },
              });
            } else {
              // if there's something after then end date of before state is start date of after state.

              await this.updateOneById({
                id: beforeState.id!,
                data: {
                  endsAt: afterState.startsAt!,
                },
                props: {
                  isRoot: true,
                },
              });
            }
          }
        }
      }

      return { deleteBy, carryForward: alertId };
    }

    return { deleteBy, carryForward: null };
  }

  protected override async onDeleteSuccess(
    onDelete: OnDelete<AlertStateTimeline>,
    _itemIdsBeforeDelete: ObjectID[],
  ): Promise<OnDelete<AlertStateTimeline>> {
    if (onDelete.carryForward) {
      // this is alertId.
      const alertId: ObjectID = onDelete.carryForward as ObjectID;

      // get last status of this monitor.
      const alertStateTimeline: AlertStateTimeline | null =
        await this.findOneBy({
          query: {
            alertId: alertId,
          },
          sort: {
            createdAt: SortOrder.Descending,
          },
          props: {
            isRoot: true,
          },
          select: {
            _id: true,
            alertStateId: true,
          },
        });

      if (alertStateTimeline && alertStateTimeline.alertStateId) {
        await AlertService.updateOneBy({
          query: {
            _id: alertId.toString(),
          },
          data: {
            currentAlertStateId: alertStateTimeline.alertStateId,
          },
          props: {
            isRoot: true,
          },
        });
      }
    }

    return onDelete;
  }
}

export default new Service();