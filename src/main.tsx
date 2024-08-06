import {
  Devvit,
  RichTextBuilder,
  Post,
  FormValues,
  User,
  FormOnSubmitEvent,
  FormKey
} from "@devvit/public-api";
import { usePagination } from "@devvit/kit";
import { RedditAPIClient } from "@devvit/public-api";
import * as chrono from "chrono-node";

Devvit.configure({ media: true, redditAPI: true, redis: true });

//event object
type Meet = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  link: string;
  description: string;
  attending: string[];
};

//function returning true/false if user is in event.attending
const userAttendingEvent = ({
  currentUsername,
  attendingUsersList,
  eventTitle,
}: {
  currentUsername: string | undefined;
  attendingUsersList: string[];
  eventTitle: string;
}) => { 
  console.log("----------------")
  console.log("event title:", eventTitle);
  console.log("attending users list", attendingUsersList);
  if (currentUsername) {
    return attendingUsersList.includes(currentUsername);
  } else {
    console.log("User not detected");
    return false;
  }
};

const RSVP_NOTIF = "reminder";

Devvit.addSchedulerJob({
  name: RSVP_NOTIF,
  onRun: async (event, context) => {
    const data = event.data!.data as Meet;

    // Iterate over the 'attending' array
    for (const username of data.attending) {
      await context.reddit.sendPrivateMessage({
        to: username, 
        subject: "Event Reminder",
        text: `Hello! ${data.title} is starting soon! ${data.link}`,
      });
    }
  },
});

//formatting of how event items displayed onto app
const ItemComponent: Devvit.BlockComponent<{
  item: Meet;
  onDeleteItem: (item: Meet) => void;
  onRSVP: (item: Meet) => void;
  currentUsername: string | undefined;
  infoFormKey: FormKey
}> = (props, context): JSX.Element => {
  const canUserAttend = userAttendingEvent({
    attendingUsersList: props.item.attending,
    eventTitle: props.item.title,
    currentUsername: props.currentUsername,
  })



  return (
    <vstack>
      <hstack>
        <vstack>
          <hstack gap="small">
            <text size="xxlarge" weight="bold">
              {props.item.title}
            </text>
            <button
              size="small"
              icon="info"
              onPress={() => context.ui.showForm(props.infoFormKey, props.item)}
            />
            <button
              size="small"
              icon="delete"
              onPress={() => props.onDeleteItem(props.item)}
            />
          </hstack>
          <vstack>
            <text weight="bold">{props.item.date}</text>
          </vstack>
        </vstack>

        <hstack alignment="end middle" grow gap="small">
          <text alignment="end" size="xxlarge">
            {props.item.startTime}
          </text>
          <button
            icon={canUserAttend ? "notification-frequent-fill" : "notification"}
            size="small"
            onPress={() => props.onRSVP(props.item)}
          />
        </hstack>
      </hstack>
      <vstack backgroundColor="#F1F1F1" height="2px"></vstack>
    </vstack>
  );
};

Devvit.addCustomPostType({
  name: "Name",
  render: (context) => {
    const {reddit} = context;
    const [currentUsername] = context.useState(async () => {
      const currentUser = await reddit.getCurrentUser();
      return currentUser?.username;
    });

    
    const [currentSubreddit] = context.useState(async () => {
      const currentSubreddit = await reddit.getCurrentSubreddit();
      
      return {
        name: currentSubreddit.name,
      };
    });
    

    //function to rerender events when list of events is updated
    const [localEvents, setLocalEvents] = context.useState<Meet[]>(async () => {
      const eventsStr = await context.redis.get("eventapp");

      if (!eventsStr) {
        return [];
      }

      return JSON.parse(eventsStr);
    });


    //function to delete event from events board
    const deleteEvent = async (data: any) => {
      console.log(data);
      console.log(localEvents);

      const newLocalEvents: Meet[] = localEvents.filter(
        (event) => event !== data
      );
      await context.redis.set("eventapp", JSON.stringify(newLocalEvents));

      setLocalEvents(newLocalEvents);

      console.log(newLocalEvents);
      context.ui.showToast("Event deleted!");
    };

    //when add event form is submitted update upcomingEvents
    const onSubmit = async (values: any) => {
      const event: Meet = {
        title: values.title,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        link: values.link,
        description: values.description,
        attending: [],
      };

      //create new list of events with new event
      const newLocalEvents: Meet[] = [event, ...localEvents];

      //update redis data
      await context.redis.set("eventapp", JSON.stringify(newLocalEvents));

      setLocalEvents(newLocalEvents);

      context.ui.showToast("Event created!");

      remindUser(event, context);
    };

    /** function to add users to an event's attending list */
    const RSVP = async (_event: Meet) => {
      const event = { ..._event };

      const isUserAttending = userAttendingEvent({
        currentUsername,
        attendingUsersList: event.attending,
        eventTitle: event.title,
      });
  
        if (currentUsername) {
          //if the user is already attending event, and the function is called, unRSVP
          if (isUserAttending) {
            const newAttending = event.attending.filter(
              (users) => users !== currentUsername );
            event.attending = newAttending;
            console.log(
              "current user attending event: expecting false",
              userAttendingEvent({
                currentUsername,
                attendingUsersList: event.attending,
                eventTitle: event.title,
              })
            );
            const newLocalEvents: Meet[] = [...localEvents];
            await context.redis.set("eventapp", JSON.stringify(newLocalEvents));

            setLocalEvents(newLocalEvents);
          }

          //if the user is not attending the event, add them to the attending list
          else {
            event.attending.push(currentUsername);
            const newLocalEvents: Meet[] = [...localEvents];
            await context.redis.set("eventapp", JSON.stringify(newLocalEvents));
            setLocalEvents(newLocalEvents);
            console.log(
              "current user attending event: expecting true",
              userAttendingEvent({
                currentUsername,
                attendingUsersList: event.attending,
                eventTitle: event.title,
              })
            );
            
          }
        
      }    };

      async function remindUser(event: Meet, context: Devvit.Context) {
        const whenStr = `15 minutes prior to ${event.startTime} ${event.date}`|| '';
        if (!whenStr) {
          context.ui.showToast("Error: Invalid time format");
          return;
        }

        const parsedTime = chrono.parseDate(whenStr);
        const now = new Date();

        if (parsedTime)
        {if (parsedTime < now) {
          context.ui.showToast("Error: Invalid time format");
          return;
        }
          await context.scheduler.runJob({
            name: RSVP_NOTIF,
            data: {
              data: event,
            },
            runAt: parsedTime,
          });
        

        context.ui.showToast(`Gotcha! I'll send you a message about this post at ${parsedTime}!`);
      }
}
    //pagination variables, localEvents = currentItems = list of events displayed in app
    const { currentPage, currentItems, toNextPage, toPrevPage } = usePagination(
      context,
      localEvents,
      3
    );

    //form to create event
    const eventForm = context.useForm(
      {
        title: "Add Event",
        fields: [
          {
            required: true,
            type: "string",
            name: "title",
            helpText: "MUST be unique",
            label: "Event Title",
          },
          {
            required: true,
            type: "string",
            name: "date",
            label: "Date",
            helpText: "ex. 12/31/2000",
          },

          {
            required: true,
            type: "string",
            name: "startTime",
            label: "Start Time",
            helpText: "ex. 01:00am ET",
          },
          {
            required: true,
            type: "string",
            name: "endTime",
            label: "End Time",
            helpText: "ex. 01:10am ET",
          },
          {
            type: "string",
            name: "link",
            label: "Link",
          },
          {
            type: "paragraph",
            name: "description",
            label: "Description",
          },
        ],
        acceptLabel: "Add",
      },
      onSubmit
    );

      //onSubmit function for info form
  const dummySubmit = () => {};

  //form that displays description and event time
  const infoForm = context.useForm((data) => {
    return {
      fields: [
        {
          label: `${data.startTime}-${data.endTime}`,
          type: "paragraph",
          name: "Description",
          defaultValue: data.description,
          disabled: true,
        },
      ],
      cancelLabel: "Back",
    };
  }, dummySubmit);

    // Render the appp
    return (
      <vstack>
        <vstack width="100%" height="64px" backgroundColor="#003285">
          <hstack padding="small" alignment="middle">
            <text color="white" size="xxlarge" weight="bold">
              r/{currentSubreddit.name}
            </text>

            <zstack grow alignment="end middle">
              <button
                size="medium"
                onPress={() => context.ui.showForm(eventForm)}
              >
                Add Event
              </button>
            </zstack>
          </hstack>
        </vstack>

        {/* Rendering items for the current page */}
        <vstack gap="small" padding="small" minHeight="200px">
          {currentItems.map((item) => (
            <ItemComponent
              item={item}
              onDeleteItem={deleteEvent}
              onRSVP={RSVP}
              currentUsername={currentUsername}
              infoFormKey={infoForm}
            />
          ))}
        </vstack>

        {/* Rendering pagination controls */}
        <hstack alignment="middle center" gap="small">
          <button onPress={toPrevPage} icon="left" />
          <text>{currentPage}</text>
          <button onPress={toNextPage} icon="right" />
        </hstack>
      </vstack>
    );
  },
});

//lines 368-517 are exported functions for pagination and other devvit formatting tools
function getSplittingFunction(order: RenderingOrder): SplittingFunction {
  if (order === "column") {
    return splitItems;
  }
  if (order === "column-fill") {
    return splitItemsColumnFill;
  }
  if (order === "row") {
    return splitItemsRow;
  }
  // render one column as a default behaviour
  return (items) => [[...items]];
}

export const Columns = (
  props: Devvit.BlockComponentProps<ColumnsProps>
): JSX.Element => {
  if (!props.children || !Array.isArray(props.children)) {
    return <>{props.children}</>;
  }
  const order = props.order || "column";
  const columnCount = props.columnCount > 0 ? props.columnCount : 1;
  const maxRows = props.maxRows && props.maxRows > 0 ? props.maxRows : Infinity;
  const gapXpx = props.gapX ? Number(props.gapX.split("px")[0]) : 0;
  const gapX: SizePixels = gapXpx && gapXpx > 0 ? `${gapXpx}px` : "0px";
  const gapYpx = props.gapY ? Number(props.gapY.split("px")[0]) : 0;
  const gapY: SizePixels = gapYpx && gapYpx > 0 ? `${gapYpx}px` : "0px";
  const splittingFunction = getSplittingFunction(order);
  const columns = splittingFunction(props.children, columnCount, maxRows);
  console.log(columns);
  return (
    <hstack width={100}>
      {columns.map((column, columnIndex) => {
        return (
          <>
            {columnIndex > 0 && <hstack width={gapX}></hstack>}
            <vstack width={100 / columnCount} grow>
              {column.map((item, rowIndex) => {
                return (
                  <>
                    {rowIndex > 0 && <hstack height={gapY}></hstack>}
                    {item}
                  </>
                );
              })}
            </vstack>
          </>
        );
      })}
    </hstack>
  );
};

export function splitItems<T>(
  input: T[],
  columns: number,
  maxRows: number
): T[][] {
  const maxItemsDisplayed = Math.min(
    maxRows === Infinity ? input.length : columns * maxRows,
    input.length
  );
  const itemsToDistribute = input.slice(0, maxItemsDisplayed);
  const guaranteedItemsInColumn = Math.floor(
    itemsToDistribute.length / columns
  );
  let distributedCount = 0;
  const result: T[][] = Array(columns)
    .fill(null)
    .map(() => []);
  for (let i = 0; i < columns; i++) {
    const startIndex = distributedCount;
    const itemsLeftCount = itemsToDistribute.length - distributedCount;
    const columnsLeft = columns - i;
    const itemsToAdd =
      itemsLeftCount % columnsLeft
        ? guaranteedItemsInColumn + 1
        : guaranteedItemsInColumn;
    result[i] = itemsToDistribute.slice(startIndex, startIndex + itemsToAdd);
    distributedCount += itemsToAdd;
  }
  return result;
}

export function splitItemsColumnFill<T>(
  input: T[],
  columns: number,
  maxRows: number
): T[][] {
  const maxItemsDisplayed = Math.min(
    maxRows === Infinity ? input.length : columns * maxRows,
    input.length
  );
  const result: T[][] = Array(columns)
    .fill(null)
    .map(() => []);
  let currentColumn = 0;
  let currentRow = 0;
  for (let i = 0; i < maxItemsDisplayed; i++) {
    if (currentRow >= maxRows) {
      currentRow = 0;
      currentColumn += 1;
    }
    result[currentColumn].push(input[i]);
    currentRow += 1;
  }
  return result;
}

export function splitItemsRow<T>(
  input: T[],
  columns: number,
  maxRows: number
): T[][] {
  const maxItemsDisplayed = Math.min(
    maxRows === Infinity ? input.length : columns * maxRows,
    input.length
  );
  const result: T[][] = Array(columns)
    .fill(null)
    .map(() => []);
  let currentColumn = 0;
  for (let i = 0; i < maxItemsDisplayed; i++) {
    if (currentColumn >= columns) {
      currentColumn = 0;
    }
    result[currentColumn].push(input[i]);
    currentColumn += 1;
  }
  return result;
}

export type SizePixels = `${number}px`;

export type RenderingOrder = "column" | "column-fill" | "row";

export type ColumnsProps = {
  columnCount: number;
  maxRows?: number;
  order?: RenderingOrder;
  gapX?: SizePixels;
  gapY?: SizePixels;
};

export type SplittingFunction = <T>(
  input: T[],
  columns: number,
  maxRows: number
) => T[][];

Devvit.addMenuItem({
  location: "subreddit",
  label: "Events Board",
  onPress: async (_, context) => {
    const { reddit, ui } = context;
    const currentSubreddit = await reddit.getCurrentSubreddit();
    await reddit.submitPost({
      title: "Events Board",
      subredditName: currentSubreddit.name,
      preview: (
        <vstack padding="medium" cornerRadius="medium">
          <text style="heading" size="medium">
            Fetching Events...
          </text>
        </vstack>
      ),
    });
    ui.showToast(`Created an events board in r/${currentSubreddit.name}!`);
  },
});

export default Devvit;
