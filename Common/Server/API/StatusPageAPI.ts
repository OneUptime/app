import UserMiddleware from "../Middleware/UserAuthorization";
import AcmeChallengeService from "../Services/AcmeChallengeService";
import IncidentPublicNoteService from "../Services/IncidentPublicNoteService";
import IncidentService from "../Services/IncidentService";
import IncidentStateService from "../Services/IncidentStateService";
import IncidentStateTimelineService from "../Services/IncidentStateTimelineService";
import MonitorGroupResourceService from "../Services/MonitorGroupResourceService";
import MonitorGroupService from "../Services/MonitorGroupService";
import MonitorStatusService from "../Services/MonitorStatusService";
import ScheduledMaintenancePublicNoteService from "../Services/ScheduledMaintenancePublicNoteService";
import ScheduledMaintenanceService from "../Services/ScheduledMaintenanceService";
import ScheduledMaintenanceStateService from "../Services/ScheduledMaintenanceStateService";
import ScheduledMaintenanceStateTimelineService from "../Services/ScheduledMaintenanceStateTimelineService";
import StatusPageAnnouncementService from "../Services/StatusPageAnnouncementService";
import StatusPageDomainService from "../Services/StatusPageDomainService";
import StatusPageFooterLinkService from "../Services/StatusPageFooterLinkService";
import StatusPageGroupService from "../Services/StatusPageGroupService";
import StatusPageHeaderLinkService from "../Services/StatusPageHeaderLinkService";
import StatusPageHistoryChartBarColorRuleService from "../Services/StatusPageHistoryChartBarColorRuleService";
import StatusPageResourceService from "../Services/StatusPageResourceService";
import StatusPageService, {
  Service as StatusPageServiceType,
} from "../Services/StatusPageService";
import StatusPageSsoService from "../Services/StatusPageSsoService";
import StatusPageSubscriberService from "../Services/StatusPageSubscriberService";
import Query from "../Types/Database/Query";
import QueryHelper from "../Types/Database/QueryHelper";
import Select from "../Types/Database/Select";
import {
  ExpressRequest,
  ExpressResponse,
  NextFunction,
} from "../Utils/Express";
import logger from "../Utils/Logger";
import Response from "../Utils/Response";
import BaseAPI from "./BaseAPI";
import CommonAPI from "./CommonAPI";
import BaseModel from "Common/Models/DatabaseModels/DatabaseBaseModel/DatabaseBaseModel";
import ArrayUtil from "Common/Utils/Array";
import DatabaseCommonInteractionProps from "Common/Types/BaseDatabase/DatabaseCommonInteractionProps";
import SortOrder from "Common/Types/BaseDatabase/SortOrder";
import { LIMIT_PER_PROJECT } from "Common/Types/Database/LimitMax";
import OneUptimeDate from "Common/Types/Date";
import Dictionary from "Common/Types/Dictionary";
import Email from "Common/Types/Email";
import BadDataException from "Common/Types/Exception/BadDataException";
import NotAuthenticatedException from "Common/Types/Exception/NotAuthenticatedException";
import NotFoundException from "Common/Types/Exception/NotFoundException";
import { JSONObject } from "Common/Types/JSON";
import JSONFunctions from "Common/Types/JSONFunctions";
import ObjectID from "Common/Types/ObjectID";
import Phone from "Common/Types/Phone";
import PositiveNumber from "Common/Types/PositiveNumber";
import AcmeChallenge from "Common/Models/DatabaseModels/AcmeChallenge";
import Incident from "Common/Models/DatabaseModels/Incident";
import IncidentPublicNote from "Common/Models/DatabaseModels/IncidentPublicNote";
import IncidentState from "Common/Models/DatabaseModels/IncidentState";
import IncidentStateTimeline from "Common/Models/DatabaseModels/IncidentStateTimeline";
import MonitorGroupResource from "Common/Models/DatabaseModels/MonitorGroupResource";
import MonitorStatus from "Common/Models/DatabaseModels/MonitorStatus";
import MonitorStatusTimeline from "Common/Models/DatabaseModels/MonitorStatusTimeline";
import ScheduledMaintenance from "Common/Models/DatabaseModels/ScheduledMaintenance";
import ScheduledMaintenancePublicNote from "Common/Models/DatabaseModels/ScheduledMaintenancePublicNote";
import ScheduledMaintenanceState from "Common/Models/DatabaseModels/ScheduledMaintenanceState";
import ScheduledMaintenanceStateTimeline from "Common/Models/DatabaseModels/ScheduledMaintenanceStateTimeline";
import StatusPage from "Common/Models/DatabaseModels/StatusPage";
import StatusPageAnnouncement from "Common/Models/DatabaseModels/StatusPageAnnouncement";
import StatusPageDomain from "Common/Models/DatabaseModels/StatusPageDomain";
import StatusPageFooterLink from "Common/Models/DatabaseModels/StatusPageFooterLink";
import StatusPageGroup from "Common/Models/DatabaseModels/StatusPageGroup";
import StatusPageHeaderLink from "Common/Models/DatabaseModels/StatusPageHeaderLink";
import StatusPageHistoryChartBarColorRule from "Common/Models/DatabaseModels/StatusPageHistoryChartBarColorRule";
import StatusPageResource from "Common/Models/DatabaseModels/StatusPageResource";
import StatusPageSSO from "Common/Models/DatabaseModels/StatusPageSso";
import StatusPageSubscriber from "Common/Models/DatabaseModels/StatusPageSubscriber";
import StatusPageEventType from "../../Types/StatusPage/StatusPageEventType";

export default class StatusPageAPI extends BaseAPI<
  StatusPage,
  StatusPageServiceType
> {
  public constructor() {
    super(StatusPage, StatusPageService);

    // confirm subscription api
    this.router.get(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/confirm-subscription/:statusPageSubscriberId`,
      async (req: ExpressRequest, res: ExpressResponse) => {
        const token: string = req.query["verification-token"] as string;

        const statusPageSubscriberId: ObjectID = new ObjectID(
          req.params["statusPageSubscriberId"] as string,
        );

        const subscriber: StatusPageSubscriber | null =
          await StatusPageSubscriberService.findOneBy({
            query: {
              _id: statusPageSubscriberId,
              subscriptionConfirmationToken: token,
            },
            select: {
              isSubscriptionConfirmed: true,
            },
            props: {
              isRoot: true,
            },
          });

        if (!subscriber) {
          return Response.sendErrorResponse(
            req,
            res,
            new NotFoundException(
              "Subscriber not found or confirmation token is invalid",
            ),
          );
        }

        // check if subscription confirmed already.

        if (subscriber.isSubscriptionConfirmed) {
          return Response.sendEmptySuccessResponse(req, res);
        }

        await StatusPageSubscriberService.updateOneById({
          id: statusPageSubscriberId,
          data: {
            isSubscriptionConfirmed: true,
          },
          props: {
            isRoot: true,
          },
        });

        await StatusPageSubscriberService.sendYouHaveSubscribedEmail({
          subscriberId: statusPageSubscriberId,
        });

        return Response.sendEmptySuccessResponse(req, res);
      },
    );

    // CNAME verification api
    this.router.get(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/cname-verification/:token`,
      async (req: ExpressRequest, res: ExpressResponse) => {
        const host: string | undefined = req.get("host");

        if (!host) {
          throw new BadDataException("Host not found");
        }

        const token: string = req.params["token"] as string;

        logger.debug(`CNAME Verification: Host:${host}  - Token:${token}`);

        const domain: StatusPageDomain | null =
          await StatusPageDomainService.findOneBy({
            query: {
              cnameVerificationToken: token,
              fullDomain: host,
            },
            select: {
              _id: true,
            },
            props: {
              isRoot: true,
            },
          });

        if (!domain) {
          return Response.sendErrorResponse(
            req,
            res,
            new BadDataException("Invalid token."),
          );
        }

        return Response.sendEmptySuccessResponse(req, res);
      },
    );

    // ACME Challenge Validation.
    this.router.get(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/.well-known/acme-challenge/:token`,
      async (req: ExpressRequest, res: ExpressResponse) => {
        const challenge: AcmeChallenge | null =
          await AcmeChallengeService.findOneBy({
            query: {
              token: req.params["token"] as string,
            },
            select: {
              challenge: true,
            },
            props: {
              isRoot: true,
            },
          });

        if (!challenge) {
          return Response.sendErrorResponse(
            req,
            res,
            new NotFoundException("Challenge not found"),
          );
        }

        return Response.sendTextResponse(
          req,
          res,
          challenge.challenge as string,
        );
      },
    );

    this.router.post(
      `${new this.entityType().getCrudApiPath()?.toString()}/test-email-report`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const email: Email = new Email(req.body["email"] as string);
          const statusPageId: ObjectID = new ObjectID(
            req.body["statusPageId"].toString() as string,
          );

          await StatusPageService.sendEmailReport({
            email: email,
            statusPageId,
          });

          return Response.sendEmptySuccessResponse(req, res);
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType().getCrudApiPath()?.toString()}/domain`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          if (!req.body["domain"]) {
            throw new BadDataException("domain is required in request body");
          }

          const domain: string = req.body["domain"] as string;

          const statusPageDomain: StatusPageDomain | null =
            await StatusPageDomainService.findOneBy({
              query: {
                fullDomain: domain,
                domain: {
                  isVerified: true,
                } as any,
              },
              select: {
                statusPageId: true,
              },
              props: {
                isRoot: true,
              },
            });

          if (!statusPageDomain) {
            throw new BadDataException("No status page found with this domain");
          }

          const objectId: ObjectID = statusPageDomain.statusPageId!;

          return Response.sendJsonObjectResponse(req, res, {
            statusPageId: objectId.toString(),
          });
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/master-page/:statusPageId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const objectId: ObjectID = new ObjectID(
            req.params["statusPageId"] as string,
          );

          const select: Select<StatusPage> = {
            _id: true,
            slug: true,
            coverImageFileId: true,
            logoFileId: true,
            pageTitle: true,
            pageDescription: true,
            copyrightText: true,
            customCSS: true,
            customJavaScript: true,
            hidePoweredByOneUptimeBranding: true,
            headerHTML: true,
            footerHTML: true,
            enableEmailSubscribers: true,
            enableSmsSubscribers: true,
            isPublicStatusPage: true,
            allowSubscribersToChooseResources: true,
            allowSubscribersToChooseEventTypes: true,
            requireSsoForLogin: true,
            coverImageFile: {
              file: true,
              _id: true,
              type: true,
              name: true,
            },
            faviconFile: {
              file: true,
              _id: true,
              type: true,
              name: true,
            },
            logoFile: {
              file: true,
              _id: true,
              type: true,
              name: true,
            },
          };

          const hasEnabledSSO: PositiveNumber =
            await StatusPageSsoService.countBy({
              query: {
                isEnabled: true,
                statusPageId: objectId,
              },
              props: {
                isRoot: true,
              },
            });

          const item: StatusPage | null = await this.service.findOneById({
            id: objectId,
            select,
            props: {
              isRoot: true,
            },
          });

          if (!item) {
            throw new BadDataException("Status Page not found");
          }

          const footerLinks: Array<StatusPageFooterLink> =
            await StatusPageFooterLinkService.findBy({
              query: {
                statusPageId: objectId,
              },
              select: {
                _id: true,
                link: true,
                title: true,
                order: true,
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

          const headerLinks: Array<StatusPageHeaderLink> =
            await StatusPageHeaderLinkService.findBy({
              query: {
                statusPageId: objectId,
              },
              select: {
                _id: true,
                link: true,
                title: true,
                order: true,
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

          const response: JSONObject = {
            statusPage: BaseModel.toJSON(item, StatusPage),
            footerLinks: BaseModel.toJSONArray(
              footerLinks,
              StatusPageFooterLink,
            ),
            headerLinks: BaseModel.toJSONArray(
              headerLinks,
              StatusPageHeaderLink,
            ),
            hasEnabledSSO: hasEnabledSSO.toNumber(),
          };

          return Response.sendJsonObjectResponse(req, res, response);
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType().getCrudApiPath()?.toString()}/sso/:statusPageId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const objectId: ObjectID = new ObjectID(
            req.params["statusPageId"] as string,
          );

          const sso: Array<StatusPageSSO> = await StatusPageSsoService.findBy({
            query: {
              statusPageId: objectId,
              isEnabled: true,
            },
            select: {
              signOnURL: true,
              name: true,
              description: true,
              _id: true,
            },
            limit: LIMIT_PER_PROJECT,
            skip: 0,
            props: {
              isRoot: true,
            },
          });

          return Response.sendEntityArrayResponse(
            req,
            res,
            sso,
            new PositiveNumber(sso.length),
            StatusPageSSO,
          );
        } catch (err) {
          next(err);
        }
      },
    );

    // Get all status page resources for subscriber to subscribe to.
    this.router.post(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/resources/:statusPageId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const objectId: ObjectID = new ObjectID(
            req.params["statusPageId"] as string,
          );

          if (
            !(await this.service.hasReadAccess(
              objectId,
              await CommonAPI.getDatabaseCommonInteractionProps(req),
              req,
            ))
          ) {
            throw new NotAuthenticatedException(
              "You are not authenticated to access this status page",
            );
          }

          const resources: Array<StatusPageResource> =
            await StatusPageResourceService.findBy({
              query: {
                statusPageId: objectId,
              },
              select: {
                _id: true,
                displayName: true,
                order: true,
                statusPageGroup: {
                  _id: true,
                  name: true,
                  order: true,
                },
              },
              limit: LIMIT_PER_PROJECT,
              skip: 0,
              props: {
                isRoot: true,
              },
            });

          return Response.sendEntityArrayResponse(
            req,
            res,
            resources,
            new PositiveNumber(resources.length),
            StatusPageResource,
          );
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/overview/:statusPageId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const objectId: ObjectID = new ObjectID(
            req.params["statusPageId"] as string,
          );

          if (
            !(await this.service.hasReadAccess(
              objectId,
              await CommonAPI.getDatabaseCommonInteractionProps(req),
              req,
            ))
          ) {
            throw new NotAuthenticatedException(
              "You are not authenticated to access this status page",
            );
          }

          const statusPage: StatusPage | null =
            await StatusPageService.findOneBy({
              query: {
                _id: objectId.toString(),
              },
              select: {
                _id: true,
                projectId: true,
                isPublicStatusPage: true,
                overviewPageDescription: true,
                showIncidentLabelsOnStatusPage: true,
                showScheduledEventLabelsOnStatusPage: true,
                downtimeMonitorStatuses: {
                  _id: true,
                },
                defaultBarColor: true,
                showOverallUptimePercentOnStatusPage: true,
                overallUptimePercentPrecision: true,
              },
              props: {
                isRoot: true,
              },
            });

          if (!statusPage) {
            throw new BadDataException("Status Page not found");
          }

          //get monitor statuses

          const monitorStatuses: Array<MonitorStatus> =
            await MonitorStatusService.findBy({
              query: {
                projectId: statusPage.projectId!,
              },
              select: {
                name: true,
                color: true,
                priority: true,
                isOperationalState: true,
              },
              sort: {
                priority: SortOrder.Ascending,
              },
              skip: 0,
              limit: LIMIT_PER_PROJECT,
              props: {
                isRoot: true,
              },
            });

          // get resource groups.

          const groups: Array<StatusPageGroup> =
            await StatusPageGroupService.findBy({
              query: {
                statusPageId: objectId,
              },
              select: {
                name: true,
                order: true,
                description: true,
                isExpandedByDefault: true,
                showCurrentStatus: true,
                showUptimePercent: true,
                uptimePercentPrecision: true,
              },
              sort: {
                order: SortOrder.Ascending,
              },
              skip: 0,
              limit: LIMIT_PER_PROJECT,
              props: {
                isRoot: true,
              },
            });

          // get monitors on status page.
          const statusPageResources: Array<StatusPageResource> =
            await StatusPageResourceService.findBy({
              query: {
                statusPageId: objectId,
              },
              select: {
                statusPageGroupId: true,
                monitorId: true,
                displayTooltip: true,
                displayDescription: true,
                displayName: true,
                showStatusHistoryChart: true,
                showCurrentStatus: true,
                order: true,
                monitor: {
                  _id: true,
                  currentMonitorStatusId: true,
                },
                monitorGroupId: true,
                showUptimePercent: true,
                uptimePercentPrecision: true,
              },
              sort: {
                order: SortOrder.Ascending,
              },
              skip: 0,
              limit: LIMIT_PER_PROJECT,
              props: {
                isRoot: true,
              },
            });

          const monitorGroupIds: Array<ObjectID> = statusPageResources
            .map((resource: StatusPageResource) => {
              return resource.monitorGroupId!;
            })
            .filter((id: ObjectID) => {
              return Boolean(id); // remove nulls
            });

          // get monitors in the group.
          const monitorGroupCurrentStatuses: Dictionary<ObjectID> = {};
          const monitorsInGroup: Dictionary<Array<ObjectID>> = {};

          // get monitor status charts.
          const monitorsOnStatusPage: Array<ObjectID> = statusPageResources
            .map((monitor: StatusPageResource) => {
              return monitor.monitorId!;
            })
            .filter((id: ObjectID) => {
              return Boolean(id); // remove nulls
            });

          const monitorsOnStatusPageForTimeline: Array<ObjectID> =
            statusPageResources
              .filter((monitor: StatusPageResource) => {
                return (
                  monitor.showStatusHistoryChart || monitor.showUptimePercent
                );
              })
              .map((monitor: StatusPageResource) => {
                return monitor.monitorId!;
              })
              .filter((id: ObjectID) => {
                return Boolean(id); // remove nulls
              });

          for (const monitorGroupId of monitorGroupIds) {
            // get current status of monitors in the group.

            const currentStatus: MonitorStatus =
              await MonitorGroupService.getCurrentStatus(monitorGroupId, {
                isRoot: true,
              });

            monitorGroupCurrentStatuses[monitorGroupId.toString()] =
              currentStatus.id!;

            // get monitors in the group.

            const groupResources: Array<MonitorGroupResource> =
              await MonitorGroupResourceService.findBy({
                query: {
                  monitorGroupId: monitorGroupId,
                },
                select: {
                  monitorId: true,
                },
                props: {
                  isRoot: true,
                },
                limit: LIMIT_PER_PROJECT,
                skip: 0,
              });

            const monitorsInGroupIds: Array<ObjectID> = groupResources
              .map((resource: MonitorGroupResource) => {
                return resource.monitorId!;
              })
              .filter((id: ObjectID) => {
                return Boolean(id); // remove nulls
              });

            const shouldShowTimelineForThisGroup: boolean = Boolean(
              statusPageResources.find((resource: StatusPageResource) => {
                return (
                  resource.monitorGroupId?.toString() ===
                    monitorGroupId.toString() &&
                  (resource.showStatusHistoryChart ||
                    resource.showUptimePercent)
                );
              }),
            );

            for (const monitorId of monitorsInGroupIds) {
              if (!monitorId) {
                continue;
              }

              if (
                !monitorsOnStatusPage.find((item: ObjectID) => {
                  return item.toString() === monitorId.toString();
                })
              ) {
                monitorsOnStatusPage.push(monitorId);
              }

              // add this to the timeline event for this group.

              if (
                shouldShowTimelineForThisGroup &&
                !monitorsOnStatusPageForTimeline.find((item: ObjectID) => {
                  return item.toString() === monitorId.toString();
                })
              ) {
                monitorsOnStatusPageForTimeline.push(monitorId);
              }
            }

            monitorsInGroup[monitorGroupId.toString()] = monitorsInGroupIds;
          }

          const monitorStatusTimelines: Array<MonitorStatusTimeline> =
            await StatusPageService.getMonitorStatusTimelineForStatusPage({
              monitorIds: monitorsOnStatusPageForTimeline,
              historyDays: 90,
            });

          // check if status page has active incident.
          let activeIncidents: Array<Incident> = [];
          if (monitorsOnStatusPage.length > 0) {
            let select: Select<Incident> = {
              createdAt: true,
              title: true,
              description: true,
              _id: true,
              incidentSeverity: {
                name: true,
                color: true,
              },
              currentIncidentState: {
                _id: true,
                name: true,
                color: true,
                order: true,
              },
              monitors: {
                _id: true,
              },
            };

            if (statusPage.showIncidentLabelsOnStatusPage) {
              select = {
                ...select,
                labels: {
                  name: true,
                  color: true,
                },
              };
            }

            const unresolvedIncidentStates: Array<IncidentState> =
              await IncidentStateService.getUnresolvedIncidentStates(
                statusPage.projectId!,
                {
                  isRoot: true,
                },
              );

            const unresolvedIncidentStateIds: Array<ObjectID> =
              unresolvedIncidentStates.map((state: IncidentState) => {
                return state.id!;
              });

            activeIncidents = await IncidentService.findBy({
              query: {
                monitors: monitorsOnStatusPage as any,
                currentIncidentStateId: QueryHelper.any(
                  unresolvedIncidentStateIds,
                ),
                projectId: statusPage.projectId!,
              },
              select: select,
              sort: {
                createdAt: SortOrder.Ascending,
              },

              skip: 0,
              limit: LIMIT_PER_PROJECT,
              props: {
                isRoot: true,
              },
            });
          }

          const incidentsOnStatusPage: Array<ObjectID> = activeIncidents.map(
            (incident: Incident) => {
              return incident.id!;
            },
          );

          let incidentPublicNotes: Array<IncidentPublicNote> = [];

          if (incidentsOnStatusPage.length > 0) {
            incidentPublicNotes = await IncidentPublicNoteService.findBy({
              query: {
                incidentId: QueryHelper.any(incidentsOnStatusPage),
                projectId: statusPage.projectId!,
              },
              select: {
                note: true,
                incidentId: true,
                postedAt: true,
              },
              sort: {
                postedAt: SortOrder.Descending, // new note first
              },
              skip: 0,
              limit: LIMIT_PER_PROJECT,
              props: {
                isRoot: true,
              },
            });
          }

          let incidentStateTimelines: Array<IncidentStateTimeline> = [];

          if (incidentsOnStatusPage.length > 0) {
            incidentStateTimelines = await IncidentStateTimelineService.findBy({
              query: {
                incidentId: QueryHelper.any(incidentsOnStatusPage),
                projectId: statusPage.projectId!,
              },
              select: {
                _id: true,
                createdAt: true,
                incidentId: true,
                incidentState: {
                  _id: true,
                  name: true,
                  color: true,
                  isCreatedState: true,
                  isResolvedState: true,
                  isAcknowledgedState: true,
                },
              },

              sort: {
                createdAt: SortOrder.Descending, // new note first
              },
              skip: 0,
              limit: LIMIT_PER_PROJECT,
              props: {
                isRoot: true,
              },
            });
          }

          // check if status page has active announcement.

          const today: Date = OneUptimeDate.getCurrentDate();

          const activeAnnouncements: Array<StatusPageAnnouncement> =
            await StatusPageAnnouncementService.findBy({
              query: {
                statusPages: objectId as any,
                showAnnouncementAt: QueryHelper.lessThan(today),
                endAnnouncementAt: QueryHelper.greaterThanOrNull(today),
                projectId: statusPage.projectId!,
              },
              select: {
                createdAt: true,
                title: true,
                description: true,
                _id: true,
                showAnnouncementAt: true,
                endAnnouncementAt: true,
              },
              skip: 0,
              limit: LIMIT_PER_PROJECT,
              props: {
                isRoot: true,
              },
            });

          // check if status page has active scheduled events.

          let scheduledEventsSelect: Select<ScheduledMaintenance> = {
            createdAt: true,
            title: true,
            description: true,
            _id: true,
            endsAt: true,
            startsAt: true,
            currentScheduledMaintenanceState: {
              name: true,
              color: true,
              isScheduledState: true,
              isResolvedState: true,
              isOngoingState: true,
            },
            monitors: {
              _id: true,
            },
          };

          if (statusPage.showScheduledEventLabelsOnStatusPage) {
            scheduledEventsSelect = {
              ...scheduledEventsSelect,
              labels: {
                name: true,
                color: true,
              },
            };
          }

          const scheduledMaintenanceEvents: Array<ScheduledMaintenance> =
            await ScheduledMaintenanceService.findBy({
              query: {
                currentScheduledMaintenanceState: {
                  isOngoingState: true,
                } as any,
                statusPages: objectId as any,
                projectId: statusPage.projectId!,
              },
              select: scheduledEventsSelect,
              sort: {
                startsAt: SortOrder.Ascending,
              },
              skip: 0,
              limit: LIMIT_PER_PROJECT,
              props: {
                isRoot: true,
              },
            });

          const futureScheduledMaintenanceEvents: Array<ScheduledMaintenance> =
            await ScheduledMaintenanceService.findBy({
              query: {
                currentScheduledMaintenanceState: {
                  isScheduledState: true,
                } as any,
                statusPages: objectId as any,
                projectId: statusPage.projectId!,
              },
              select: scheduledEventsSelect,
              sort: {
                startsAt: SortOrder.Ascending,
              },
              skip: 0,
              limit: LIMIT_PER_PROJECT,
              props: {
                isRoot: true,
              },
            });

          futureScheduledMaintenanceEvents.forEach(
            (event: ScheduledMaintenance) => {
              scheduledMaintenanceEvents.push(event);
            },
          );

          const scheduledMaintenanceEventsOnStatusPage: Array<ObjectID> =
            scheduledMaintenanceEvents.map((event: ScheduledMaintenance) => {
              return event.id!;
            });

          let scheduledMaintenanceEventsPublicNotes: Array<ScheduledMaintenancePublicNote> =
            [];

          if (scheduledMaintenanceEventsOnStatusPage.length > 0) {
            scheduledMaintenanceEventsPublicNotes =
              await ScheduledMaintenancePublicNoteService.findBy({
                query: {
                  scheduledMaintenanceId: QueryHelper.any(
                    scheduledMaintenanceEventsOnStatusPage,
                  ),
                  projectId: statusPage.projectId!,
                },
                select: {
                  postedAt: true,
                  note: true,
                  scheduledMaintenanceId: true,
                },
                sort: {
                  postedAt: SortOrder.Ascending,
                },
                skip: 0,
                limit: LIMIT_PER_PROJECT,
                props: {
                  isRoot: true,
                },
              });
          }

          let scheduledMaintenanceStateTimelines: Array<ScheduledMaintenanceStateTimeline> =
            [];

          if (scheduledMaintenanceEventsOnStatusPage.length > 0) {
            scheduledMaintenanceStateTimelines =
              await ScheduledMaintenanceStateTimelineService.findBy({
                query: {
                  scheduledMaintenanceId: QueryHelper.any(
                    scheduledMaintenanceEventsOnStatusPage,
                  ),
                  projectId: statusPage.projectId!,
                },
                select: {
                  _id: true,
                  createdAt: true,
                  scheduledMaintenanceId: true,
                  scheduledMaintenanceState: {
                    _id: true,
                    color: true,
                    name: true,
                    isScheduledState: true,
                    isResolvedState: true,
                    isOngoingState: true,
                  },
                },

                sort: {
                  createdAt: SortOrder.Descending, // new note first
                },
                skip: 0,
                limit: LIMIT_PER_PROJECT,
                props: {
                  isRoot: true,
                },
              });
          }

          // get all status page bar chart rules
          const statusPageHistoryChartBarColorRules: Array<StatusPageHistoryChartBarColorRule> =
            await StatusPageHistoryChartBarColorRuleService.findBy({
              query: {
                statusPageId: objectId,
              },
              select: {
                _id: true,
                barColor: true,
                order: true,
                statusPageId: true,
                uptimePercentGreaterThanOrEqualTo: true,
              },
              sort: {
                order: SortOrder.Ascending,
              },
              skip: 0,
              limit: LIMIT_PER_PROJECT,
              props: {
                isRoot: true,
              },
            });

          const overallStatus: MonitorStatus | null =
            this.getOverallMonitorStatus(
              statusPageResources,
              monitorStatuses,
              monitorGroupCurrentStatuses,
            );

          const response: JSONObject = {
            overallStatus: overallStatus
              ? BaseModel.toJSON(overallStatus, MonitorStatus)
              : null,

            scheduledMaintenanceEventsPublicNotes: BaseModel.toJSONArray(
              scheduledMaintenanceEventsPublicNotes,
              ScheduledMaintenancePublicNote,
            ),
            statusPageHistoryChartBarColorRules: BaseModel.toJSONArray(
              statusPageHistoryChartBarColorRules,
              StatusPageHistoryChartBarColorRule,
            ),
            scheduledMaintenanceEvents: BaseModel.toJSONArray(
              scheduledMaintenanceEvents,
              ScheduledMaintenance,
            ),
            activeAnnouncements: BaseModel.toJSONArray(
              activeAnnouncements,
              StatusPageAnnouncement,
            ),
            incidentPublicNotes: BaseModel.toJSONArray(
              incidentPublicNotes,
              IncidentPublicNote,
            ),

            activeIncidents: BaseModel.toJSONArray(activeIncidents, Incident),

            monitorStatusTimelines: BaseModel.toJSONArray(
              monitorStatusTimelines,
              MonitorStatusTimeline,
            ),
            resourceGroups: BaseModel.toJSONArray(groups, StatusPageGroup),
            monitorStatuses: BaseModel.toJSONArray(
              monitorStatuses,
              MonitorStatus,
            ),
            statusPageResources: BaseModel.toJSONArray(
              statusPageResources,
              StatusPageResource,
            ),
            incidentStateTimelines: BaseModel.toJSONArray(
              incidentStateTimelines,
              IncidentStateTimeline,
            ),
            statusPage: BaseModel.toJSONObject(statusPage, StatusPage),
            scheduledMaintenanceStateTimelines: BaseModel.toJSONArray(
              scheduledMaintenanceStateTimelines,
              ScheduledMaintenanceStateTimeline,
            ),

            monitorGroupCurrentStatuses: JSONFunctions.serialize(
              monitorGroupCurrentStatuses,
            ),
            monitorsInGroup: JSONFunctions.serialize(monitorsInGroup),
          };

          return Response.sendJsonObjectResponse(req, res, response);
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.put(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/update-subscription/:statusPageId/:subscriberId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          await this.subscribeToStatusPage(req);
          return Response.sendEmptySuccessResponse(req, res);
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/get-subscription/:statusPageId/:subscriberId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const subscriber: StatusPageSubscriber =
            await this.getSubscriber(req);

          return Response.sendEntityResponse(
            req,
            res,
            subscriber,
            StatusPageSubscriber,
          );
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/subscribe/:statusPageId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          await this.subscribeToStatusPage(req);

          return Response.sendEmptySuccessResponse(req, res);
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/incidents/:statusPageId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const objectId: ObjectID = new ObjectID(
            req.params["statusPageId"] as string,
          );

          const response: JSONObject = await this.getIncidents(
            objectId,
            null,
            await CommonAPI.getDatabaseCommonInteractionProps(req),
            req,
          );

          return Response.sendJsonObjectResponse(req, res, response);
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/scheduled-maintenance-events/:statusPageId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const objectId: ObjectID = new ObjectID(
            req.params["statusPageId"] as string,
          );

          const response: JSONObject = await this.getScheduledMaintenanceEvents(
            objectId,
            null,
            await CommonAPI.getDatabaseCommonInteractionProps(req),
            req,
          );

          return Response.sendJsonObjectResponse(req, res, response);
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/announcements/:statusPageId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const objectId: ObjectID = new ObjectID(
            req.params["statusPageId"] as string,
          );

          const response: JSONObject = await this.getAnnouncements(
            objectId,
            null,
            await CommonAPI.getDatabaseCommonInteractionProps(req),
            req,
          );

          return Response.sendJsonObjectResponse(req, res, response);
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/incidents/:statusPageId/:incidentId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const objectId: ObjectID = new ObjectID(
            req.params["statusPageId"] as string,
          );

          const incidentId: ObjectID = new ObjectID(
            req.params["incidentId"] as string,
          );

          const response: JSONObject = await this.getIncidents(
            objectId,
            incidentId,
            await CommonAPI.getDatabaseCommonInteractionProps(req),
            req,
          );

          return Response.sendJsonObjectResponse(req, res, response);
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/scheduled-maintenance-events/:statusPageId/:scheduledMaintenanceId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const objectId: ObjectID = new ObjectID(
            req.params["statusPageId"] as string,
          );

          const scheduledMaintenanceId: ObjectID = new ObjectID(
            req.params["scheduledMaintenanceId"] as string,
          );

          const response: JSONObject = await this.getScheduledMaintenanceEvents(
            objectId,
            scheduledMaintenanceId,
            await CommonAPI.getDatabaseCommonInteractionProps(req),
            req,
          );

          return Response.sendJsonObjectResponse(req, res, response);
        } catch (err) {
          next(err);
        }
      },
    );

    this.router.post(
      `${new this.entityType()
        .getCrudApiPath()
        ?.toString()}/announcements/:statusPageId/:announcementId`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const objectId: ObjectID = new ObjectID(
            req.params["statusPageId"] as string,
          );

          const announcementId: ObjectID = new ObjectID(
            req.params["announcementId"] as string,
          );

          const response: JSONObject = await this.getAnnouncements(
            objectId,
            announcementId,
            await CommonAPI.getDatabaseCommonInteractionProps(req),
            req,
          );

          return Response.sendJsonObjectResponse(req, res, response);
        } catch (err) {
          next(err);
        }
      },
    );
  }

  public async getScheduledMaintenanceEvents(
    statusPageId: ObjectID,
    scheduledMaintenanceId: ObjectID | null,
    props: DatabaseCommonInteractionProps,
    req: ExpressRequest,
  ): Promise<JSONObject> {
    if (!(await this.service.hasReadAccess(statusPageId, props, req))) {
      throw new NotAuthenticatedException(
        "You are not authenticated to access this status page",
      );
    }

    const statusPage: StatusPage | null = await StatusPageService.findOneBy({
      query: {
        _id: statusPageId.toString(),
      },
      select: {
        _id: true,
        projectId: true,
        showScheduledEventHistoryInDays: true,
        showScheduledEventLabelsOnStatusPage: true,
      },
      props: {
        isRoot: true,
      },
    });

    if (!statusPage) {
      throw new BadDataException("Status Page not found");
    }

    // get monitors on status page.
    const statusPageResources: Array<StatusPageResource> =
      await StatusPageService.getStatusPageResources({
        statusPageId: statusPageId,
      });

    // check if status page has active scheduled events.
    const today: Date = OneUptimeDate.getCurrentDate();
    const historyDays: Date = OneUptimeDate.getSomeDaysAgo(
      statusPage.showScheduledEventHistoryInDays || 14,
    );

    let query: Query<ScheduledMaintenance> = {
      startsAt: QueryHelper.inBetween(historyDays, today),
      statusPages: [statusPageId] as any,
      projectId: statusPage.projectId!,
    };

    if (scheduledMaintenanceId) {
      query = {
        _id: scheduledMaintenanceId.toString(),
        statusPages: [statusPageId] as any,
        projectId: statusPage.projectId!,
      };
    }

    let scheduledEventsSelect: Select<ScheduledMaintenance> = {
      createdAt: true,
      title: true,
      description: true,
      _id: true,
      endsAt: true,
      startsAt: true,
      currentScheduledMaintenanceState: {
        name: true,
        color: true,
        isScheduledState: true,
        isResolvedState: true,
        isOngoingState: true,
        order: true,
      },
      monitors: {
        _id: true,
      },
    };

    if (statusPage.showScheduledEventLabelsOnStatusPage) {
      scheduledEventsSelect = {
        ...scheduledEventsSelect,
        labels: {
          name: true,
          color: true,
        },
      };
    }

    const scheduledMaintenanceEvents: Array<ScheduledMaintenance> =
      await ScheduledMaintenanceService.findBy({
        query: query,
        select: scheduledEventsSelect,
        sort: {
          startsAt: SortOrder.Descending,
        },

        skip: 0,
        limit: LIMIT_PER_PROJECT,
        props: {
          isRoot: true,
        },
      });

    let futureScheduledMaintenanceEvents: Array<ScheduledMaintenance> = [];

    // If there is no scheduledMaintenanceId, then fetch all future scheduled events.
    if (!scheduledMaintenanceId) {
      futureScheduledMaintenanceEvents =
        await ScheduledMaintenanceService.findBy({
          query: {
            currentScheduledMaintenanceState: {
              isScheduledState: true,
            } as any,
            statusPages: [statusPageId] as any,
            projectId: statusPage.projectId!,
          },
          select: scheduledEventsSelect,
          sort: {
            createdAt: SortOrder.Ascending,
          },
          skip: 0,
          limit: LIMIT_PER_PROJECT,
          props: {
            isRoot: true,
          },
        });

      futureScheduledMaintenanceEvents.forEach(
        (event: ScheduledMaintenance) => {
          scheduledMaintenanceEvents.push(event);
        },
      );
    }

    const scheduledMaintenanceEventsOnStatusPage: Array<ObjectID> =
      scheduledMaintenanceEvents.map((event: ScheduledMaintenance) => {
        return event.id!;
      });

    let scheduledMaintenanceEventsPublicNotes: Array<ScheduledMaintenancePublicNote> =
      [];

    if (scheduledMaintenanceEventsOnStatusPage.length > 0) {
      scheduledMaintenanceEventsPublicNotes =
        await ScheduledMaintenancePublicNoteService.findBy({
          query: {
            scheduledMaintenanceId: QueryHelper.any(
              scheduledMaintenanceEventsOnStatusPage,
            ),
            projectId: statusPage.projectId!,
          },
          select: {
            postedAt: true,
            note: true,
            scheduledMaintenanceId: true,
          },
          sort: {
            postedAt: SortOrder.Ascending,
          },
          skip: 0,
          limit: LIMIT_PER_PROJECT,
          props: {
            isRoot: true,
          },
        });
    }

    let scheduledMaintenanceStateTimelines: Array<ScheduledMaintenanceStateTimeline> =
      [];

    if (scheduledMaintenanceEventsOnStatusPage.length > 0) {
      scheduledMaintenanceStateTimelines =
        await ScheduledMaintenanceStateTimelineService.findBy({
          query: {
            scheduledMaintenanceId: QueryHelper.any(
              scheduledMaintenanceEventsOnStatusPage,
            ),
            projectId: statusPage.projectId!,
          },
          select: {
            _id: true,
            createdAt: true,
            scheduledMaintenanceId: true,
            scheduledMaintenanceState: {
              name: true,
              color: true,
              isScheduledState: true,
              isResolvedState: true,
              isOngoingState: true,
            },
          },

          sort: {
            createdAt: SortOrder.Descending, // new note first
          },
          skip: 0,
          limit: LIMIT_PER_PROJECT,
          props: {
            isRoot: true,
          },
        });
    }

    const monitorGroupIds: Array<ObjectID> = statusPageResources
      .map((resource: StatusPageResource) => {
        return resource.monitorGroupId!;
      })
      .filter((id: ObjectID) => {
        return Boolean(id); // remove nulls
      });

    // get monitors in the group.
    const monitorsInGroup: Dictionary<Array<ObjectID>> = {};

    // get monitor status charts.
    const monitorsOnStatusPage: Array<ObjectID> = statusPageResources
      .map((monitor: StatusPageResource) => {
        return monitor.monitorId!;
      })
      .filter((id: ObjectID) => {
        return Boolean(id); // remove nulls
      });

    for (const monitorGroupId of monitorGroupIds) {
      // get monitors in the group.

      const groupResources: Array<MonitorGroupResource> =
        await MonitorGroupResourceService.findBy({
          query: {
            monitorGroupId: monitorGroupId,
          },
          select: {
            monitorId: true,
          },
          props: {
            isRoot: true,
          },
          limit: LIMIT_PER_PROJECT,
          skip: 0,
        });

      const monitorsInGroupIds: Array<ObjectID> = groupResources
        .map((resource: MonitorGroupResource) => {
          return resource.monitorId!;
        })
        .filter((id: ObjectID) => {
          return Boolean(id); // remove nulls
        });

      for (const monitorId of monitorsInGroupIds) {
        if (
          !monitorsOnStatusPage.find((item: ObjectID) => {
            return item.toString() === monitorId.toString();
          })
        ) {
          monitorsOnStatusPage.push(monitorId);
        }
      }

      monitorsInGroup[monitorGroupId.toString()] = monitorsInGroupIds;
    }

    // get scheduled event states.
    const scheduledEventStates: Array<ScheduledMaintenanceState> =
      await ScheduledMaintenanceStateService.findBy({
        query: {
          projectId: statusPage.projectId!,
        },
        limit: LIMIT_PER_PROJECT,
        skip: 0,
        props: {
          isRoot: true,
        },
        select: {
          _id: true,
          order: true,
          isEndedState: true,
          isOngoingState: true,
          isScheduledState: true,
        },
      });

    const response: JSONObject = {
      scheduledMaintenanceEventsPublicNotes: BaseModel.toJSONArray(
        scheduledMaintenanceEventsPublicNotes,
        ScheduledMaintenancePublicNote,
      ),
      scheduledMaintenanceStates: BaseModel.toJSONArray(
        scheduledEventStates,
        ScheduledMaintenanceState,
      ),
      scheduledMaintenanceEvents: BaseModel.toJSONArray(
        scheduledMaintenanceEvents,
        ScheduledMaintenance,
      ),
      statusPageResources: BaseModel.toJSONArray(
        statusPageResources,
        StatusPageResource,
      ),
      scheduledMaintenanceStateTimelines: BaseModel.toJSONArray(
        scheduledMaintenanceStateTimelines,
        ScheduledMaintenanceStateTimeline,
      ),
      monitorsInGroup: JSONFunctions.serialize(monitorsInGroup),
    };

    return response;
  }

  public async getAnnouncements(
    statusPageId: ObjectID,
    announcementId: ObjectID | null,
    props: DatabaseCommonInteractionProps,
    req: ExpressRequest,
  ): Promise<JSONObject> {
    if (!(await this.service.hasReadAccess(statusPageId, props, req))) {
      throw new NotAuthenticatedException(
        "You are not authenticated to access this status page",
      );
    }

    const statusPage: StatusPage | null = await StatusPageService.findOneBy({
      query: {
        _id: statusPageId.toString(),
      },
      select: {
        _id: true,
        projectId: true,
        showAnnouncementHistoryInDays: true,
      },
      props: {
        isRoot: true,
      },
    });

    if (!statusPage) {
      throw new BadDataException("Status Page not found");
    }

    // check if status page has active announcement.

    const today: Date = OneUptimeDate.getCurrentDate();
    const historyDays: Date = OneUptimeDate.getSomeDaysAgo(
      statusPage.showAnnouncementHistoryInDays || 14,
    );

    let query: Query<StatusPageAnnouncement> = {
      statusPages: [statusPageId] as any,
      showAnnouncementAt: QueryHelper.inBetween(historyDays, today),
      projectId: statusPage.projectId!,
    };

    if (announcementId) {
      query = {
        statusPages: [statusPageId] as any,
        _id: announcementId.toString(),
        projectId: statusPage.projectId!,
      };
    }

    const announcements: Array<StatusPageAnnouncement> =
      await StatusPageAnnouncementService.findBy({
        query: query,
        select: {
          createdAt: true,
          title: true,
          description: true,
          _id: true,
          showAnnouncementAt: true,
          endAnnouncementAt: true,
        },
        skip: 0,
        limit: LIMIT_PER_PROJECT,
        props: {
          isRoot: true,
        },
      });

    // get monitors on status page.
    const statusPageResources: Array<StatusPageResource> =
      await StatusPageResourceService.findBy({
        query: {
          statusPageId: statusPageId,
        },
        select: {
          statusPageGroupId: true,
          monitorId: true,
          displayTooltip: true,
          displayDescription: true,
          displayName: true,
          monitor: {
            _id: true,
            currentMonitorStatusId: true,
          },
        },

        skip: 0,
        limit: LIMIT_PER_PROJECT,
        props: {
          isRoot: true,
        },
      });

    const response: JSONObject = {
      announcements: BaseModel.toJSONArray(
        announcements,
        StatusPageAnnouncement,
      ),
      statusPageResources: BaseModel.toJSONArray(
        statusPageResources,
        StatusPageResource,
      ),
    };

    return response;
  }

  public async subscribeToStatusPage(req: ExpressRequest): Promise<void> {
    const objectId: ObjectID = new ObjectID(
      req.params["statusPageId"] as string,
    );

    if (
      !(await this.service.hasReadAccess(
        objectId,
        await CommonAPI.getDatabaseCommonInteractionProps(req),
        req,
      ))
    ) {
      throw new NotAuthenticatedException(
        "You are not authenticated to access this status page",
      );
    }

    const statusPage: StatusPage | null = await StatusPageService.findOneBy({
      query: {
        _id: objectId.toString(),
      },
      select: {
        _id: true,
        projectId: true,
        enableEmailSubscribers: true,
        enableSmsSubscribers: true,
        allowSubscribersToChooseResources: true,
        allowSubscribersToChooseEventTypes: true,
      },
      props: {
        isRoot: true,
      },
    });

    if (!statusPage) {
      throw new BadDataException("Status Page not found");
    }

    if (
      req.body.data["subscriberEmail"] &&
      !statusPage.enableEmailSubscribers
    ) {
      throw new BadDataException(
        "Email subscribers not enabled for this status page.",
      );
    }

    if (req.body.data["subscriberPhone"] && !statusPage.enableSmsSubscribers) {
      throw new BadDataException(
        "SMS subscribers not enabled for this status page.",
      );
    }

    // if no email or phone, throw error.

    if (
      !req.body.data["subscriberEmail"] &&
      !req.body.data["subscriberPhone"]
    ) {
      throw new BadDataException(
        "Email or phone is required to subscribe to this status page.",
      );
    }

    const email: Email | undefined = req.body.data["subscriberEmail"]
      ? new Email(req.body.data["subscriberEmail"] as string)
      : undefined;

    const phone: Phone | undefined = req.body.data["subscriberPhone"]
      ? new Phone(req.body.data["subscriberPhone"] as string)
      : undefined;

    let statusPageSubscriber: StatusPageSubscriber | null = null;

    let isUpdate: boolean = false;

    if (!req.params["subscriberId"]) {
      statusPageSubscriber = new StatusPageSubscriber();
    } else {
      const subscriberId: ObjectID = new ObjectID(
        req.params["subscriberId"] as string,
      );

      statusPageSubscriber = await StatusPageSubscriberService.findOneBy({
        query: {
          _id: subscriberId.toString(),
        },
        props: {
          isRoot: true,
        },
      });

      if (!statusPageSubscriber) {
        throw new BadDataException("Subscriber not found");
      }

      isUpdate = true;
    }

    if (email) {
      statusPageSubscriber.subscriberEmail = email;
    }

    if (phone) {
      statusPageSubscriber.subscriberPhone = phone;
    }

    if (
      req.body.data["statusPageResources"] &&
      !statusPage.allowSubscribersToChooseResources
    ) {
      throw new BadDataException(
        "Subscribers are not allowed to choose resources for this status page.",
      );
    }

    if (
      req.body.data["statusPageEventTypes"] &&
      !statusPage.allowSubscribersToChooseEventTypes
    ) {
      throw new BadDataException(
        "Subscribers are not allowed to choose event types for this status page.",
      );
    }

    statusPageSubscriber.statusPageId = objectId;
    statusPageSubscriber.sendYouHaveSubscribedMessage = true;
    statusPageSubscriber.projectId = statusPage.projectId!;
    statusPageSubscriber.isSubscribedToAllResources = Boolean(
      req.body.data["isSubscribedToAllResources"],
    );

    statusPageSubscriber.isSubscribedToAllEventTypes = Boolean(
      req.body.data["isSubscribedToAllEventTypes"],
    );

    if (
      req.body.data["statusPageResources"] &&
      req.body.data["statusPageResources"].length > 0
    ) {
      statusPageSubscriber.statusPageResources = req.body.data[
        "statusPageResources"
      ] as Array<StatusPageResource>;
    }

    if (
      req.body.data["statusPageEventTypes"] &&
      req.body.data["statusPageEventTypes"].length > 0
    ) {
      statusPageSubscriber.statusPageEventTypes = req.body.data[
        "statusPageEventTypes"
      ] as Array<StatusPageEventType>;
    }

    if (isUpdate) {
      // check isUnsubscribed is set to false.

      statusPageSubscriber.isUnsubscribed = Boolean(
        req.body.data["isUnsubscribed"],
      );

      await StatusPageSubscriberService.updateOneById({
        id: statusPageSubscriber.id!,
        data: {
          statusPageResources: statusPageSubscriber.statusPageResources!,
          isSubscribedToAllResources:
            statusPageSubscriber.isSubscribedToAllResources!,
          isUnsubscribed: statusPageSubscriber.isUnsubscribed,
        } as any,
        props: {
          isRoot: true,
        },
      });
    } else {
      await StatusPageSubscriberService.create({
        data: statusPageSubscriber,
        props: {
          isRoot: true,
        },
      });
    }
  }

  public async getSubscriber(
    req: ExpressRequest,
  ): Promise<StatusPageSubscriber> {
    const objectId: ObjectID = new ObjectID(
      req.params["statusPageId"] as string,
    );

    if (
      !(await this.service.hasReadAccess(
        objectId,
        await CommonAPI.getDatabaseCommonInteractionProps(req),
        req,
      ))
    ) {
      throw new NotAuthenticatedException(
        "You are not authenticated to access this status page",
      );
    }

    const statusPage: StatusPage | null = await StatusPageService.findOneBy({
      query: {
        _id: objectId.toString(),
      },
      select: {
        _id: true,
        projectId: true,
      },
      props: {
        isRoot: true,
      },
    });

    if (!statusPage) {
      throw new BadDataException("Status Page not found");
    }

    const subscriberId: ObjectID = new ObjectID(
      req.params["subscriberId"] as string,
    );

    const statusPageSubscriber: StatusPageSubscriber | null =
      await StatusPageSubscriberService.findOneBy({
        query: {
          _id: subscriberId.toString(),
          statusPageId: statusPage.id!,
        },
        select: {
          isUnsubscribed: true,
          subscriberEmail: true,
          subscriberPhone: true,
          statusPageId: true,
          statusPageResources: true,
          isSubscribedToAllResources: true,
        },
        props: {
          isRoot: true,
        },
      });

    if (!statusPageSubscriber) {
      throw new BadDataException("Subscriber not found");
    }

    return statusPageSubscriber;
  }

  public async getIncidents(
    statusPageId: ObjectID,
    incidentId: ObjectID | null,
    props: DatabaseCommonInteractionProps,
    req: ExpressRequest,
  ): Promise<JSONObject> {
    if (!(await this.service.hasReadAccess(statusPageId, props, req))) {
      throw new NotAuthenticatedException(
        "You are not authenticated to access this status page",
      );
    }

    const statusPage: StatusPage | null = await StatusPageService.findOneBy({
      query: {
        _id: statusPageId.toString(),
      },
      select: {
        _id: true,
        projectId: true,
        showIncidentHistoryInDays: true,
        showIncidentLabelsOnStatusPage: true,
      },
      props: {
        isRoot: true,
      },
    });

    if (!statusPage) {
      throw new BadDataException("Status Page not found");
    }

    // get monitors on status page.
    const statusPageResources: Array<StatusPageResource> =
      await StatusPageService.getStatusPageResources({
        statusPageId: statusPageId,
      });

    const { monitorsOnStatusPage, monitorsInGroup } =
      await StatusPageService.getMonitorIdsOnStatusPage({
        statusPageId: statusPageId,
      });

    const today: Date = OneUptimeDate.getCurrentDate();

    const historyDays: Date = OneUptimeDate.getSomeDaysAgo(
      statusPage.showIncidentHistoryInDays || 14,
    );

    let incidentQuery: Query<Incident> = {
      monitors: monitorsOnStatusPage as any,
      projectId: statusPage.projectId!,
      createdAt: QueryHelper.inBetween(historyDays, today),
    };

    if (incidentId) {
      incidentQuery = {
        monitors: monitorsOnStatusPage as any,
        projectId: statusPage.projectId!,
        _id: incidentId.toString(),
      };
    }

    // check if status page has active incident.
    let incidents: Array<Incident> = [];

    let selectIncidents: Select<Incident> = {
      createdAt: true,
      title: true,
      description: true,
      _id: true,
      incidentSeverity: {
        name: true,
        color: true,
      },
      currentIncidentState: {
        name: true,
        color: true,
        _id: true,
        order: true,
      },
      monitors: {
        _id: true,
      },
    };

    if (statusPage.showIncidentLabelsOnStatusPage) {
      selectIncidents = {
        ...selectIncidents,
        labels: {
          name: true,
          color: true,
        },
      };
    }

    if (monitorsOnStatusPage.length > 0) {
      incidents = await IncidentService.findBy({
        query: incidentQuery,
        select: selectIncidents,
        sort: {
          createdAt: SortOrder.Descending,
        },
        skip: 0,
        limit: LIMIT_PER_PROJECT,
        props: {
          isRoot: true,
        },
      });

      let activeIncidents: Array<Incident> = [];

      const unresolvedIncidentStates: Array<IncidentState> =
        await IncidentStateService.getUnresolvedIncidentStates(
          statusPage.projectId!,
          {
            isRoot: true,
          },
        );

      const unresolvbedIncidentStateIds: Array<ObjectID> =
        unresolvedIncidentStates.map((state: IncidentState) => {
          return state.id!;
        });

      // If there is no particular incident id to fetch then fetch active incidents.
      if (!incidentId) {
        activeIncidents = await IncidentService.findBy({
          query: {
            monitors: monitorsOnStatusPage as any,
            currentIncidentStateId: QueryHelper.any(
              unresolvbedIncidentStateIds,
            ),
            projectId: statusPage.projectId!,
          },
          select: selectIncidents,
          sort: {
            createdAt: SortOrder.Descending,
          },

          skip: 0,
          limit: LIMIT_PER_PROJECT,
          props: {
            isRoot: true,
          },
        });
      }

      incidents = [...activeIncidents, ...incidents];

      // get distinct by id.

      incidents = ArrayUtil.distinctByFieldName(incidents, "_id");
    }

    const incidentsOnStatusPage: Array<ObjectID> = incidents.map(
      (incident: Incident) => {
        return incident.id!;
      },
    );

    let incidentPublicNotes: Array<IncidentPublicNote> = [];

    if (incidentsOnStatusPage.length > 0) {
      incidentPublicNotes = await IncidentPublicNoteService.findBy({
        query: {
          incidentId: QueryHelper.any(incidentsOnStatusPage),
          projectId: statusPage.projectId!,
        },
        select: {
          postedAt: true,
          note: true,
          incidentId: true,
        },
        sort: {
          postedAt: SortOrder.Descending, // new note first
        },
        skip: 0,
        limit: LIMIT_PER_PROJECT,
        props: {
          isRoot: true,
        },
      });
    }

    let incidentStateTimelines: Array<IncidentStateTimeline> = [];

    if (incidentsOnStatusPage.length > 0) {
      incidentStateTimelines = await IncidentStateTimelineService.findBy({
        query: {
          incidentId: QueryHelper.any(incidentsOnStatusPage),
          projectId: statusPage.projectId!,
        },
        select: {
          _id: true,
          createdAt: true,
          incidentId: true,
          incidentState: {
            name: true,
            color: true,
          },
        },
        sort: {
          createdAt: SortOrder.Descending, // new note first
        },

        skip: 0,
        limit: LIMIT_PER_PROJECT,
        props: {
          isRoot: true,
        },
      });
    }

    // get all the incident states for this project.
    const incidentStates: Array<IncidentState> =
      await IncidentStateService.findBy({
        query: {
          projectId: statusPage.projectId!,
        },
        select: {
          isResolvedState: true,
          order: true,
        },
        limit: LIMIT_PER_PROJECT,
        skip: 0,
        props: {
          isRoot: true,
        },
      });

    const response: JSONObject = {
      incidentPublicNotes: BaseModel.toJSONArray(
        incidentPublicNotes,
        IncidentPublicNote,
      ),
      incidentStates: BaseModel.toJSONArray(incidentStates, IncidentState),
      incidents: BaseModel.toJSONArray(incidents, Incident),
      statusPageResources: BaseModel.toJSONArray(
        statusPageResources,
        StatusPageResource,
      ),
      incidentStateTimelines: BaseModel.toJSONArray(
        incidentStateTimelines,
        IncidentStateTimeline,
      ),
      monitorsInGroup: JSONFunctions.serialize(monitorsInGroup),
    };

    return response;
  }

  public getOverallMonitorStatus(
    statusPageResources: Array<StatusPageResource>,
    monitorStatuses: Array<MonitorStatus>,
    monitorGroupCurrentStatuses: Dictionary<ObjectID>,
  ): MonitorStatus | null {
    let currentStatus: MonitorStatus | null =
      monitorStatuses.length > 0 && monitorStatuses[0]
        ? monitorStatuses[0]
        : null;

    const dict: Dictionary<number> = {};

    for (const resource of statusPageResources) {
      if (resource.monitor?.currentMonitorStatusId) {
        if (
          !Object.keys(dict).includes(
            resource.monitor?.currentMonitorStatusId.toString() || "",
          )
        ) {
          dict[resource.monitor?.currentMonitorStatusId?.toString()] = 1;
        } else {
          dict[resource.monitor!.currentMonitorStatusId!.toString()]!++;
        }
      }
    }

    // check status of monitor groups.

    for (const groupId in monitorGroupCurrentStatuses) {
      const statusId: ObjectID | undefined =
        monitorGroupCurrentStatuses[groupId];

      if (statusId) {
        if (!Object.keys(dict).includes(statusId.toString() || "")) {
          dict[statusId.toString()] = 1;
        } else {
          dict[statusId.toString()]!++;
        }
      }
    }

    for (const monitorStatus of monitorStatuses) {
      if (monitorStatus._id && dict[monitorStatus._id]) {
        currentStatus = monitorStatus;
      }
    }

    return currentStatus;
  }
}
