import React, { ReactElement } from "react";

export interface ComponentProps {
  children: Array<ReactElement | false>;
}

const HeaderAlertGroup: (props: ComponentProps) => ReactElement = (
  props: ComponentProps,
): ReactElement => {
  let children: Array<ReactElement | false> = props.children || [];

  children = children.filter((child: ReactElement | false) => {
    if (!child) {
      return false;
    }

    // check if this child has inner div.
    if (child.props.children) {
      return true;
    }

    return true;
  });

  if (!children || children.length === 0) {
    return <></>;
  }

  // const className: string = "rounded-lg m-3 h-10 pr-0 pl-0 flex border-2 border-gray-200";
  const className: string = "rounded-lg m-3 mt-5 h-10 pr-0 pl-0 flex";

  return (
    <div className={className}>
      {children.map((child: ReactElement | false, index: number) => {
        // const isLastElement: boolean = index === props.children.length - 1;

        return (
          <div key={index} className="flex">
            {child}
            {/* {!isLastElement && (
              <div className="border-r-2 border-gray-200"></div>
            )} */}
          </div>
        );
      })}
    </div>
  );
};

export default HeaderAlertGroup;
