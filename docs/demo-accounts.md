# Demo accounts: what you can and can't do

ArthaGrid has three public demo logins so anyone can try the product without signing up.

| Login | Password | Role |
|---|---|---|
| `admin@test.com` | `Password123` | Admin |
| `analyst@test.com` | `Password123` | Analyst |
| `viewer@test.com` | `Password123` | Viewer |

## How demo accounts work

- Demo accounts use a **separate sandbox database** (`arthagrid-demo`). Real accounts are stored somewhere else.
- Nothing you do in a demo account can change, or even touch, a real account's data.
- Everyone who uses a demo login shares the same sandbox, so you may see changes other visitors made. The sandbox can be reset at any time with `npm run seed:demo`.
- A yellow banner on every page tells you that you are on a demo account. Click it to see the restricted features.

## What each role can see

A role decides which pages you can open. Demo accounts follow the same rules as real accounts here.

| Page / feature | Viewer | Analyst | Admin |
|---|:---:|:---:|:---:|
| Overview | Yes | Yes | Yes |
| Transactions (view the list) | Yes | Yes | Yes |
| Budgets (view) | Yes | Yes | Yes |
| Settings (view, and change the theme) | Yes | Yes | Yes |
| Analytics | No | Yes | Yes |
| Forecast | No | Yes | Yes |
| Insights | No | Yes | Yes |
| Ask ArthaGrid (AI copilot) | No | Yes | Yes |
| Admin page (platform stats) | No | No | Yes |

## What each role can change

Only the Admin role can add or change financial data. This is true for real accounts and demo accounts alike.

| Action | Viewer | Analyst | Admin |
|---|:---:|:---:|:---:|
| Add a transaction | No | No | Yes (sandbox only on demo) |
| Edit a transaction | No | No | Yes (sandbox only on demo) |
| Delete a transaction | No | No | Yes (sandbox only on demo) |
| Create, edit or delete a budget | No | No | Yes (sandbox only on demo) |

On a demo account, these changes are allowed for the Admin login, but they only happen inside the sandbox. They never reach real data.

## Locked on every demo account

These are blocked for **all** demo logins, including the demo Admin. If you try, you get the message
"… is a restricted feature on demo accounts."

| Locked action | Why |
|---|---|
| Change your name | Demo logins are shared by many people. |
| Change your email | Same reason. |
| Change your password | Someone could lock everyone else out. |
| Turn weekly email reports on or off | It could send emails to outside addresses. |
| Change another user's role or details | Admin power, too risky on a shared login. |
| Deactivate a user | It could lock real people out of the demo. |
| Any other edit to account or profile details | Everything under account management is closed, so new features stay locked by default. |

The only thing you can still change in **Settings** is the **theme** (light, dark or system). That is saved in your own browser and does not touch the account.

## Quick summary

| | Real account | Demo account |
|---|---|---|
| Where data lives | Main database | Separate sandbox database |
| See the pages your role allows | Yes | Yes |
| Add, edit or delete transactions and budgets (Admin) | Yes | Yes (sandbox only) |
| Change name, email or password | Yes | **No** |
| Change email-report setting | Yes | **No** |
| Manage other users (roles, deactivate) | Yes (Admin) | **No** |
| Affects real users' data | Yes | **Never** |

## For developers

- The locked list is defined in `src/config/demoRestrictions.js` and enforced in `src/middleware/authenticate.js`.
- The database split is in `src/config/tenant.js`. See also decision #27 in `docs/decisions.md`.
- `npm run seed:demo` re-creates the demo accounts and sample data.
