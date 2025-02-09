import { getServiceCatalogBreadcrumbs } from "../../../Utils/Breadcrumbs";
import { RouteUtil } from "../../../Utils/RouteMap";
import PageComponentProps from "../../PageComponentProps";
import SideMenu from "./SideMenu";
import ObjectID from "Common/Types/ObjectID";
import ModelPage from "Common/UI/Components/Page/ModelPage";
import Navigation from "Common/UI/Utils/Navigation";
import ServiceCatalog from "Common/Models/DatabaseModels/ServiceCatalog";
import React, { FunctionComponent, ReactElement } from "react";
import { Outlet, useParams } from "react-router-dom";

const ServiceCatalogViewLayout: FunctionComponent<
  PageComponentProps
> = (): ReactElement => {
  const { id } = useParams();
  const modelId: ObjectID = new ObjectID(id || "");
  const path: string = Navigation.getRoutePath(RouteUtil.getRoutes());
  return (
    <ModelPage
      title="Service"
      modelType={ServiceCatalog}
      modelId={modelId}
      modelNameField="name"
      breadcrumbLinks={getServiceCatalogBreadcrumbs(path)}
      sideMenu={<SideMenu modelId={modelId} />}
    >
      <Outlet />
    </ModelPage>
  );
};

export default ServiceCatalogViewLayout;
