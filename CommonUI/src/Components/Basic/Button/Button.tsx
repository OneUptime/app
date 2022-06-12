import React, { FunctionComponent, ReactElement, useEffect } from 'react';
import { MouseOnClick, KeyboardEventProp } from '../../../Types/HtmlEvents';
import ShortcutKey from '../ShortcutKey/ShortcutKey';
import ButtonType from './ButtonTypes';
import CSS from 'csstype';
import Icon, { IconProp, SizeProp } from '../Icon/Icon';

export interface ComponentProps {
    title: string;
    onClick?: MouseOnClick;
    disabled?: boolean;
    id?: string;
    shortcutKey?: ShortcutKey;
    type?: ButtonType;
    isLoading?: boolean;
    style?: CSS.Properties;
    icon?: IconProp;
    showIconOnRight?: boolean;
    iconSize?: SizeProp;
}

const Button: FunctionComponent<ComponentProps> = ({
    title,
    onClick,
    disabled,
    id,
    shortcutKey,
    type = ButtonType.Button,
    isLoading = false,
    style,
    icon,
    iconSize,
    showIconOnRight = false,
}: ComponentProps): ReactElement => {
    useEffect(() => {
        // componentDidMount
        if (shortcutKey) {
            window.addEventListener('keydown', (e: KeyboardEventProp) => {
                return handleKeyboard(e);
            });
        }

        // componentDidUnmount
        return () => {
            if (shortcutKey) {
                window.removeEventListener(
                    'keydown',
                    (e: KeyboardEventProp) => {
                        return handleKeyboard(e);
                    }
                );
            }
        };
    });

    const handleKeyboard: Function = (event: KeyboardEventProp): void => {
        if (
            event.target instanceof HTMLBodyElement &&
            event.key &&
            shortcutKey
        ) {
            switch (event.key) {
                case shortcutKey.toUpperCase():
                case shortcutKey.toLowerCase():
                    onClick && onClick();
                    return;
                default:
                    return;
            }
        }
    };

    return (
        <button
            style={style}
            id={id}
            onClick={onClick}
            type={type}
            disabled={disabled}
            className="button"
        >
            {!isLoading && (
                <div>
                    <div>
                        <div></div>
                    </div>
                    <span>
                        <span>
                            {icon && !showIconOnRight && (
                                <Icon
                                    icon={icon}
                                    size={
                                        iconSize ? iconSize : SizeProp.Regular
                                    }
                                />
                            )}
                        </span>
                        <span>{title}</span>
                        <span
                            style={{
                                marginLeft: '5px',
                            }}
                        >
                            {icon && showIconOnRight && (
                                <Icon
                                    icon={icon}
                                    size={
                                        iconSize ? iconSize : SizeProp.Regular
                                    }
                                />
                            )}
                        </span>
                        {shortcutKey && (
                            <span className="newButtonKeycode">
                                {shortcutKey}
                            </span>
                        )}
                    </span>
                </div>
            )}
            {isLoading && <div>Implement Loader here</div>}
        </button>
    );
};

export default Button;
