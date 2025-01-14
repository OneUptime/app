import React, { FunctionComponent, ReactElement, useEffect } from "react";
import ObjectID from "Common/Types/ObjectID";
import Card from "Common/UI/Components/Card/Card";
import Feed from "Common/UI/Components/Feed/Feed";
import API from "Common/UI/Utils/API/API";
import ComponentLoader from "Common/UI/Components/ComponentLoader/ComponentLoader";
import ErrorMessage from "Common/UI/Components/ErrorMessage/ErrorMessage";
import IncidentFeed from "Common/Models/DatabaseModels/IncidentFeed";
import ListResult from "Common/UI/Utils/BaseDatabase/ListResult";
import ModelAPI from "Common/UI/Utils/ModelAPI/ModelAPI";
import SortOrder from "Common/Types/BaseDatabase/SortOrder";
import { LIMIT_PER_PROJECT } from "Common/Types/Database/LimitMax";
import { ComponentProps as FeedItemProps } from "Common/UI/Components/Feed/FeedItem";
import { Gray500 } from "Common/Types/BrandColors";

export interface ComponentProps {
    incidentId?: ObjectID;
}

const IncidentFeedElement: FunctionComponent<ComponentProps> = (
    props: ComponentProps,
): ReactElement => {

    const [isLoading, setIsLoading] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | undefined>(undefined);
    const [feedItems, setFeedItems] = React.useState<FeedItemProps[]>([]);


    const getFeedItemsFromIncidentFeeds = (incidentFeeds: IncidentFeed[]): FeedItemProps[] => {
        return incidentFeeds.map((incidentFeed: IncidentFeed) => {
            return getFeedItemFromIncidentFeed(incidentFeed);
        });
    }


    const getFeedItemFromIncidentFeed = (incidentFeed: IncidentFeed): FeedItemProps => {
        return {
            key: incidentFeed.id!.toString(),
            textInMarkdown: incidentFeed.feedInfoInMarkdown || "",
            moreTextInMarkdown: incidentFeed.moreInformationInMarkdown || "",
            user: incidentFeed.user,
            itemDateTime: incidentFeed.createdAt!,
            color: incidentFeed.displayColor || Gray500,
        };
    }


    const fetchItems = async () => {
        setError("");
        setIsLoading(true);
        try {


            const incidentFeeds: ListResult<IncidentFeed> = await ModelAPI.getList({
                modelType: IncidentFeed,
                query: {
                    incidentId: props.incidentId!,
                },
                select: {
                    moreInformationInMarkdown: true,
                    feedInfoInMarkdown: true,
                    displayColor: true,
                    createdAt: true,
                    user: {
                        name: true,
                        email: true,
                        profilePictureId: true,
                    }
                },
                skip: 0,
                sort: {
                    createdAt: SortOrder.Ascending
                },
                limit: LIMIT_PER_PROJECT
            });

            setFeedItems(getFeedItemsFromIncidentFeeds(incidentFeeds.data));

        } catch (err) {
            setError(API.getFriendlyMessage(err));
        }

        setIsLoading(false);

    }

    useEffect(() => {

        if (!props.incidentId) {
            return;
        }

        fetchItems().catch((err) => {
            setError(API.getFriendlyMessage(err));
        });

    }, [props.incidentId]);


    return (
        <Card title={"Timeline and Feed"} description={
            "This is the timeline and feed for this incident. You can see all the updates and information about this incident here."
        }>
            <div>
                {isLoading && <ComponentLoader />}
                {error && <ErrorMessage error={error} />}
                {!isLoading && !error && <Feed items={feedItems} noItemsMessage="Looks like there are no items in this feed for this incident." />}
            </div>
        </Card>
    );
};

export default IncidentFeedElement;