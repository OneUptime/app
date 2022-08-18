import React, { FunctionComponent, useState } from 'react';
import Route from 'Common/Types/API/Route';
import {
    Routes,
    Route as PageRoute,
    useNavigate,
    useLocation,
    useParams,
} from 'react-router-dom';
import MasterPage from './Components/MasterPage/MasterPage';
// Pages
import Init from './Pages/Init/Init';
import Home from './Pages/Home/Home';
import useAsyncEffect from 'use-async-effect';
import StatusPages from './Pages/StatusPages/StatusPages';
import Incidents from './Pages/Incidents/Incidents';
import Logs from './Pages/Logs/Logs';
import Navigation from 'CommonUI/src/Utils/Navigation';
import RouteMap from './Utils/RouteMap';
import PageMap from './Utils/PageMap';
import { ACCOUNTS_URL } from 'CommonUI/src/Config';
// Settings Pages
import ProjectSettings from './Pages/Settings/ProjectSettings';
import SettingsDangerZone from './Pages/Settings/DangerZone';
import SettingsApiKeys from './Pages/Settings/APIKeys';
import SettingsApiKeyView from './Pages/Settings/APIKeyView';
import SettingLabels from './Pages/Settings/Labels';
import SettingCustomSMTP from './Pages/Settings/CustomSMTP';
import SettingsTeams from './Pages/Settings/Teams';
import SettingsTeamView from './Pages/Settings/TeamView';
import SettingsMonitors from './Pages/Settings/Monitors';
import SettingsIncidents from './Pages/Settings/Incidents';

// On Call Duty
import OnCallDutyPage from './Pages/OnCallDuty/OnCallDuties';

// Monitors
import MonitorPage from './Pages/Monitor/Monitors';

// Import CSS
import 'CommonUI/src/Styles/theme.scss';
import User from 'CommonUI/src/Utils/User';
import Logout from './Pages/Logout/Logout';
import ModelAPI, { ListResult } from 'CommonUI/src/Utils/ModelAPI/ModelAPI';
import Project from 'Model/Models/Project';
import HTTPErrorResponse from 'Common/Types/API/HTTPErrorResponse';
import { JSONObject } from 'Common/Types/JSON';

const App: FunctionComponent = () => {
    Navigation.setNavigateHook(useNavigate());
    Navigation.setLocation(useLocation());
    Navigation.setParams(useParams());

    if (!User.isLoggedIn()) {
        Navigation.navigate(ACCOUNTS_URL);
    }

    const [isLoading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [projects, setProjects] = useState<Array<Project>>([]);

    const [selectedProject, setSelectedProject] = useState<Project | null>(
        null
    );

    const onProjectSelected: (project: Project) => void = (
        project: Project
    ): void => {
        setSelectedProject(project);
        Navigation.navigate(new Route('/dashboard/' + project._id));
    };

    const fetchProjects: Function = async (): Promise<void> => {
        setLoading(true);

        // get list of projects.
        try {
            const result: ListResult<Project> = await ModelAPI.getList<Project>(
                Project,
                {},
                50,
                0,
                {
                    name: true,
                    _id: true,
                },
                {},
                {},
                {
                    isMultiTenantRequest: true,
                }
            );
            setProjects(result.data);
        } catch (err) {
            setError(
                ((err as HTTPErrorResponse).data as JSONObject)[
                    'error'
                ] as string
            );
        }

        setLoading(false);
    };

    useAsyncEffect(async () => {
        fetchProjects();
    }, []);

    return (
        <MasterPage
            isLoading={isLoading}
            projects={projects}
            error={error}
            onProjectSelected={onProjectSelected}
            onProjectRequestAccepted={() => {
                fetchProjects();
            }}
        >
            <Routes>
                <PageRoute
                    path={RouteMap[PageMap.INIT]?.toString()}
                    element={
                        <Init
                            pageRoute={RouteMap[PageMap.INIT] as Route}
                            currentProject={selectedProject}
                        />
                    }
                />
                <PageRoute
                    path={RouteMap[PageMap.HOME]?.toString()}
                    element={
                        <Home
                            pageRoute={RouteMap[PageMap.HOME] as Route}
                            currentProject={selectedProject}
                        />
                    }
                />

                {/* Monitors */}
                <PageRoute
                    path={RouteMap[PageMap.MONITORS]?.toString()}
                    element={
                        <MonitorPage
                            pageRoute={RouteMap[PageMap.MONITORS] as Route}
                            currentProject={selectedProject}
                        />
                    }
                />

                {/* Status Pages */}

                <PageRoute
                    path={RouteMap[PageMap.STATUS_PAGE]?.toString()}
                    element={
                        <StatusPages
                            pageRoute={RouteMap[PageMap.STATUS_PAGE] as Route}
                            currentProject={selectedProject}
                        />
                    }
                />

                <PageRoute
                    path={RouteMap[PageMap.INCIDENTS]?.toString()}
                    element={
                        <Incidents
                            pageRoute={RouteMap[PageMap.INCIDENTS] as Route}
                            currentProject={selectedProject}
                        />
                    }
                />
                <PageRoute
                    path={RouteMap[PageMap.LOGS]?.toString()}
                    element={
                        <Logs
                            pageRoute={RouteMap[PageMap.LOGS] as Route}
                            currentProject={selectedProject}
                        />
                    }
                />

                {/* Settings Routes */}

                <PageRoute
                    path={RouteMap[PageMap.SETTINGS]?.toString()}
                    element={
                        <ProjectSettings
                            pageRoute={RouteMap[PageMap.SETTINGS] as Route}
                            currentProject={selectedProject}
                        />
                    }
                />

                <PageRoute
                    path={RouteMap[PageMap.SETTINGS_DANGERZONE]?.toString()}
                    element={
                        <SettingsDangerZone
                            pageRoute={
                                RouteMap[PageMap.SETTINGS_DANGERZONE] as Route
                            }
                            currentProject={selectedProject}
                        />
                    }
                />

                <PageRoute
                    path={RouteMap[PageMap.SETTINGS_MONITORS]?.toString()}
                    element={
                        <SettingsMonitors
                            pageRoute={
                                RouteMap[PageMap.SETTINGS_MONITORS] as Route
                            }
                            currentProject={selectedProject}
                        />
                    }
                />

                <PageRoute
                    path={RouteMap[PageMap.SETTINGS_INCIDENTS]?.toString()}
                    element={
                        <SettingsIncidents
                            pageRoute={
                                RouteMap[PageMap.SETTINGS_INCIDENTS] as Route
                            }
                            currentProject={selectedProject}
                        />
                    }
                />

                <PageRoute
                    path={RouteMap[PageMap.SETTINGS_CUSTOM_SMTP]?.toString()}
                    element={
                        <SettingCustomSMTP
                            pageRoute={
                                RouteMap[PageMap.SETTINGS_CUSTOM_SMTP] as Route
                            }
                            currentProject={selectedProject}
                        />
                    }
                />

                <PageRoute
                    path={RouteMap[PageMap.SETTINGS_APIKEYS]?.toString()}
                    element={
                        <SettingsApiKeys
                            pageRoute={
                                RouteMap[PageMap.SETTINGS_APIKEYS] as Route
                            }
                            currentProject={selectedProject}
                        />
                    }
                />

                <PageRoute
                    path={RouteMap[PageMap.SETTINGS_APIKEY_VIEW]?.toString()}
                    element={
                        <SettingsApiKeyView
                            pageRoute={
                                RouteMap[PageMap.SETTINGS_APIKEY_VIEW] as Route
                            }
                            currentProject={selectedProject}
                        />
                    }
                />

                <PageRoute
                    path={RouteMap[PageMap.SETTINGS_LABELS]?.toString()}
                    element={
                        <SettingLabels
                            pageRoute={
                                RouteMap[PageMap.SETTINGS_LABELS] as Route
                            }
                            currentProject={selectedProject}
                        />
                    }
                />

                <PageRoute
                    path={RouteMap[PageMap.SETTINGS_TEAMS]?.toString()}
                    element={
                        <SettingsTeams
                            pageRoute={
                                RouteMap[PageMap.SETTINGS_TEAMS] as Route
                            }
                            currentProject={selectedProject}
                        />
                    }
                />

                <PageRoute
                    path={RouteMap[PageMap.SETTINGS_TEAM_VIEW]?.toString()}
                    element={
                        <SettingsTeamView
                            pageRoute={
                                RouteMap[PageMap.SETTINGS_TEAM_VIEW] as Route
                            }
                            currentProject={selectedProject}
                        />
                    }
                />

                {/* On Call Duty */}

                <PageRoute
                    path={RouteMap[PageMap.ON_CALL_DUTY]?.toString()}
                    element={
                        <OnCallDutyPage
                            pageRoute={
                                RouteMap[PageMap.SETTINGS_TEAM_VIEW] as Route
                            }
                            currentProject={selectedProject}
                        />
                    }
                />

                {/* Misc Routes */}
                <PageRoute
                    path={RouteMap[PageMap.LOGOUT]?.toString()}
                    element={
                        <Logout
                            pageRoute={RouteMap[PageMap.LOGOUT] as Route}
                            currentProject={selectedProject}
                        />
                    }
                />
            </Routes>
        </MasterPage>
    );
};

export default App;
