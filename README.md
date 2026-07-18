# EmmyTech SMS Outreach Dashboard

A standalone HTML dashboard for preparing and tracking the Spin Wheel reactivation SMS campaign.

## What this MVP does

- Uses the **Ambassador Supabase project** as its database.
- Syncs migrated players from `public.spin_players`.
- Imports the old WhatsApp outreach labels by CSV.
- Targets only leads labelled **Not Messaged**.
- Excludes **Messaged** and **Messaged Us Before**.
- Creates unique tracking links that record a click and open WhatsApp.
- Exports personalised SMS records as CSV.
- Tracks selected, exported, sent, delivered, clicked and WhatsApp-claimed stages.
- Does **not** integrate with or send through an SMS provider.

## Selected SMS

```text
{{first_name}}, you spun the EmmyTech wheel before. It is back with better rewards, and you have 2 FREE SPINS waiting.

Message us on WhatsApp to claim: {{short_link}}
```

## Setup

### 1. Run the database setup

Open the **Ambassador Supabase project**:

1. Open SQL Editor.
2. Create a new query.
3. Paste everything from `supabase-setup.sql`.
4. Run it once.

The script creates the campaign tables and then syncs valid records from `spin_players`.

### 2. Configure the website

Open `config.js` and replace:

- `supabaseUrl`
- `supabaseAnonKey`
- `whatsappNumber`
- `publicBaseUrl`

Use the WhatsApp number in this form:

```text
2348012345678
```

Do not include `+`, spaces or dashes.

### 3. Publish on GitHub Pages

Create a new public GitHub repository, upload all files, then open:

`Settings > Pages > Deploy from a branch > main > /(root) > Save`

After GitHub gives you the public URL, return to `config.js` and set `publicBaseUrl` to that exact URL without a final slash.

### 4. Import old outreach labels

On the old WhatsApp outreach dashboard, download its CSV. In the new dashboard:

1. Click **Import Old Labels**.
2. Choose the CSV.
3. Confirm the preview counts.
4. Click **Import Labels**.

The importer accepts common columns such as:

- `phone_number`, `phone`, `number`, `whatsapp_number`
- `label`, `status`, `outreach_status`

It normalises Nigerian phone numbers before matching.

### 5. Prepare the first test

1. Save the campaign.
2. Enter `20` under **Number to prepare now**.
3. Click **Prepare Recipients**.
4. Click **Export SMS CSV**.
5. Upload the exported file to the selected bulk-SMS provider.

## Tracking rule

The WhatsApp message contains no claim code. It is fixed as:

```text
Hello EmmyTech, I want to claim my 2 free spins.
```

Because that message is used only for this campaign, any incoming copy is treated as an SMS response. Search the person's WhatsApp number on the dashboard and click **Claimed**.

## Files

- `index.html` — dashboard
- `claim.html` — tracking redirect to WhatsApp
- `styles.css` — EmmyTech design
- `app.js` — dashboard behaviour
- `claim.js` — click tracking and WhatsApp redirect
- `config.js` — live configuration
- `config.example.js` — safe template
- `supabase-setup.sql` — Ambassador database setup
