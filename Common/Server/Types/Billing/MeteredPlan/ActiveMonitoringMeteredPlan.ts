import BillingService from "../../../Services/BillingService";
import MonitorService from "../../../Services/MonitorService";
import ProjectService from "../../../Services/ProjectService";
import QueryHelper from "../../Database/QueryHelper";
import ServerMeteredPlan from "./ServerMeteredPlan";
import ProductType from "Common/Types/MeteredPlan/ProductType";
import MonitorType from "Common/Types/Monitor/MonitorType";
import ObjectID from "Common/Types/ObjectID";
import PositiveNumber from "Common/Types/PositiveNumber";
import Project from "Common/Models/DatabaseModels/Project";

export default class ActiveMonitoringMeteredPlan extends ServerMeteredPlan {
  public override getProductType(): ProductType {
    return ProductType.ActiveMonitoring;
  }

  public override async reportQuantityToBillingProvider(
    projectId: ObjectID,
    options?: {
      meteredPlanSubscriptionId?: string | undefined;
    },
  ): Promise<void> {
    const count: PositiveNumber = await MonitorService.countBy({
      query: {
        projectId: projectId,
        monitorType: QueryHelper.notEquals(MonitorType.Manual),
      },
      props: {
        isRoot: true,
      },
    });

    // update this count in project as well.
    await ProjectService.updateOneById({
      id: projectId,
      data: {
        currentActiveMonitorsCount: count.toNumber(),
      },
      props: {
        isRoot: true,
      },
    });

    // update this count in project as well.
    const project: Project | null = await ProjectService.findOneById({
      id: projectId,
      select: {
        paymentProviderMeteredSubscriptionId: true,
        paymentProviderPlanId: true,
      },
      props: {
        isRoot: true,
      },
    });

    if (
      project &&
      (options?.meteredPlanSubscriptionId ||
        project.paymentProviderMeteredSubscriptionId) &&
      project.paymentProviderPlanId
    ) {
      await BillingService.addOrUpdateMeteredPricingOnSubscription(
        (options?.meteredPlanSubscriptionId as string) ||
          (project.paymentProviderMeteredSubscriptionId as string),
        this,
        count.toNumber(),
      );
    }
  }
}
