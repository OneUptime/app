import React, {
    MouseEventHandler,
    ReactElement,
    FunctionComponent,
} from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';

export interface ComponentProps {
    title: string;
    description?: string;
    action?: MouseEventHandler;
}

const NavDropDownItem: FunctionComponent<ComponentProps> = ({
    title,
    description,
    action,
}: ComponentProps): ReactElement => {
    return (
        <div className="body" onClick={action}>
            <div className="nav-details">
                <h4>{title}</h4>
                {description && <p>{description}</p>}
            </div>
            <div>
                <FontAwesomeIcon icon={faArrowRight} />
            </div>
        </div>
    );
};

export default NavDropDownItem;
