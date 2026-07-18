window.EMMYTECH_SMS_CONFIG = {
  // Use the Ambassador Supabase project values.
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",

  // WhatsApp number in international format without + or spaces.
  whatsappNumber: "2348000000000",

  // Change this after GitHub Pages is enabled for the new repository.
  // Do not add a trailing slash.
  publicBaseUrl: "https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY",

  // This is the fixed message that opens in WhatsApp.
  whatsappClaimMessage: "Hello EmmyTech, I want to claim my 2 free spins.",

  // Current campaign SMS text. Keep {{first_name}} and {{short_link}} unchanged.
  defaultSmsTemplate:
    "{{first_name}}, you spun the EmmyTech wheel before. It is back with better rewards, and you have 2 FREE SPINS waiting.\n\nMessage us on WhatsApp to claim: {{short_link}}",
};
