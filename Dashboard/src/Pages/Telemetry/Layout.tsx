import { getTelemetryBreadcrumbs } from "../../Utils/Breadcrumbs";
import PageMap from "../../Utils/PageMap";
import RouteMap, { RouteUtil } from "../../Utils/RouteMap";
import PageComponentProps from "../PageComponentProps";
import SideMenu from "./SideMenu";
import Page from "Common/UI/Components/Page/Page";
import Navigation from "Common/UI/Utils/Navigation";
import React, { FunctionComponent, ReactElement } from "react";
import { Outlet } from "react-router-dom";

const TelemetryLayout: FunctionComponent<
  PageComponentProps
> = (): ReactElement => {
  const path: string = Navigation.getRoutePath(RouteUtil.getRoutes());

  if (path.endsWith("telemetry") || path.endsWith("telemetry/*")) {
    Navigation.navigate(
      RouteUtil.populateRouteParams(RouteMap[PageMap.TELEMETRY_SERVICES]!),
    );

    return <></>;
  }

  return (
    <Page
      title="Telemetry & APM"
      breadcrumbLinks={getTelemetryBreadcrumbs(path)}
      sideMenu={<SideMenu />}
    >
      <Outlet />
    </Page>
  );
};

export default TelemetryLayout;
