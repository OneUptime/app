import AggregatedModel from "../BaseDatabase/AggregatedModel";
import MetricAliasData from "./MetricAliasData";
import MetricQueryData from "./MetricQueryData";

export interface ChartSeries {
  title: string;
}

export default interface MetricQueryConfigData {
  metricAliasData?: MetricAliasData | undefined;
  metricQueryData: MetricQueryData;
  getSeries?: ((data: AggregatedModel) => ChartSeries) | undefined;
}
