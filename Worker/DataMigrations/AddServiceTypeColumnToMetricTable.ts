import DataMigrationBase from "./DataMigrationBase";
import AnalyticsTableColumn from "Common/Types/AnalyticsDatabase/TableColumn";
import TableColumnType from "Common/Types/AnalyticsDatabase/TableColumnType";
import MetricService from "Common/Server/Services/MetricService";
import Metric from "Common/Models/AnalyticsModels/Metric";

export default class AddServiceTypeColumnToMetricsTable extends DataMigrationBase {
  public constructor() {
    super("AddServiceTypeColumnToMetricsTable");
  }

  public override async migrate(): Promise<void> {
    await this.dropAndCreateColumn("serviceType");
  }

  public async dropAndCreateColumn(columnName: string): Promise<void> {
    const column: AnalyticsTableColumn | undefined =
      new Metric().tableColumns.find((column: AnalyticsTableColumn) => {
        return column.key === columnName;
      });

    if (!column) {
      return;
    }

    const columnType: TableColumnType | null =
      await MetricService.getColumnTypeInDatabase(column);

    if (columnType) {
      await MetricService.dropColumnInDatabase(columnName);
    }

    await MetricService.addColumnInDatabase(column);
  }

  public override async rollback(): Promise<void> {
    return;
  }
}
