import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ShouldRender from '../basic/ShouldRender';
import moment from 'moment';
import momentTz from 'moment-timezone';
import { currentTimeZone } from '../basic/TimezoneArray';
import NewIncidentMessage from '../modals/NewIncidentMessage';
import { User } from '../../config';
import { ListLoader } from '../basic/Loader';
import DataPathHoC from '../DataPathHoC';
import Markdown from 'markdown-to-jsx';
import DeleteIncidentMessage from '../modals/DeleteIncidentMessage';
export class IncidentMessageThread extends Component {
    render() {
        const {
            title,
            description,
            incident,
            incidentMessages,
            canPrev,
            canNext,
            requesting,
            type,
            error,
            olderMessage,
            newerMessage,
            createMessageModalId,
            openModal,
            editMessageModalId,
            deleteMessageModalId,
            deleteIncidentMessage,
        } = this.props;
        return (
            <div className="Box-root">
                <div className="bs-ContentSection-content Box-root Box-divider--surface-bottom-1 Flex-flex Flex-alignItems--center Flex-justifyContent--spaceBetween Padding-horizontal--20 Padding-vertical--16">
                    <div className="Box-root">
                        <span className="Text-color--inherit Text-display--inline Text-fontSize--16 Text-fontWeight--medium Text-lineHeight--24 Text-typeface--base Text-wrap--wrap">
                            <span>{`${title} Notes`}</span>
                        </span>
                        <p>
                            <span>{description}</span>
                        </p>
                    </div>
                    <div className="Box-root">
                        <button
                            className="bs-Button bs-ButtonLegacy ActionIconParent"
                            type="button"
                            id={`add-${type}-message`}
                            onClick={() =>
                                openModal({
                                    id: createMessageModalId,
                                    onClose: () => '',
                                    content: DataPathHoC(NewIncidentMessage, {
                                        incident,
                                        formId: `New${type}Form`,
                                        type,
                                    }),
                                })
                            }
                        >
                            <span className="bs-FileUploadButton bs-Button--icon bs-Button--new">
                                <span>{`Add ${title} Note`}</span>
                            </span>
                        </button>
                    </div>
                </div>
                <div style={{ overflow: 'hidden', overflowX: 'auto' }}>
                    <div id="overflow">
                        <div className="db-ListViewItem-cellContent Box-root">
                            <span className="db-ListViewItem-text Text-align--right Text-color--dark Text-display--block Text-fontSize--13 Text-fontWeight--medium Text-lineHeight--20 Text-typeface--upper Text-wrap--wrap"></span>
                        </div>
                    </div>
                    <div className="bs-thread-container">
                        {incidentMessages &&
                        incidentMessages.incidentMessages ? (
                            incidentMessages.incidentMessages.map(
                                (incidentMessage, i) => {
                                    return (
                                        <>
                                            <div
                                                key={i}
                                                id={`${type}_incident_message_${i}`}
                                            >
                                                <ShouldRender if={i !== 0}>
                                                    <div className="bs-thread-line-up"></div>
                                                </ShouldRender>
                                                <div className="bs-thread-card">
                                                    <div className="db-ListViewItem-cellContent Box-root Padding-all--8 bs-thread-display">
                                                        <div className="bs-thread-content">
                                                            <div
                                                                className="Box-root Margin-right--16"
                                                                style={{
                                                                    cursor:
                                                                        'pointer',
                                                                }}
                                                            >
                                                                <img
                                                                    src={
                                                                        incidentMessage.createdById &&
                                                                        incidentMessage
                                                                            .createdById
                                                                            .name
                                                                            ? '/dashboard/assets/img/profile-user.svg'
                                                                            : '/dashboard/assets/img/Fyipe.svg'
                                                                    }
                                                                    className="userIcon"
                                                                    alt="usericon"
                                                                    style={{
                                                                        marginBottom:
                                                                            '-5px',
                                                                    }}
                                                                />
                                                                <span className="db-ListViewItem-text Text-color--cyan Text-display--inline Text-fontSize--14 Text-fontWeight--medium Text-lineHeight--20 Text-typeface--base Text-wrap--wrap">
                                                                    {incidentMessage.createdById &&
                                                                    incidentMessage
                                                                        .createdById
                                                                        .name
                                                                        ? incidentMessage
                                                                              .createdById
                                                                              .name
                                                                        : incident.createdByZapier
                                                                        ? 'Zapier'
                                                                        : 'Fyipe'}
                                                                </span>
                                                            </div>

                                                            <div className="Margin-left--30">
                                                                <ShouldRender
                                                                    if={
                                                                        incidentMessage.updated
                                                                    }
                                                                >
                                                                    <span
                                                                        id={`edited_${type}_incident_message_${i}`}
                                                                        className="Text-color--dark Margin-right--4"
                                                                    >
                                                                        (edited)
                                                                    </span>
                                                                </ShouldRender>
                                                                <span className="Text-display--inline Text-fontSize--14 Text-lineHeight--16 Text-wrap--noWrap">
                                                                    <span
                                                                        style={{
                                                                            fontWeight:
                                                                                '500',
                                                                            fontSize:
                                                                                '11px',
                                                                        }}
                                                                    >
                                                                        Posted
                                                                        on{' '}
                                                                        {currentTimeZone
                                                                            ? momentTz(
                                                                                  incidentMessage.createdAt
                                                                              )
                                                                                  .tz(
                                                                                      currentTimeZone
                                                                                  )
                                                                                  .format(
                                                                                      'lll'
                                                                                  )
                                                                            : moment(
                                                                                  incidentMessage.createdAt
                                                                              ).format(
                                                                                  'lll'
                                                                              )}
                                                                    </span>
                                                                </span>
                                                                {incidentMessage.incident_state ? (
                                                                    <div className="Badge Badge--color--green Box-root Flex-inlineFlex Flex-alignItems--center Padding-horizontal--8 Padding-vertical--2 bs-ma-10">
                                                                        <span className="Badge-text Text-color--green Text-display--inline Text-fontSize--12 Text-fontWeight--bold Text-lineHeight--16 Text-typeface--upper Text-wrap--noWrap">
                                                                            <span>
                                                                                {
                                                                                    incidentMessage.incident_state
                                                                                }
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                ) : null}
                                                                <span
                                                                    id={`content_${type}_incident_message_${i}`}
                                                                    style={{
                                                                        display:
                                                                            'block',
                                                                        marginTop:
                                                                            '10px',
                                                                    }}
                                                                >
                                                                    <Markdown>
                                                                        {
                                                                            incidentMessage.content
                                                                        }
                                                                    </Markdown>
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="bs-action-side">
                                                            <div>
                                                                <ShouldRender
                                                                    if={
                                                                        incidentMessage.createdById &&
                                                                        User.getUserId() ===
                                                                            incidentMessage
                                                                                .createdById
                                                                                ._id
                                                                    }
                                                                >
                                                                    <div className="db-ListViewItem-link">
                                                                        <div className="db-ListViewItem-cellContent Box-root Padding-horizontal--2 Padding-vertical--8">
                                                                            <span className="db-ListViewItem-text Text-color--inherit Text-display--inline Text-fontSize--14 Text-fontWeight--regular Text-lineHeight--20 Text-typeface--base Text-wrap--wrap">
                                                                                <div className="Box-root Flex">
                                                                                    <div
                                                                                        className="Box-root Flex-flex"
                                                                                        style={{
                                                                                            justifyContent:
                                                                                                'flex-end',
                                                                                        }}
                                                                                    >
                                                                                        <div className="db-RadarRulesListUserName Box-root Flex-flex Flex-alignItems--center Flex-direction--row Flex-justifyContent--flexStart">
                                                                                            <div
                                                                                                className="Box-root Flex-inlineFlex Flex-alignItems--center Padding-horizontal--8 Padding-vertical--2"
                                                                                                style={{
                                                                                                    paddingRight:
                                                                                                        '0',
                                                                                                }}
                                                                                            >
                                                                                                <button
                                                                                                    className="bs-Button bs-DeprecatedButton"
                                                                                                    type="button"
                                                                                                    onClick={() =>
                                                                                                        openModal(
                                                                                                            {
                                                                                                                id: editMessageModalId,
                                                                                                                onClose: () =>
                                                                                                                    '',
                                                                                                                content: DataPathHoC(
                                                                                                                    NewIncidentMessage,
                                                                                                                    {
                                                                                                                        incident,
                                                                                                                        formId: `Edit${type}Form`,
                                                                                                                        type,
                                                                                                                        incidentMessage,
                                                                                                                        edit: true,
                                                                                                                    }
                                                                                                                ),
                                                                                                            }
                                                                                                        )
                                                                                                    }
                                                                                                    id={`edit_${type}_incident_message_${i}`}
                                                                                                >
                                                                                                    <span>
                                                                                                        <img
                                                                                                            src={`/dashboard/assets/img/edit.svg`}
                                                                                                            style={{
                                                                                                                height:
                                                                                                                    '10px',
                                                                                                                width:
                                                                                                                    '10px',
                                                                                                            }}
                                                                                                            alt="edit"
                                                                                                        />{' '}
                                                                                                        Edit
                                                                                                    </span>
                                                                                                </button>
                                                                                                <button
                                                                                                    className="bs-Button bs-DeprecatedButton bs-Button--icon bs-Button--delete"
                                                                                                    type="button"
                                                                                                    onClick={() =>
                                                                                                        openModal(
                                                                                                            {
                                                                                                                id: deleteMessageModalId,
                                                                                                                onClose: () =>
                                                                                                                    '',
                                                                                                                onConfirm: () =>
                                                                                                                    deleteIncidentMessage(
                                                                                                                        incidentMessage._id
                                                                                                                    ),
                                                                                                                content: DataPathHoC(
                                                                                                                    DeleteIncidentMessage,
                                                                                                                    {
                                                                                                                        incidentMessage,
                                                                                                                    }
                                                                                                                ),
                                                                                                            }
                                                                                                        )
                                                                                                    }
                                                                                                    id={`delete_${type}_incident_message_${i}`}
                                                                                                >
                                                                                                    <span>
                                                                                                        Delete
                                                                                                    </span>
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </ShouldRender>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <ShouldRender
                                                    if={
                                                        incidentMessages
                                                            .incidentMessages
                                                            .length -
                                                            1 !==
                                                        i
                                                    }
                                                >
                                                    <div className="bs-thread-line-down"></div>
                                                </ShouldRender>
                                            </div>
                                        </>
                                    );
                                }
                            )
                        ) : (
                            <div></div>
                        )}
                    </div>
                </div>

                {requesting ? <ListLoader /> : null}

                {incidentMessages &&
                incidentMessages.incidentMessages &&
                incidentMessages.incidentMessages.length < 1 ? (
                    <div
                        style={{
                            textAlign: 'center',
                            padding: '25px',
                        }}
                    >
                        {`You don't have any messages yet, start up a conversation`}
                    </div>
                ) : null}
                {error}

                <div className="Box-root Flex-flex Flex-alignItems--center Flex-justifyContent--spaceBetween">
                    <div className="Box-root Flex-flex Flex-alignItems--center Padding-all--20">
                        <span className="Text-color--inherit Text-display--inline Text-fontSize--14 Text-fontWeight--regular Text-lineHeight--20 Text-typeface--base Text-wrap--wrap">
                            <span className="Text-color--inherit Text-display--inline Text-fontSize--14 Text-fontWeight--medium Text-lineHeight--20 Text-typeface--base Text-wrap--wrap">
                                {incidentMessages.incidentMessages.length
                                    ? incidentMessages.incidentMessages.length +
                                      (incidentMessages.incidentMessages
                                          .length > 1
                                          ? ' Messages'
                                          : ' Message')
                                    : '0 Messages'}
                            </span>
                        </span>
                    </div>
                    <div className="Box-root Padding-horizontal--20 Padding-vertical--16">
                        <div className="Box-root Flex-flex Flex-alignItems--stretch Flex-direction--row Flex-justifyContent--flexStart">
                            <div className="Box-root Margin-right--8">
                                <button
                                    id={`btn-${type}-Prev`}
                                    onClick={() => {
                                        olderMessage();
                                    }}
                                    className={
                                        'Button bs-ButtonLegacy' +
                                        (canPrev ? '' : 'Is--disabled')
                                    }
                                    disabled={!canPrev}
                                    data-db-analytics-name="list_view.pagination.previous"
                                    type="button"
                                >
                                    <div className="Button-fill bs-ButtonLegacy-fill Box-root Box-background--white Flex-inlineFlex Flex-alignItems--center Flex-direction--row Padding-horizontal--8 Padding-vertical--4">
                                        <span className="Button-label Text-color--default Text-display--inline Text-fontSize--14 Text-fontWeight--medium Text-lineHeight--20 Text-typeface--base Text-wrap--noWrap">
                                            <span>Newer Messages</span>
                                        </span>
                                    </div>
                                </button>
                            </div>
                            <div className="Box-root">
                                <button
                                    id={`btn-${type}-Next`}
                                    onClick={() => {
                                        newerMessage();
                                    }}
                                    className={
                                        'Button bs-ButtonLegacy' +
                                        (canNext ? '' : 'Is--disabled')
                                    }
                                    disabled={!canNext}
                                    data-db-analytics-name="list_view.pagination.next"
                                    type="button"
                                >
                                    <div className="Button-fill bs-ButtonLegacy-fill Box-root Box-background--white Flex-inlineFlex Flex-alignItems--center Flex-direction--row Padding-horizontal--8 Padding-vertical--4">
                                        <span className="Button-label Text-color--default Text-display--inline Text-fontSize--14 Text-fontWeight--medium Text-lineHeight--20 Text-typeface--base Text-wrap--noWrap">
                                            <span>Older Messages</span>
                                        </span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

IncidentMessageThread.displayName = 'IncidentMessageThread';

IncidentMessageThread.propTypes = {
    title: PropTypes.string,
    description: PropTypes.string,
    incident: PropTypes.object.isRequired,
    incidentMessages: PropTypes.object,
    canPrev: PropTypes.bool,
    canNext: PropTypes.bool,
    requesting: PropTypes.bool,
    type: PropTypes.string,
    error: PropTypes.string,
    olderMessage: PropTypes.func,
    newerMessage: PropTypes.func,
    openModal: PropTypes.func,
    createMessageModalId: PropTypes.string,
    editMessageModalId: PropTypes.string,
    deleteMessageModalId: PropTypes.string,
    deleteIncidentMessage: PropTypes.func,
};

export default IncidentMessageThread;
