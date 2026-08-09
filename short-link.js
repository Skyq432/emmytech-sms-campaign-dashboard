(async () => {
  "use strict";

  const config =
    window.EMMYTECH_SMS_CONFIG || {};

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

  function continueToProducts() {
    window.location.replace(
      productUrl()
    );
  }

  if (
    !config.supabaseUrl ||
    !config.supabaseAnonKey ||
    !trackingToken
  ) {
    continueToProducts();
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

    window.location.replace(
      destination.toString()
    );
  }
  catch (error) {
    console.error(
      "SMS product handoff failed:",
      error
    );

    continueToProducts();
  }
})();
