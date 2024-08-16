import { expect, test } from 'vitest'
import {get15MinsBefore} from './main.tsx'
test("calculates 15 mins before date", () => {
    const date = new Date("2021-01-01T00:00:00Z")
    const result = get15MinsBefore(date)
    expect(result).toBe("2020-12-31T23:45:00.000Z")
})

test("calculates 15 mins before null date", () => {
    const date = null
    const result = get15MinsBefore(date)
    expect(result).toBe(console.error("Invalid date"));
})

test("sends user event info", () => {
    
   //create an event without a link. make sure the message still sends correctly

})

test("user RSVPs within 15 mins of event", () => {
    
   //user should recieve link after RSVPing if the event hasnt started yet

})