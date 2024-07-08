import {Devvit, RichTextBuilder, Post, RedditAPIClient, FormValues} from '@devvit/public-api'
import { usePagination } from '@devvit/kit';

Devvit.configure({ media: true, redditAPI: true, redis: true});

type Event = {
  title: string, 
  date: string,  
  startTime: string,  
  endTime: string,  
  link: string,  
  description: string, 
  attending: []
}

Devvit.addCustomPostType({
  name: 'Name',
  render: (context) => {

    const[localEvents, setLocalEvents] = context.useState<Event[]>(async () => {
      const eventsStr = await context.redis.get("eventapp")

      if(!eventsStr) {
        return []
      }

    return JSON.parse(eventsStr) 

    });

    //when form is submitted update upcomingEvents

    const onSubmit = async (values: any) => {
      const newLocalEvents: Event[] = [values, ...localEvents]
      
      //update redis data 
      await context.redis.set("eventapp", JSON.stringify(newLocalEvents));
    
      setLocalEvents(newLocalEvents);
      
      context.ui.showToast("Event created!");

    };

    const {currentPage, currentItems, toNextPage, toPrevPage} = usePagination(context, localEvents, 3);
  
    const eventForm = context.useForm(
      {
        title: 'Add Event',
        fields: [
          {
            type: 'string',
            name: 'title',
            label: 'Event Title: MUST be unique',
          },
          {
            type: 'string',
            name: 'date',
            label: 'Date',
          },
          {
            type: 'string',
            name: 'startTime',
            label: 'Start Time ex. 00:00 ET OR "All Day"',
          },
          {
            type: 'string',
            name: 'endTime',
            label: 'End Time ex. 00:00 ET',
          },
          {
            type: 'string',
            name: 'link',
            label: 'Link',
          },
          {
            type: 'string',
            name: 'description',
            label: 'Description',
          },
        ],
        acceptLabel: 'Add',
      },
      onSubmit
    );

    // Render the form
    return (
      <vstack>
        <vstack 
          width = "100%"
          height="64px"
          backgroundColor = "#003285"
        > 
        <hstack padding='small' alignment='middle'>
            <text color='white' size='xxlarge' weight='bold'>r/1234567890123456789012</text>

            <zstack grow alignment='end middle'>
            <button size="medium" onPress={() => context.ui.showForm(eventForm)}> Add Event </button>
            </zstack>
            </hstack>
        </vstack> 

        {/* Rendering items for the current page */}
        <vstack gap="small" padding="small" minHeight="200px" >
          {currentItems.map(item => (<ItemComponent item={item}/>))}    
        </vstack>

        {/* Rendering pagination controls */}
        <hstack alignment="middle center" gap="small">
          <button onPress={toPrevPage} icon="left"/>
          <text>{currentPage}</text>
          <button onPress={toNextPage} icon="right"/>
        </hstack>  
      </vstack>  
    );
  },
});



const ItemComponent = (props:{item: Event}): JSX.Element =>{
  return (
    <vstack>
      


        <hstack>
          
          <vstack>
          <hstack gap='small'>
            <text size='xxlarge' weight='bold'>{props.item.title}</text>
            <button size="small" icon="info" /> 
          </hstack>         
            <vstack>
            <text weight='bold'>{props.item.date}</text>
          </vstack>   
          </vstack>
            
            <hstack alignment="end middle" grow gap='small'>
              <text alignment="end" size='xxlarge'>{props.item.startTime}</text>
              <button icon="notification" size="small"></button>
            </hstack>        
      </hstack>
      <vstack backgroundColor='#F1F1F1' height="2px">

      </vstack>
      </vstack>

      
  )};





function getSplittingFunction(order: RenderingOrder): SplittingFunction {
  if (order === 'column') {
    return splitItems;
  }
  if (order === 'column-fill') {
    return splitItemsColumnFill;
  }
  if (order === "row") {
    return splitItemsRow;
  }
  // render one column as a default behaviour
  return (items) => [[...items]];
}

export const Columns = (props: Devvit.BlockComponentProps<ColumnsProps>): JSX.Element => {
  if (!props.children || !Array.isArray(props.children)) {
    return <>{props.children}</>;
  }
  const order = props.order || 'column';
  const columnCount = props.columnCount > 0 ? props.columnCount : 1;
  const maxRows = props.maxRows && props.maxRows > 0 ? props.maxRows : Infinity;
  const gapXpx = props.gapX ? Number(props.gapX.split('px')[0]) : 0;
  const gapX: SizePixels = gapXpx && gapXpx > 0 ? `${gapXpx}px` : '0px';
  const gapYpx = props.gapY ? Number(props.gapY.split('px')[0]) : 0;
  const gapY: SizePixels = gapYpx && gapYpx > 0 ? `${gapYpx}px` : '0px';
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

export function splitItems<T>(input: T[], columns: number, maxRows: number): T[][] {
  const maxItemsDisplayed = Math.min(
    maxRows === Infinity ? input.length : columns * maxRows,
    input.length
  );
  const itemsToDistribute = input.slice(0, maxItemsDisplayed);
  const guaranteedItemsInColumn = Math.floor(itemsToDistribute.length / columns);
  let distributedCount = 0;
  const result: T[][] = Array(columns)
    .fill(null)
    .map(() => []);
  for (let i = 0; i < columns; i++) {
    const startIndex = distributedCount;
    const itemsLeftCount = itemsToDistribute.length - distributedCount;
    const columnsLeft = columns - i;
    const itemsToAdd =
      itemsLeftCount % columnsLeft ? guaranteedItemsInColumn + 1 : guaranteedItemsInColumn;
    result[i] = itemsToDistribute.slice(startIndex, startIndex + itemsToAdd);
    distributedCount += itemsToAdd;
  }
  return result;
}

export function splitItemsColumnFill<T>(input: T[], columns: number, maxRows: number): T[][] {
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

export function splitItemsRow<T>(input: T[], columns: number, maxRows: number): T[][] {
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

export type SplittingFunction = <T>(input: T[], columns: number, maxRows: number) => T[][]





Devvit.addMenuItem({
  location: 'subreddit',
  label: 'Events Board',
  onPress: async (_, context) => {
    const { reddit, ui } = context;
    const currentSubreddit = await reddit.getCurrentSubreddit();
    await reddit.submitPost({
      title: 'Events Board',
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

 