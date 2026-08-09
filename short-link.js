(async () => {
  "use strict";

  const config =
    window.EMMYTECH_SMS_CONFIG || {};

  const fallback =
    document.getElementById(
      "handoffFallback"
    );

  const fallbackMessage =
    document.getElementById(
      "fallbackMessage"
    );

  const manualLink =
    document.getElementById(
      "manualProductLink"
    );


  const cleanPath =
    decodeURIComponent(
      window.location.pathname
    )
      .replace(
        /^\/+|\/+$/g,
        ""
      );


  const trackingToken =
    cleanPath.split("/")[0] || "";


  function productUrl() {
    return (
      config.productBaseUrl ||
      "http://127.0.0.1:3000/products"
    );
  }


  function showFallback(message) {
    manualLink.href =
      productUrl();

    fallbackMessage.textContent =
      message ||
      "Open our products and continue shopping.";

    fallback.hidden =
      false;
  }


  if (
    !config.supabaseUrl ||
    !config.supabaseAnonKey ||
    !trackingToken
  ) {
    showFallback();

    return;
  }


  try {
    const client =
      window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseAnonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );


    const {
      data,
      error,
    } =
      await client.rpc(
        "create_sms_product_handoff",
        {
          p_tracking_token:
            trackingToken,
        }
      );


    if (error) {
      throw error;
    }


    const result =
      Array.isArray(data)
        ? data[0]
        : data;


    const handoffToken =
      result?.handoff_token;


    if (!handoffToken) {
      throw new Error(
        "Product handoff unavailable."
      );
    }


    const destination =
      new URL(
        productUrl()
      );


    destination.searchParams.set(
      "sms_handoff",
      handoffToken
    );


    destination.searchParams.set(
      "source",
      "cashoff_sms"
    );


    // No loading screen.
    // No customer-facing system message.
    // Just continue directly to Products.
    window.location.replace(
      destination.toString()
    );
  }

  catch (error) {
    console.error(
      "SMS product handoff failed:",
      error
    );

    showFallback(
      "Your products are still available. Tap below to continue."
    );
  }
})();
