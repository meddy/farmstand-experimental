# Farmstand

Mark's garden operations vocabulary: seeds, plants, physical growing locations, and sowing schedules. This glossary is the shared language between the domain expert and the app — not an implementation spec.

## Language

### Plants and seeds

**2022 NUMBER**:
The base key for all records. A four-digit number (`0000`–`9999`) where `2022` is the catalog year. Decimals identify an **INSTANCE**. One base number can have many instances at once (e.g. `9382.1`, `9382.2`, `9382.3`). Displayed in the app as "Plant ID".
_Avoid_: Plant number

**INSTANCE**:
A specific individual plant or seed packet, identified by a decimal suffix on a **2022 NUMBER** (e.g. `9382.1`).
_Avoid_: Decimal, variant

**COMMON NAME**:
The name of a plant or the seed it bears. Begins with an ALL-CAPS **category** prefix (one or more words), optionally followed by a **variety** in quotes (e.g. `OREGANO "True Greek"`, or just `OREGANO`). Tied to the base **2022 NUMBER** — every instance of a base number shares the same common name.
_Avoid_: Plant name

**TYPE**:
A mandatory, broader plant grouping that can span several common names (e.g. `RAPINI` is of type `BROCCOLI`; `COLLARDS` and `CABBAGE` are both of type `CABBAGE`). Constant for a given base **2022 NUMBER**. Sometimes equals the COMMON NAME category prefix, but not always. Defaults to `Undetermined` when unknown.

**SCIENTIFIC NAME**:
A mandatory botanical name. Constant for a given base **2022 NUMBER**. Defaults to `Undetermined` when unknown.

### Sowing schedule

**PLANT IT**:
A sowing schedule entry: a date plus a **sowing method** (`DS`, `ID`, or `PP`). An *upcoming* PLANT IT is a plan held at the base **2022 NUMBER** level (may be blank before planning). When the sowing actually happens, it is assigned to the specific **INSTANCE** sown, becomes a *past* entry on that instance, and the upcoming slot clears. Past entries accumulate as history.
_Avoid_: Plan change, sow date

**DIRECT SOW (DS)**:
Sowing method: seeds planted outdoors in troughs, pots, garden beds, or buckets.

**IN DOORS (ID)**:
Sowing method: seeds started indoors in flats under controlled germination conditions.

**PERMANENT PERENNIAL (PP)**:
Sowing method: planting a permanent perennial — an instance expected to live across multiple years or seasons — in a slot.

### Locations

**SPACE**:
A physical growing or storage container. Identified by a type letter, a hyphen, and **three** digits (e.g. `T-001`, `B-032`); a **VAULT** is identified by `V-` plus its letter(s) (e.g. `V-A`, `V-BB`). Each code maps to a display name (e.g. `T-001` is "Trough 1", `V-A` is "Vault A"). A SPACE contains one or more **SLOT**s.
_Avoid_: Subspace (legacy app term — same concept as SPACE)

**SLOT**:
A position within a **SPACE** where a seed is sown, a plant is grown, or a seed packet or jar is stored. Written as the SPACE identifier plus a decimal (e.g. `B-032.1`, `F-001.1`, `V-A.1`). Every plant logged occupies exactly one SPACE + one SLOT.
_Avoid_: Slot ID, packet

**TROUGH** (`T-###`):
A galvanized raised bed at a fixed yard location. 45 planned, 31 built. Holds 4–12 slots depending on size; the count varies per trough and can change when the trough is reconfigured.
_Avoid_: Raised bed, bed

**FLAT** (`F-###`):
A standard 10×20 inch nursery tray for starting seeds indoors. 3 slots each (`F-001.1`, `F-001.2`, `F-001.3`).
_Avoid_: Tray

**BUCKET** (`B-###`):
A galvanized metal bucket or wash tub. 3 slots each.

**POT** (`P-###`):
A permanent ceramic, fiberglass, or plastic container. 1–4 slots, varying per pot.

**GARDEN BED** (`G-###`):
An in-ground planting area. 4–12 slots, varying per bed. Distinct from **TROUGH** — no overlap. (All locations labeled "bed" in legacy data are troughs, not garden beds.)
_Avoid_: Bed

**VAULT** (`V-A`, `V-BB`, …):
An airtight container storing seed packets and seed jars, identified by `V-` plus a one- or two-letter label and spoken as "Vault A". Holds 20–30 items typically (max 50); each packet or jar is a **SLOT** (`V-A.1`) and behaves the same way. A vault may hold items of the same base **2022 NUMBER** and of different base numbers. Seed storage occurs only in vaults, and vaults hold nothing but seed packets and seed jars.
_Avoid_: Tub, Bin, seed bin

## Relationships

- A base **2022 NUMBER** identifies one plant species; its decimals identify **INSTANCE**s.
- **COMMON NAME**, **TYPE**, and **SCIENTIFIC NAME** are each constant for a given base **2022 NUMBER**.
- A **TYPE** can group several **COMMON NAME**s (e.g. `CABBAGE` type covers `COLLARDS` and `CABBAGE`).
- An *upcoming* **PLANT IT** is planned per base **2022 NUMBER**; once sown it is assigned to one **INSTANCE** and recorded as history.
- A **SPACE** contains one or more **SLOT**s; every planted instance occupies exactly one SLOT.
- A **VAULT** stores seed packets and seed jars (instances) — both same and different base numbers.
- The plant catalog has one row per **INSTANCE** (each decimal is its own record).

## Example dialogue

> **Dev:** "If I sow `9382.1` indoors, what do I record?"
> **Domain expert:** "The base number's upcoming **PLANT IT** gets assigned to that **INSTANCE** with today's date and method `ID`, into a **FLAT** slot like `F-001.1`. That becomes history and the upcoming plan clears."
>
> **Dev:** "And the seed packet it came from lives where?"
> **Domain expert:** "In a **VAULT** — say `V-A`, 'Vault A'. A vault can hold packets for many different **2022 NUMBER**s."

## Flagged ambiguities

- None open. (Resolved: TROUGH slot count is variable per trough, 4–12, and can change on reconfigure.)

## Migration directives (not glossary — tracked for implementation)

- Replace `x` prefix on numbers with a leading `0` (`x123` → `0123`, `x123.1` → `0123.1`); no collisions expected. Stop using the prefix.
- Rename `Tub`/`Bin` → **VAULT** (codes `V-A`); `Tray` → **FLAT** throughout.
- Add **POT** and **GARDEN BED** space types.
- Convert all location IDs to `LETTER-###` format (3 digits, leading zeros); codes map to un-padded display names (`T-001` ↔ "Trough 1", `V-A` ↔ "Vault A").
- **TYPE** and **SCIENTIFIC NAME** become mandatory on plants, defaulting to `Undetermined`.
- Display the **2022 NUMBER** field as "Plant ID".
- Buckets and flats standardize to 3 slots each; troughs (4–12), pots (1–4), and garden beds (4–12) vary per unit.
- When a trough is reconfigured and a slot is removed, migrate/hide historical work logs tied to that slot.
- Sowing method ↔ space type is guidance only — not enforced.
- Legacy `BED`/`RaisedBed` → **TROUGH** mapping is correct (all old beds were troughs).
