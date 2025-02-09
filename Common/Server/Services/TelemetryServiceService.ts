import CreateBy from "../Types/Database/CreateBy";
import { OnCreate } from "../Types/Database/Hooks";
import DatabaseService from "./DatabaseService";
import ArrayUtil from "../../Utils/Array";
import { BrightColors } from "../../Types/BrandColors";
import BadDataException from "../../Types/Exception/BadDataException";
import ObjectID from "../../Types/ObjectID";
import Model from "Common/Models/DatabaseModels/TelemetryService";

export class Service extends DatabaseService<Model> {
  public constructor() {
    super(Model);
  }

  protected override async onBeforeCreate(
    createBy: CreateBy<Model>,
  ): Promise<OnCreate<Model>> {
    createBy.data.telemetryServiceToken = ObjectID.generate();

    // select a random color.
    createBy.data.serviceColor = ArrayUtil.selectItemByRandom(BrightColors);

    return {
      carryForward: null,
      createBy: createBy,
    };
  }

  public async getTelemetryDataRetentionInDays(
    telemetryServiceId: ObjectID,
  ): Promise<number> {
    const project: Model | null = await this.findOneById({
      id: telemetryServiceId,
      select: {
        retainTelemetryDataForDays: true,
      },
      props: {
        isRoot: true,
      },
    });

    if (!project) {
      throw new BadDataException("Project not found");
    }

    return project.retainTelemetryDataForDays || 15; // default is 15 days.
  }
}

export default new Service();
