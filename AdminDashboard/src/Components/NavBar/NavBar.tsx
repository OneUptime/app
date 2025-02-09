import PageMap from "../../Utils/PageMap";
import RouteMap, { RouteUtil } from "../../Utils/RouteMap";
import Route from "Common/Types/API/Route";
import IconProp from "Common/Types/Icon/IconProp";
import NavBar from "Common/UI/Components/Navbar/NavBar";
import NavBarItem from "Common/UI/Components/Navbar/NavBarItem";
import React, { FunctionComponent, ReactElement } from "react";

const DashboardNavbar: FunctionComponent = (): ReactElement => {
  return (
    <NavBar>
      <NavBarItem
        title="Users"
        icon={IconProp.User}
        route={RouteUtil.populateRouteParams(RouteMap[PageMap.USERS] as Route)}
      ></NavBarItem>

      <NavBarItem
        title="Projects"
        icon={IconProp.Folder}
        route={RouteUtil.populateRouteParams(
          RouteMap[PageMap.PROJECTS] as Route,
        )}
      ></NavBarItem>

      <NavBarItem
        title="Settings"
        icon={IconProp.Settings}
        route={RouteUtil.populateRouteParams(
          RouteMap[PageMap.SETTINGS] as Route,
        )}
      ></NavBarItem>
    </NavBar>
  );
};

export default DashboardNavbar;
