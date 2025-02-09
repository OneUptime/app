import ScheduledMaintenancesTable from "../../Components/ScheduledMaintenance/ScheduledMaintenanceTable";
import PageComponentProps from "../PageComponentProps";
import ObjectID from "Common/Types/ObjectID";
import Navigation from "Common/UI/Utils/Navigation";
import React, { FunctionComponent, ReactElement } from "react";
import { useParams } from "react-router-dom";

const ScheduledMaintenancesPage: FunctionComponent<
  PageComponentProps
> = (): ReactElement => {
  const { projectId } = useParams();
  const projectObjectId: ObjectID = new ObjectID(projectId || "");
  return (
    <ScheduledMaintenancesTable
      viewPageRoute={Navigation.getCurrentRoute()}
      query={{
        projectId: projectObjectId,
      }}
      saveFilterProps={{
        tableId: "all-incidents-table",
      }}
    />
  );
};

export default ScheduledMaintenancesPage;
