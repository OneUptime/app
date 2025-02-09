import { Blue500 } from "../../Types/BrandColors";
import Color from "../../Types/Color";
import OneUptimeDate from "../../Types/Date";
import BadDataException from "../../Types/Exception/BadDataException";
import ObjectID from "../../Types/ObjectID";
import { IsBillingEnabled } from "../EnvironmentConfig";
import logger from "../Utils/Logger";
import DatabaseService from "./DatabaseService";
import IncidentFeed, {
  IncidentFeedEventType,
} from "Common/Models/DatabaseModels/IncidentFeed";

export class Service extends DatabaseService<IncidentFeed> {
  public constructor() {
    super(IncidentFeed);

    if (IsBillingEnabled) {
      this.hardDeleteItemsOlderThanInDays("createdAt", 120);
    }
  }

  public async createIncidentFeed(data: {
    incidentId: ObjectID;
    feedInfoInMarkdown: string;
    incidentFeedEventType: IncidentFeedEventType;
    projectId: ObjectID;
    moreInformationInMarkdown?: string | undefined;
    displayColor?: Color | undefined;
    userId?: ObjectID | undefined;
    postedAt?: Date | undefined;
  }): Promise<void> {
    try {
      logger.debug("IncidentFeedService.createIncidentFeed");
      logger.debug(data);

      const incidentFeed: IncidentFeed = new IncidentFeed();

      if (!data.incidentId) {
        throw new BadDataException("Incident ID is required");
      }

      if (!data.feedInfoInMarkdown) {
        throw new BadDataException("Log in markdown is required");
      }

      if (!data.incidentFeedEventType) {
        throw new BadDataException("Incident log event is required");
      }

      if (!data.projectId) {
        throw new BadDataException("Project ID is required");
      }

      if (!data.displayColor) {
        data.displayColor = Blue500;
      }

      incidentFeed.displayColor = data.displayColor;
      incidentFeed.incidentId = data.incidentId;
      incidentFeed.feedInfoInMarkdown = data.feedInfoInMarkdown;
      incidentFeed.incidentFeedEventType = data.incidentFeedEventType;
      incidentFeed.projectId = data.projectId;

      if (!data.postedAt) {
        incidentFeed.postedAt = OneUptimeDate.getCurrentDate();
      }

      if (data.userId) {
        incidentFeed.userId = data.userId;
      }

      if (data.moreInformationInMarkdown) {
        incidentFeed.moreInformationInMarkdown = data.moreInformationInMarkdown;
      }

      const createdIncidentFeed: IncidentFeed = await this.create({
        data: incidentFeed,
        props: {
          isRoot: true,
        },
      });

      logger.debug("Incident Feed created");
      logger.debug(createdIncidentFeed);
    } catch (e) {
      logger.error("Error in creating incident feed");
      logger.error(e);

      // we dont throw this error as it is not a critical error
    }
  }
}

export default new Service();
