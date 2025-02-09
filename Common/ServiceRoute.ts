import Route from "./Types/API/Route";

export const HomeRoute: Route = new Route("/");

export const AppApiRoute: Route = new Route("/api");

export const IdentityRoute: Route = new Route("/identity");

export const FileRoute: Route = new Route("/file");

export const StatusPageRoute: Route = new Route("/status-page");

export const LinkShortenerRoute: Route = new Route("/l");

export const DashboardRoute: Route = new Route("/dashboard");

export const IntegrationRoute: Route = new Route("/integration");

export const NotificationRoute: Route = new Route("/notification");

export const AccountsRoute: Route = new Route("/accounts");

export const WorkflowRoute: Route = new Route("/workflow");

export const ApiReferenceRoute: Route = new Route("/reference");

export const AdminDashboardRoute: Route = new Route("/admin");

export const ProbeIngestRoute: Route = new Route("/probe-ingest");

export const OpenTelemetryIngestRoute: Route = new Route(
  "/open-telemetry-ingest",
);

export const IncomingRequestIngestRoute: Route = new Route(
  "/incoming-request-ingest",
);

export const FluentIngestRoute: Route = new Route("/fluent-ingest");

export const RealtimeRoute: Route = new Route("/realtime/socket");

export const DocsRoute: Route = new Route("/docs");

export const StatusPageApiRoute: Route = new Route("/status-page-api");
