# Typography tokens and mapping

## Font family and weight policy

- Typeface: Inter throughout the product.
- Supported weights: `400 Regular`, `500 Medium`, `600 SemiBold`, `700 Bold`, `800 ExtraBold`.
- Avoid `100, 200, 300, 900` as they are outside the project-approved system.
- If the deployment has missing font files, do not silently point all variants to Regular. Fix the font import or explicitly document fallback.

## Delivery/super-app screenshot baseline

| UI element | Screenshot specification | Adopted implementation |
| --- | --- | --- |
| Section headers | 18–22px Bold | `sectionTitleSmall` 18/24/700; `sectionTitle` 20/26/700; `screenTitle` 22/28/700 |
| Card titles & input fields | 16px SemiBold/Bold | Titles 16/24/600 or 700; input values 16/24/400 for readability |
| Menu item names & prices | 14px Medium/Regular | Names 14/20/500; body 14/20/400; prices 14/20/600 |
| Metadata & descriptions | 12px Regular | Metadata 12/17/400; longer descriptions 14/20/400 |
| Bottom-nav labels | 10–11px | Default 11/14/500; optional 10/14/500 only when legible |

## Extended use cases

- Price emphasis within a large card: 16/24/700.
- Progress/metric emphasis: 22/28/800 only as needed.
- Labels on compact badges: 12/16/600.
- Field labels: 12/16/500; increase if context demands.
- Buttons and links: 14/20/600 and use additional decoration/state for link affordance.
- Toast: 14/20/500 for primary message or 12/17/400 for optional support text.

## Good usage examples

- Order screen: `sectionTitle` Order Again; `cardTitle` Chicken Meal; `price` ₱159; `metadata` Delivery in 25–35 min.
- Job marketplace: `screenTitle` Available Jobs; `cardTitle` Repair kitchen faucet; `bodyMedium` Household repair; `metadata` Posted today; `button` Apply.
- Profile screen: `screenTitle` Profile; `cardTitle` Account Information; `fieldLabel` Mobile Number; `inputText` 09XXXXXXXXX.

## Common defects to fix

- Mixed font families across tabs, forms, and cards.
- Overuse of 700/800 so the hierarchy disappears.
- 12px long paragraphs or 10px instructions.
- Different size for each bottom navigation label.
- Too-small inputs that become difficult to read or cause browser zoom behavior.
- Fixed-height cards clipping when text grows.
- Fake Bold from incorrect font registration.
