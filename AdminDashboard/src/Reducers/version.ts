import {
    GET_VERSION_REQUEST,
    GET_VERSION_FAILED,
    GET_VERSION_RESET,
    GET_VERSION_SUCCESS,
} from '../constants/version';

import Action from 'CommonUI/src/types/action';

const initialState: $TSFixMe = {
    versions: {
        error: null,
        requesting: false,
        success: false,
        server: '',
        helm: '',
        dashboard: '',
        docs: '',
        adminDashboard: '',
    },
};

export default (state: $TSFixMe = initialState, action: Action): void => {
    switch (action.type) {
        case GET_VERSION_FAILED:
            return Object.assign({}, state, {
                versions: {
                    ...state.versions,
                    requesting: false,
                    error: action.payload,
                    success: false,
                },
            });

        case GET_VERSION_SUCCESS:
            return Object.assign({}, state, {
                versions: {
                    requesting: false,
                    success: true,
                    error: null,
                    server: action.payload.server,
                    helm: action.payload.helmChartVersion,
                    dashboard: action.payload.dashboardVersion,
                    docs: action.payload.docsVersion,
                    adminDashboard: process.env.REACT_APP_VERSION,
                },
            });

        case GET_VERSION_REQUEST:
            return Object.assign({}, state, {
                versions: {
                    ...state.versions,
                    requesting: true,
                    error: null,
                    success: false,
                },
            });

        case GET_VERSION_RESET:
            return Object.assign({}, state, {
                versions: {
                    error: null,
                    requesting: false,
                    success: false,
                    server: '',
                    helm: '',
                    dashboard: '',
                    docs: '',
                    adminDashboard: '',
                },
            });

        default:
            return state;
    }
};
