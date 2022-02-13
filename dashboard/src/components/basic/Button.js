import React, { Component } from 'react';
import PropTypes from 'prop-types';
import RenderBasedOnRole from './RenderBasedOnRole';

export default class Button extends Component {
    constructor(props) {
        super(props);
    }

    getElement() {
        const { title, shortcutKey, id, onClick, disabled } = this.props;

        return (
            <button
                id={id}
                onClick={onClick}
                className={`${'Button bs-ButtonLegacy ActionIconParent'} ${
                    disabled ? 'Is--disabled' : ''
                }`}
                type="button"
                disabled={disabled}
            >
                <div className="bs-ButtonLegacy-fill Box-root Box-background--white Flex-inlineFlex Flex-alignItems--center Flex-direction--row Padding-horizontal--8 Padding-vertical--4">
                    <div className="Box-root Margin-right--8">
                        <div className="SVGInline SVGInline--cleaned Button-icon ActionIcon ActionIcon--color--inherit Box-root Flex-flex"></div>
                    </div>
                    <span className="bs-Button bs-FileUploadButton bs-Button--icon bs-Button--new keycode__wrapper">
                        <span>{title}</span>
                        {shortcutKey && (
                            <span className="new-btn__keycode">
                                {shortcutKey}
                            </span>
                        )}
                    </span>
                </div>
            </button>
        );
    }

    render() {
        const {
            visibleForOwner,
            visibleForAdmin,
            visibleForViewer,
            visibleForMember,
            visibleForAll = true,
        } = this.props;

        return (
            <RenderBasedOnRole
                visibleForOwner={visibleForOwner}
                visibleForAdmin={visibleForAdmin}
                visibleForViewer={visibleForViewer}
                visibleForMember={visibleForMember}
                visibleForAll={visibleForAll}
            >
                {this.getElement()}
            </RenderBasedOnRole>
        );
    }
}

Button.propTypes = {
    title: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    disabled: PropTypes.bool,
    id: PropTypes.string,
    shortcutKey: PropTypes.string,

    visibleForOwner: PropTypes.bool,
    visibleForAdmin: PropTypes.bool,
    visibleForViewer: PropTypes.bool,
    visibleForMember: PropTypes.bool,
    visibleForAll: PropTypes.bool,
};
