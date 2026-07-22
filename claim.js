(async () => {
  "use strict";

  const config = window.EMMYTECH_SMS_CONFIG || {};
  const title = document.getElementById("claimTitle");
  const message = document.getElementById("claimMessage");
  const manualLink = document.getElementById("manualWhatsAppLink");
  const token = new URLSearchParams(window.location.search).get("t");

  function fallbackWhatsAppUrl() {
    const text = encodeURIComponent(config.whatsappClaimMessage || "Hello EmmyTech, I received the invitation for the FREE Laptop Maintenance Training. I want to join.");
    return `https://wa.me/${String(config.whatsappNumber || "").replace(/\D/g, "")}?text=${text}`;
  }

  function showManual(url, heading = "Continue to WhatsApp") {
    title.textContent = heading;
    message.textContent = "Tap the button below to message EmmyTech and join the FREE Laptop Maintenance Training.";
    manualLink.href = url;
    manualLink.classList.remove("hidden");
  }

  if (!config.supabaseUrl || !config.supabaseAnonKey || !token) {
    showManual(fallbackWhatsAppUrl());
    return;
  }

  try {
    const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc("record_sms_campaign_click", { p_tracking_token: token });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    const whatsappNumber = String(result?.whatsapp_number || config.whatsappNumber || "").replace(/\D/g, "");
    const whatsappText = encodeURIComponent(result?.whatsapp_message || config.whatsappClaimMessage || "Hello EmmyTech, I received the invitation for the FREE Laptop Maintenance Training. I want to join.");
    const url = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;
    manualLink.href = url;
    window.setTimeout(() => window.location.replace(url), 650);
    window.setTimeout(() => showManual(url), 2200);
  } catch (error) {
    console.error(error);
    showManual(fallbackWhatsAppUrl());
  }
})();
