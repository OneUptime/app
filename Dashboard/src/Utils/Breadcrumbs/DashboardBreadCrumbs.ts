import PageMap from "../PageMap";
import { BuildBreadcrumbLinksByTitles } from "./Helper";
import Dictionary from "Common/Types/Dictionary";
import Link from "Common/Types/Link";

export function getDashboardBreadcrumbs(path: string): Array<Link> | undefined {
  const breadcrumpLinksMap: Dictionary<Link[]> = {
    ...BuildBreadcrumbLinksByTitles(PageMap.DASHBOARD_VIEW, [
      "Project",
      "Dashboards",
      "View Dashboard",
    ]),
    ...BuildBreadcrumbLinksByTitles(PageMap.DASHBOARD_VIEW_DELETE, [
      "Project",
      "Dashboards",
      "View Dashboard",
      "Delete Dashboard",
    ]),

    ...BuildBreadcrumbLinksByTitles(PageMap.DASHBOARD_VIEW_SETTINGS, [
      "Project",
      "Dashboards",
      "View Dashboard",
      "Settings",
    ]),
    ...BuildBreadcrumbLinksByTitles(PageMap.DASHBOARD_VIEW_OVERVIEW, [
      "Project",
      "Dashboards",
      "View Dashboard",
      "Overview",
    ]),
  };
  return breadcrumpLinksMap[path];
}
