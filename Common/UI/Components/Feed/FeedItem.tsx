import React, { FunctionComponent, ReactElement, useState } from "react";
import User from "../../../Models/DatabaseModels/User";
import { GetReactElementFunction } from "../../Types/FunctionTypes";
import Image from "../Image/Image";
import Route from "../../../Types/API/Route";
import BlankProfilePic from "../../Images/users/blank-profile.svg";
import FileUtil from "../../Utils/File";
import ObjectID from "../../../Types/ObjectID";
import OneUptimeDate from "../../../Types/Date";
import Tooltip from "../Tooltip/Tooltip";
import MarkdownViewer from "../Markdown.tsx/MarkdownViewer";
import Button, { ButtonSize, ButtonStyleType } from "../Button/Button";
import ConfirmModal from "../Modal/ConfirmModal";
import Icon from "../Icon/Icon";
import IconProp from "../../../Types/Icon/IconProp";
import Color from "../../../Types/Color";

export interface ComponentProps {
  key: string;
  textInMarkdown: string;
  element?: ReactElement;
  moreTextInMarkdown?: string;
  user?: User | undefined;
  itemDateTime: Date;
  icon?: IconProp;
  color: Color;
}

const FeedItem: FunctionComponent<ComponentProps> = (
  props: ComponentProps,
): ReactElement => {


  const [showMoreInformationModal, setShowMoreInformationModal] = useState<boolean>(false);


  const getMoreInformationModal: GetReactElementFunction = (): ReactElement => {
    if (showMoreInformationModal) {
      return (<ConfirmModal
        title={`More Information`}
        description={
          <div>
            <MarkdownViewer text={props.moreTextInMarkdown || ""} />
          </div>
        }
        isLoading={false}
        submitButtonText={"Close"}
        onSubmit={() => {
          return setShowMoreInformationModal(false);
        }}
      />)
    }

    return <></>;
  }


  const getUserIcon: GetReactElementFunction = (): ReactElement => {
    return <div>
      {!props.user?.profilePictureFile && <Image
        className="h-8 w-8 rounded-full"
        imageUrl={Route.fromString(`${BlankProfilePic}`)}
      />}

      {props.user?.profilePictureFile && <Image
        className="flex size-10 items-center justify-center rounded-full bg-gray-400 ring-8 ring-white"
        imageUrl={FileUtil.getFileRoute(props.user!.profilePictureId as ObjectID)}
      />}

      {props.icon && <span className="absolute -bottom-0.5 -right-1 rounded-tl bg-white px-0.5 py-px">
        <Icon className="size-5 text-gray-500" icon={props.icon} color={props.color} />
      </span>}
    </div>
  }


  const getItem: GetReactElementFunction = (): ReactElement => {
    return <li key={props.key}>
      <div className="relative pb-8">
        <span
          className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-200"
          aria-hidden="true"
        ></span>
        <div className="relative flex items-start space-x-3">
          <div className="relative">
            {props.user && getUserIcon()}
            {!props.user && props.icon && getIconItem()}
          </div>
          <div className="min-w-0 flex-1">
            <div>
              <div className="text-sm">
                <a href="#" className="font-medium text-gray-900">
                  {props.user?.name?.toString() || "Unknown User"}
                </a>
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                <Tooltip
                  text={OneUptimeDate.getDateAsLocalFormattedString(props.itemDateTime)}>
                  <div>{OneUptimeDate.fromNow(props.itemDateTime)}</div>
                </Tooltip>
              </p>
            </div>
            <div className="mt-2 text-sm text-gray-700">
              {props.textInMarkdown && <div>
                <MarkdownViewer text={props.textInMarkdown} />
              </div>}
              {props.element && <div>{props.element}</div>}
              {props.moreTextInMarkdown && <Button
                onClick={() => setShowMoreInformationModal(true)}
                title="More Information"
                buttonStyle={ButtonStyleType.NORMAL}
                buttonSize={ButtonSize.Small}
              />}
            </div>
          </div>
        </div>
      </div>
      {getMoreInformationModal()}
    </li>;
  }

  const getIconItem: GetReactElementFunction = (): ReactElement => {

    if (!props.icon) {
      return <></>;
    }
    return (
      <div className="flex size-8 items-center justify-center rounded-full bg-gray-100 ring-8 ring-white">
        <Icon className="size-5 text-gray-500" icon={props.icon} color={props.color} />
      </div>
    )
  }

  return getItem();


};

export default FeedItem;