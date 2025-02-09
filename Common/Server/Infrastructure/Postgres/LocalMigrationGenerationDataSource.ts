import dataSourceOptions from "./DataSourceOptions";
import { DataSource } from "typeorm";

const dataSourceOptionToMigrate: any = {
  ...dataSourceOptions,
  host: "localhost",
  port: 5400,
};

const PostgresDataSource: DataSource = new DataSource(
  dataSourceOptionToMigrate,
);

export default PostgresDataSource;
