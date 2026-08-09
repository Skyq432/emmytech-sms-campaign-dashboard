window.EMMYTECH_SMS_CONFIG = {
  // ==========================================================
  // LOCAL TESTING ENVIRONMENT
  // ==========================================================
  // This testing branch talks ONLY to the local Supabase
  // instance running in Docker.
  environment: "local-testing",

  supabaseUrl: "http://127.0.0.1:55321",

  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",

  // EmmyTech WhatsApp number.
  whatsappNumber: "2348146503700",

  // Local SMS dashboard.
  // Unique campaign links will eventually look like:
  // http://127.0.0.1:5500/abc123
  publicBaseUrl: "http://127.0.0.1:5500",

  // Local EmmyTech product website.
  // We will connect this properly in the next phase.
  productBaseUrl: "http://127.0.0.1:3000/products",

  // Legacy fallback message.
  // The new campaign will lead customers to Products,
  // not directly to WhatsApp.
  whatsappClaimMessage:
    "Hello EmmyTech, I want to use my Cash-Off on a product.",

  // New campaign default.
  defaultSmsTemplate:
    "Your EmmyTech Cash-Off is still available. See products you can use it on today: {{short_link}}",
};
