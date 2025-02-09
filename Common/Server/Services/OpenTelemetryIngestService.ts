import OneUptimeDate from "Common/Types/Date";
import { JSONArray, JSONObject } from "Common/Types/JSON";
import JSONFunctions from "Common/Types/JSONFunctions";
import ObjectID from "Common/Types/ObjectID";
import Metric, {
  AggregationTemporality,
} from "Common/Models/AnalyticsModels/Metric";
import Dictionary from "Common/Types/Dictionary";
import ProductType from "Common/Types/MeteredPlan/ProductType";
import { IsBillingEnabled } from "Common/Server/EnvironmentConfig";
import TelemetryUsageBillingService from "Common/Server/Services/TelemetryUsageBillingService";
import logger from "Common/Server/Utils/Logger";
import TelemetryService from "Common/Models/DatabaseModels/TelemetryService";
import TelemetryServiceService from "Common/Server/Services/TelemetryServiceService";
import { DEFAULT_RETENTION_IN_DAYS } from "Common/Models/DatabaseModels/TelemetryUsageBilling";
import TelemetryUtil from "Common/Server/Utils/Telemetry/Telemetry";

export enum OtelAggregationTemporality {
  Cumulative = "AGGREGATION_TEMPORALITY_CUMULATIVE",
  Delta = "AGGREGATION_TEMPORALITY_DELTA",
}

export interface TelemetryServiceDataIngested {
  serviceName: string;
  serviceId: ObjectID;
  dataIngestedInGB: number;
  dataRententionInDays: number;
}

export default class OTelIngestService {
  public static async telemetryServiceFromName(data: {
    serviceName: string;
    projectId: ObjectID;
  }): Promise<{
    serviceId: ObjectID;
    dataRententionInDays: number;
  }> {
    const service: TelemetryService | null =
      await TelemetryServiceService.findOneBy({
        query: {
          projectId: data.projectId,
          name: data.serviceName,
        },
        select: {
          _id: true,
          retainTelemetryDataForDays: true,
        },
        props: {
          isRoot: true,
        },
      });

    if (!service) {
      // create service

      const newService: TelemetryService = new TelemetryService();
      newService.projectId = data.projectId;
      newService.name = data.serviceName;
      newService.description = data.serviceName;
      newService.retainTelemetryDataForDays = DEFAULT_RETENTION_IN_DAYS;

      const createdService: TelemetryService =
        await TelemetryServiceService.create({
          data: newService,
          props: {
            isRoot: true,
          },
        });

      return {
        serviceId: createdService.id!,
        dataRententionInDays: DEFAULT_RETENTION_IN_DAYS,
      };
    }

    return {
      serviceId: service.id!,
      dataRententionInDays:
        service.retainTelemetryDataForDays || DEFAULT_RETENTION_IN_DAYS,
    };
  }

  public static async recordDataIngestedUsgaeBilling(data: {
    services: Dictionary<TelemetryServiceDataIngested>;
    projectId: ObjectID;
    productType: ProductType;
  }): Promise<void> {
    if (!IsBillingEnabled) {
      return;
    }

    for (const serviceName in data.services) {
      const serviceData: TelemetryServiceDataIngested | undefined =
        data.services[serviceName];

      if (!serviceData) {
        continue;
      }

      TelemetryUsageBillingService.updateUsageBilling({
        projectId: data.projectId,
        productType: data.productType,
        dataIngestedInGB: serviceData.dataIngestedInGB || 0,
        telemetryServiceId: serviceData.serviceId,
        retentionInDays: serviceData.dataRententionInDays,
      }).catch((err: Error) => {
        logger.error("Failed to update usage billing for OTel");
        logger.error(err);
      });
    }
  }

  public static getMetricFromDatapoint(data: {
    dbMetric: Metric;
    datapoint: JSONObject;
    aggregationTemporality: OtelAggregationTemporality;
    isMonotonic: boolean | undefined;
    telemetryServiceId: ObjectID;
    telemetryServiceName: string;
  }): Metric {
    const { dbMetric, datapoint, aggregationTemporality, isMonotonic } = data;

    const newDbMetric: Metric = Metric.fromJSON(
      dbMetric.toJSON(),
      Metric,
    ) as Metric;

    newDbMetric.startTimeUnixNano = datapoint["startTimeUnixNano"] as number;
    newDbMetric.startTime = OneUptimeDate.fromUnixNano(
      datapoint["startTimeUnixNano"] as number,
    );

    newDbMetric.timeUnixNano = datapoint["timeUnixNano"] as number;
    newDbMetric.time = OneUptimeDate.fromUnixNano(
      datapoint["timeUnixNano"] as number,
    );

    if (Object.keys(datapoint).includes("asInt")) {
      newDbMetric.value = datapoint["asInt"] as number;
    } else if (Object.keys(datapoint).includes("asDouble")) {
      newDbMetric.value = datapoint["asDouble"] as number;
    }

    newDbMetric.count = datapoint["count"] as number;
    newDbMetric.sum = datapoint["sum"] as number;

    newDbMetric.min = datapoint["min"] as number;
    newDbMetric.max = datapoint["max"] as number;

    newDbMetric.bucketCounts = datapoint["bucketCounts"] as Array<number>;
    newDbMetric.explicitBounds = datapoint["explicitBounds"] as Array<number>;

    if (!newDbMetric.value) {
      newDbMetric.value = newDbMetric.sum;
    }

    // attrbutes

    if (Object.keys(datapoint).includes("attributes")) {
      if (!newDbMetric.attributes) {
        newDbMetric.attributes = {};
      }

      newDbMetric.attributes = {
        ...(newDbMetric.attributes || {}),
        ...TelemetryUtil.getAttributes({
          items: datapoint["attributes"] as JSONArray,
          telemetryServiceId: data.telemetryServiceId,
          telemetryServiceName: data.telemetryServiceName,
        }),
      };
    }

    if (newDbMetric.attributes) {
      newDbMetric.attributes = JSONFunctions.flattenObject(
        newDbMetric.attributes,
      );
    }

    // aggregationTemporality

    if (aggregationTemporality) {
      if (aggregationTemporality === OtelAggregationTemporality.Cumulative) {
        newDbMetric.aggregationTemporality = AggregationTemporality.Cumulative;
      }

      if (aggregationTemporality === OtelAggregationTemporality.Delta) {
        newDbMetric.aggregationTemporality = AggregationTemporality.Delta;
      }
    }

    if (isMonotonic !== undefined) {
      newDbMetric.isMonotonic = isMonotonic;
    }

    return newDbMetric;
  }
}
