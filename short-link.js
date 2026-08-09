(async () => {
  "use strict";

  const config =
    window.EMMYTECH_SMS_CONFIG || {};

  const title =
    document.getElementById("claimTitle");

  const message =
    document.getElementById("claimMessage");

  const manualLink =
    document.getElementById("manualProductLink");


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


  function showManual(
    heading,
    body
  ) {
    title.textContent =
      heading ||
      "Continue to EmmyTech Products";

    message.textContent =
      body ||
      "Tap below to continue to the product catalogue.";

    manualLink.href =
      productUrl();

    manualLink.classList.remove(
      "hidden"
    );
  }


  if (
    !config.supabaseUrl ||
    !config.supabaseAnonKey ||
    !trackingToken
  ) {
    showManual(
      "Open EmmyTech Products",
      "We could not identify this SMS link automatically."
    );

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


    title.textContent =
      "Connecting your Cash-Off…";

    message.textContent =
      "Please wait while we securely connect your existing EmmyTech account.";


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
        "A secure product handoff could not be created."
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


    title.textContent =
      "Opening your products…";

    message.textContent =
      "Your Cash-Off account is ready.";


    window.location.replace(
      destination.toString()
    );


    window.setTimeout(
      () => {
        manualLink.href =
          destination.toString();

        manualLink.classList.remove(
          "hidden"
        );
      },
      1800
    );

  }

  catch (error) {

    console.error(
      "SMS product handoff failed:",
      error
    );


    showManual(
      "We could not connect automatically",
      "You can still open EmmyTech Products below."
    );

  }

})();
