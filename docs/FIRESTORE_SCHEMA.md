# Firestore Schema

Collections and document structures used by Farmstand Experimental.

## config/allowedUsers

| Field    | Type       | Required | Description                  |
| -------- | ---------- | -------- | ---------------------------- |
| `emails` | `string[]` | Yes      | Allowed user email addresses |

---

## plants

| Field            | Type     | Required | Description                      |
| ---------------- | -------- | -------- | -------------------------------- |
| `number`         | `string` | Yes      | Plant ID (e.g. `9382.1`, `x123`) |
| `name`           | `string` | Yes      | Plant name                       |
| `type`           | `string` | No       | Plant type                       |
| `scientificName` | `string` | No       | Scientific name                  |

---

## slots

| Field          | Type                | Required | Description                                    |
| -------------- | ------------------- | -------- | ---------------------------------------------- |
| `slotId`       | `string`            | Yes      | Slot ID (e.g. `B01`, `Tray45`, `Trough 01-03`) |
| `spaceType`    | `SpaceType`         | Yes      | `"Bucket"`, `"Tray"`, `"Trough"`, `"Bin"`      |
| `subspace`     | `string`            | No       | Sub-space (e.g. `"Trough 01"`, `"Bin A"`)      |
| `state`        | `SlotState \| null` | Yes      | Slot state (see below)                         |
| `lastActivity` | `Activity \| null`  | No       | Last activity performed                        |
| `lastChange`   | `Timestamp`         | Yes      | Last state change date                         |
| `plantNumber`  | `string \| null`    | No       | Current plant number in this slot              |
| `plantName`    | `string \| null`    | No       | Current plant name in this slot                |
| `notes`        | `string`            | No       | Free-form notes                                |
| `planChange`   | `Timestamp`         | No       | Planned change date                            |

**SlotState:** `null`, `"Growing"`, `"Prepped for Spring"`, `"Fallow"`, `"Pending Installation"`, `"Seed"`

**Activity:** `"Plant"`, `"Transplant"`, `"Fertilize"`, `"Flip"`, `"Pick"`, `"Prep for Spring"`, `"Install"`

---

## workLogs

| Field         | Type        | Required | Description                               |
| ------------- | ----------- | -------- | ----------------------------------------- |
| `plantNumber` | `string`    | Yes      | Plant number for the activity             |
| `plantName`   | `string`    | Yes      | Plant name for the activity               |
| `date`        | `Timestamp` | Yes      | When the activity occurred                |
| `spaceType`   | `SpaceType` | Yes      | `"Bucket"`, `"Tray"`, `"Trough"`, `"Bin"` |
| `slotId`      | `string`    | Yes      | Slot where the activity was performed     |
| `activity`    | `Activity`  | Yes      | Type of activity (see above)              |
| `notes`       | `string`    | No       | Free-form notes                           |
| `createdAt`   | `Timestamp` | Yes      | When the log was created (server-set)     |
