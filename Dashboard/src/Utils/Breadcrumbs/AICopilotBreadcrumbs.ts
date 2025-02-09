import PageMap from "../PageMap";
import { BuildBreadcrumbLinksByTitles } from "./Helper";
import Dictionary from "Common/Types/Dictionary";
import Link from "Common/Types/Link";

export function getCodeRepositoryBreadcrumbs(
  path: string,
): Array<Link> | undefined {
  const breadcrumpLinksMap: Dictionary<Link[]> = {
    ...BuildBreadcrumbLinksByTitles(PageMap.AI_COPILOT_CODE_REPOSITORY_VIEW, [
      "Project",
      "Reliability Copilot",
      "View Git Repository",
    ]),
    ...BuildBreadcrumbLinksByTitles(
      PageMap.AI_COPILOT_CODE_REPOSITORY_VIEW_DELETE,
      [
        "Project",
        "Reliability Copilot",
        "View Git Repository",
        "Delete Repository",
      ],
    ),
    ...BuildBreadcrumbLinksByTitles(
      PageMap.AI_COPILOT_CODE_REPOSITORY_VIEW_ACTIONS_IN_QUEUE,
      ["Project", "Reliability Copilot", "View Git Repository", "In Queue"],
    ),
    ...BuildBreadcrumbLinksByTitles(
      PageMap.AI_COPILOT_CODE_REPOSITORY_VIEW_ACTIONS_PROCESSED,
      ["Project", "Reliability Copilot", "View Git Repository", "Processed"],
    ),
    ...BuildBreadcrumbLinksByTitles(
      PageMap.AI_COPILOT_CODE_REPOSITORY_VIEW_DOCUMENTATION,
      [
        "Project",
        "Reliability Copilot",
        "View Git Repository",
        "Documentation",
      ],
    ),
    ...BuildBreadcrumbLinksByTitles(
      PageMap.AI_COPILOT_CODE_REPOSITORY_VIEW_SETTINGS,
      ["Project", "Reliability Copilot", "View Git Repository", "Settings"],
    ),
    ...BuildBreadcrumbLinksByTitles(
      PageMap.AI_COPILOT_CODE_REPOSITORY_VIEW_ACTION_TYPES,
      ["Project", "Reliability Copilot", "View Git Repository", "Priorities"],
    ),
    ...BuildBreadcrumbLinksByTitles(
      PageMap.AI_COPILOT_CODE_REPOSITORY_VIEW_SERVICES,
      ["Project", "Reliability Copilot", "View Git Repository", "Services"],
    ),
  };
  return breadcrumpLinksMap[path];
}
