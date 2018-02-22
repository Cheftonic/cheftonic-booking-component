# Make booking component

This component is used to show a booking form for a particular restaurant.

## How it works
Before starting, a few conditions....
1. If the user is not authenticated, it shows a message telling the user the need for authentication in order to book.
2. If the user is authenticated, checks for the phone. If the phone is not present, this field is added to the form and the customer profile is updated when the booking request is submitted.

Then the booking form is displayed, with the following components:

1. Pax: Number of people.
2. Date: using the calendar component, a calendar is displayed, with today marked as the default day.
3. Time: using the hour-minute component, the user can select the time of the booking. The default time is the next o'clock hour.
4. Notes: The user can add any further notes for the restaurant.
