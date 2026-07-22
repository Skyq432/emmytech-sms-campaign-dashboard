window.EMMYTECH_SMS_CONFIG = {
  // Use the Ambassador Supabase project values.
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",

  // WhatsApp number in international format without + or spaces.
  whatsappNumber: "2348000000000",

  // Change this after GitHub Pages is enabled for the new repository.
  // Do not add a trailing slash.
  publicBaseUrl: "https://go.emmytechnology.com",

  // This is the fixed message that opens in WhatsApp.
  whatsappClaimMessage: "Hello EmmyTech, I want to claim my 2 free spins.",

  // Current campaign SMS text. Keep {{first_name}} and {{short_link}} unchanged.
  defaultSmsTemplate:
    "You spun our wheel! You're among the lucky few invited to our FREE Laptop Maintenance Training. Join & get certified. Chat: {{short_link}}",
};
