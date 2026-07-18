window.EMMYTECH_SMS_CONFIG = {
  // Use the Ambassador Supabase project values.
  supabaseUrl: "https://autndhyvgfndaiahonlx.supabase.co",

  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1dG5kaHl2Z2ZuZGFpYWhvbmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODcyNDQsImV4cCI6MjA5NTY2MzI0NH0.OOwxenV5Ono5BhP6UtoEo313f9gKrX9vL4trT9ed_Aw",

  // WhatsApp number in international format without + or spaces.
  whatsappNumber: "2348146503700",

  // Local address for testing.
  // Do not add a trailing slash.
  publicBaseUrl: "https://skyq432.github.io/emmytech-sms-campaign-dashboard",

  // This is the fixed message that opens in WhatsApp.
  whatsappClaimMessage:
    "Hello EmmyTech, I want to claim my 2 free spins.",

  // Current campaign SMS text.
  defaultSmsTemplate:
    "{{first_name}}, you spun the EmmyTech wheel before. It is back with better rewards, and you have 2 FREE SPINS waiting.\n\nMessage us on WhatsApp to claim: {{short_link}}",
};