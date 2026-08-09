(() => {
  const hostname = window.location.hostname;
  const isLocal =
    hostname === "127.0.0.1" ||
    hostname === "localhost";

  const local = {
    environment: "local-testing",
    supabaseUrl: "http://127.0.0.1:55321",
    supabaseAnonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
    publicBaseUrl: "http://127.0.0.1:5500",
    productBaseUrl: "http://127.0.0.1:3000/products",
  };

  const production = {
    environment: "production",
    supabaseUrl: "https://autndhyvgfndaiahonlx.supabase.co",
    supabaseAnonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1dG5kaHl2Z2ZuZGFpYWhvbmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODcyNDQsImV4cCI6MjA5NTY2MzI0NH0.OOwxenV5Ono5BhP6UtoEo313f9gKrX9vL4trT9ed_Aw",
    publicBaseUrl: "https://go.emmytechnology.com",
    productBaseUrl: "https://emmytechnology.com/products",
  };

  const environment =
    isLocal ? local : production;

  window.EMMYTECH_SMS_CONFIG = {
    ...environment,

    whatsappNumber: "2348146503700",

    whatsappClaimMessage:
      "Hello EmmyTech, I want to use my Cash-Off on a product.",

    defaultSmsTemplate:
      "Your EmmyTech Cash-Off is still available. See products you can use it on today: {{short_link}}",
  };
})();
