Farmstand Experimental is Mark's app that houses years of data about his garden. The application’s purpose is to log data about seeds planted in indexed seed beds, buckets and trays across his yard, including when, where, what, and how, and their performance over time.

Because this app is for personal use it does not require a full authentication system for multiple users. There will be an allowed list of users that can access the app.

The app will be accessed by smartphone and on desktop so a mobile optimized UI is required, but it is expected there will be some more advanced dashboards or data views available on desktop.

Data Model \- table name followed by details

1. Plants
   1. Mandatory field (format) \[source\]:
      1. Number (\#\#\#\# or "x"&\#\#\# or \#\#\#\#.\# or "x"&\#\#\#.\#)
      2. Name (text)
   2. Optional fields (format):
      1. Type (text)
      2. Scientific name (text)
2. Slots
   1. Mandatory fields (format) \[source\]:
      1. SlotID (text)
      2. SpaceType \["Bucket","Tray","RaisedBed","Bin"\]
      3. State \[null,"Growing","Prepped for Spring","Fallow","Pending Installation"\]
      4. LastChange (m/d/yyyy)
   2. Optional fields (format) \[source\]:
      1. Notes (long text)
      2. PlanChange (m/d/yyyy)
3. Actions
   1. Field (format) \[source\]:
      1. Activity \["Plant","Transplant","Fertilize","Harvest","Prep for Spring"\]

Each Bucket has 1 Slot, each Tray has 1 Slot , each SeedBin has 15 slots, and each RaisedBed has between 1 and 7 Slots. Therefore, of all SpaceTypes, RaisedBeds and SeedBins each have a Subspace characteristic. Trays have a further

| SpaceType | Subspace                     | SlotIDs                                                                                 |
| :-------- | :--------------------------- | :-------------------------------------------------------------------------------------- |
| Bucket    | Does not apply               | "B01","B02"..."B50"                                                                     |
| Tray      | Does not apply               | "Tray01","Tray02"..."Tray99"                                                            |
| SeedBin   | "Bin A","Bin B"..."Bin BB"   | "Bin A-01","Bin A-02"..."Bin A-15",,"Bin B-01","Bin B-02"..."Bin B-15"......"Bin BB-15" |
| RaisedBed | "Bed 01","Bed 02"..."Bed 30" | "Bed A-01","Bin A-02"..."Bin A-15",,"Bin B-01","Bin B-02"..."Bin B-15"......"Bin BB-15" |
|           |                              |                                                                                         |

Here are the views/functions the app needs on Mobile

Work Log View:  
The user will create work models by filling out a form. They can add plants by Name or Number, and enter the date (should auto-suggest Today()), activity, and location of the work performed, and optionally add free-form notes.

Example

Number \= '9382.1  
Name \= "Rosemary" (this auto-populated based on Number value entered by user)  
Date \= 3/18/2025  
SpaceType \= "Tray"  
Location \= "Tray 45" (corresponds with SlotID "T45")  
Activity \= "Plant"  
Notes \= null

When the user saves the entry, the corresponding record in the SlotID table should update, as follows.

| State                | Activity \= "Plant" | Activity \= "Transplant" | Activity \= "Fertilize" | Activity \= "Harvest" | Activity \= "Prep for Spring" | Activity \= Install |
| :------------------- | :------------------ | :----------------------- | :---------------------- | :-------------------- | :---------------------------- | :------------------ |
| Growing              | impossible          | "Fallow"                 | "Growing"               | null                  | "Prepped for Spring"          | impossible          |
| Prepped for Spring   | "Growing"           | impossible               | impossible              | impossible            | "Prepped for Spring"          | impossible          |
| Fallow               | "Growing"           | impossible               | impossible              | impossible            | "Prepped for Spring"          | impossible          |
| Pending Installation | "Growing"           | impossible               | impossible              | impossible            | "Prepped for Spring"          | "Fallow"            |

If State \= "Growing", we need to assign a value from Plants to that slot.

Lookup by Space View  
The user will select a SpaceType, and from there, select a Subspace or SlotID. The app will return the Plants value that is in that SlotID, and a date and description of the last State change.

Lookup by Plant View  
The user will type in a Name or Number that is Plants. For Name, fuzzy matching is allowed. The app will return the Slot as SlotID.
