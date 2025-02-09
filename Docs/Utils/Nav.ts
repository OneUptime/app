import { IsBillingEnabled } from "Common/Server/EnvironmentConfig";

export interface NavLink {
  title: string;
  url: string;
}

// Define an interface for a navigation group
export interface NavGroup {
  title: string;
  links: NavLink[];
}

// Define an array of navigation groups
const DocsNav: NavGroup[] = [
  {
    title: "Introduction",
    links: [
      {
        title: "Getting Started",
        url: "/docs/introduction/getting-started",
      },
    ],
  },
  {
    title: "Installation",
    links: [
      {
        title: "Local Development",
        url: "/docs/installation/local-development",
      },
      {
        title: "Docker Compose",
        url: "/docs/installation/docker-compose",
      },
      {
        title: "Kubernetes and Helm",
        url: "https://artifacthub.io/packages/helm/oneuptime/oneuptime",
      },
    ],
  },
  {
    title: "Configuration",
    links: [
      {
        title: "IP Addresses",
        url: "/docs/configuration/ip-addresses",
      },
    ],
  },
  {
    title: "Monitor",
    links: [
      {
        title: "Custom Code Monitor",
        url: "/docs/monitor/custom-code-monitor",
      },
      {
        title: "Synthetic Monitor",
        url: "/docs/monitor/synthetic-monitor",
      },
      {
        title: "JavaScript Expressions",
        url: "/docs/monitor/javascript-expression",
      },
      {
        title: "Monitor Secrets",
        url: "/docs/monitor/monitor-secrets",
      },
    ],
  },
  {
    title: "Status Pages",
    links: [
      {
        title: "Public API",
        url: "/docs/status-pages/public-api",
      },
    ],
  },
  {
    title: "Probe",
    links: [{ title: "Custom Probes", url: "/docs/probe/custom-probe" }],
  },
  {
    title: "Telemetry",
    links: [
      { title: "OpenTelemetry", url: "/docs/telemetry/open-telemetry" },
      { title: "FluentBit", url: "/docs/telemetry/fluentbit" },
      { title: "Fluentd", url: "/docs/telemetry/fluentd" },
    ],
  },
  {
    title: "Copilot",
    links: [
      { title: "Installation", url: "/docs/copilot/introduction" },
      { title: "Deploy LLM Server", url: "/docs/copilot/deploy-llm-server" },
    ],
  },
];

// Is self hosted install, then...
if (!IsBillingEnabled) {
  DocsNav.push({
    title: "Self Hosted",
    links: [
      {
        title: "Slack Integration",
        url: "/docs/self-hosted/slack-integration",
      },
    ],
  });
}

// Export the array of navigation groups
export default DocsNav;
