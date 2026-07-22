(() => {
  "use strict";

  const config = window.EMMYTECH_SMS_CONFIG || {};
  const requiredConfig = ["supabaseUrl", "supabaseAnonKey", "whatsappNumber", "publicBaseUrl"];
  const missingConfig = requiredConfig.filter((key) => !config[key] || String(config[key]).includes("YOUR-"));

  const state = {
    client: null,
    campaign: null,
    recipients: [],
    oldLabelRows: [],
  };

  const els = {
    toast: document.getElementById("toast"),
    connectionBadge: document.getElementById("connectionBadge"),
    refreshButton: document.getElementById("refreshButton"),
    syncLeadsButton: document.getElementById("syncLeadsButton"),
    openImportButton: document.getElementById("openImportButton"),
    importDialog: document.getElementById("importDialog"),
    oldLabelsFile: document.getElementById("oldLabelsFile"),
    importPreview: document.getElementById("importPreview"),
    runImportButton: document.getElementById("runImportButton"),
    campaignName: document.getElementById("campaignName"),
    campaignKey: document.getElementById("campaignKey"),
    smsTemplate: document.getElementById("smsTemplate"),
    messagePreview: document.getElementById("messagePreview"),
    characterCount: document.getElementById("characterCount"),
    estimatedParts: document.getElementById("estimatedParts"),
    saveCampaignButton: document.getElementById("saveCampaignButton"),
    activateCampaignButton: document.getElementById("activateCampaignButton"),
    campaignStatus: document.getElementById("campaignStatus"),
    audienceLimit: document.getElementById("audienceLimit"),
    buildAudienceButton: document.getElementById("buildAudienceButton"),
    exportCsvButton: document.getElementById("exportCsvButton"),
    statusFilter: document.getElementById("statusFilter"),
    searchInput: document.getElementById("searchInput"),
    recipientRows: document.getElementById("recipientRows"),
    statTotalLeads: document.getElementById("statTotalLeads"),
    statEligible: document.getElementById("statEligible"),
    statSelected: document.getElementById("statSelected"),
    statClicked: document.getElementById("statClicked"),
    statClaimed: document.getElementById("statClaimed"),
    statSuccess: document.getElementById("statSuccess"),
  };

  function showToast(message, type = "success") {
    els.toast.textContent = message;
    els.toast.className = `toast show ${type}`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      els.toast.className = "toast";
    }, 3600);
  }

  function setBusy(button, busy, busyText = "Working...") {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function sanitizeCampaignKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  }

  function normalizeLabel(value) {
    const label = String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
    if (!label || label.includes("not messaged") || label === "new" || label === "uncontacted") return "not_messaged";
    if (label.includes("messaged us") || label.includes("inbound") || label.includes("replied")) return "messaged_us_before";
    if (label.includes("messaged") || label.includes("contacted") || label.includes("outbound")) return "messaged";
    return "not_messaged";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function makeTrackingLink(token) {
    const baseUrl = String(config.publicBaseUrl).replace(/\/$/, "");
    return `${baseUrl}/${encodeURIComponent(token)}`;
  }

  function personaliseMessage(template, firstName, shortLink) {
    const safeName = String(firstName || "Hi").trim() || "Hi";
    return String(template || "")
      .replaceAll("{{first_name}}", safeName)
      .replaceAll("{{short_link}}", shortLink)
      .replaceAll("{{whatsapp_link}}", shortLink);
  }

  function hasUnicode(text) {
    return /[^\x00-\x7F]/.test(text);
  }

  function estimateSmsParts(text) {
    const unicode = hasUnicode(text);
    const singleLimit = unicode ? 70 : 160;
    const concatLimit = unicode ? 67 : 153;
    if (text.length <= singleLimit) return 1;
    return Math.ceil(text.length / concatLimit);
  }

  function updateMessagePreview() {
    const template = els.smsTemplate.value;
    const sample = personaliseMessage(template, "David", "https://go.emmytechnology.com/A7K2QZ");
    els.messagePreview.textContent = sample;
    els.characterCount.textContent = sample.length.toLocaleString();
    const parts = estimateSmsParts(sample);
    els.estimatedParts.textContent = String(parts);
    els.estimatedParts.parentElement.lastChild.textContent = ` estimated SMS part${parts === 1 ? "" : "s"}`;
  }

  function parseCsv(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    const firstLine = source.split(/\r?\n/).find((line) => line.trim()) || "";

    const delimiters = [",", ";", "\t"];
    const delimiter = delimiters
      .map((item) => ({
        item,
        count: firstLine.split(item).length - 1,
      }))
      .sort((a, b) => b.count - a.count)[0].item;

    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      const next = source[i + 1];

      if (char === '"' && quoted && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(value);
        value = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(value);
        if (row.some((item) => item.trim() !== "")) rows.push(row);
        row = [];
        value = "";
      } else {
        value += char;
      }
    }

    row.push(value);
    if (row.some((item) => item.trim() !== "")) rows.push(row);
    if (!rows.length) return [];

    const headers = rows[0].map((header) =>
      String(header || "")
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    );

    return rows.slice(1).map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? ""])
      )
    );
  }

  function findValue(row, candidates) {
    for (const key of candidates) {
      if (row[key] !== undefined && String(row[key]).trim()) return String(row[key]).trim();
    }
    return "";
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function init() {
    els.smsTemplate.value = config.defaultSmsTemplate || "";
    updateMessagePreview();
    bindEvents();

    if (missingConfig.length) {
      els.connectionBadge.textContent = "Setup required";
      els.connectionBadge.className = "badge badge-warning";
      showToast(`Complete config.js: ${missingConfig.join(", ")}`, "error");
      disableDataButtons();
      return;
    }

    state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
      const { error } = await state.client.from("sms_campaigns").select("id", { count: "exact", head: true });
      if (error) throw error;
      els.connectionBadge.textContent = "Ambassador database connected";
      els.connectionBadge.className = "badge badge-active";
      await refreshAll();
    } catch (error) {
      console.error(error);
      els.connectionBadge.textContent = "Database setup required";
      els.connectionBadge.className = "badge badge-danger";
      showToast("Run supabase-setup.sql in the Ambassador Supabase project, then refresh.", "error");
      disableDataButtons();
    }
  }

  function disableDataButtons() {
    [els.syncLeadsButton, els.openImportButton, els.saveCampaignButton, els.activateCampaignButton, els.buildAudienceButton, els.exportCsvButton]
      .forEach((button) => { button.disabled = true; });
  }

  function bindEvents() {
    els.smsTemplate.addEventListener("input", updateMessagePreview);
    els.campaignKey.addEventListener("blur", () => { els.campaignKey.value = sanitizeCampaignKey(els.campaignKey.value); });
    els.refreshButton.addEventListener("click", refreshAll);
    els.syncLeadsButton.addEventListener("click", syncLeads);
    els.openImportButton.addEventListener("click", () => els.importDialog.showModal());
    els.oldLabelsFile.addEventListener("change", previewImportFile);
    els.runImportButton.addEventListener("click", importOldLabels);
    els.saveCampaignButton.addEventListener("click", saveCampaign);
    els.activateCampaignButton.addEventListener("click", activateCampaign);
    els.buildAudienceButton.addEventListener("click", buildAudience);
    els.exportCsvButton.addEventListener("click", exportCsv);
    els.statusFilter.addEventListener("change", renderRecipients);
    els.searchInput.addEventListener("input", renderRecipients);
    els.recipientRows.addEventListener("click", handleRecipientAction);
  }

  async function refreshAll() {
    if (!state.client) return;
    setBusy(els.refreshButton, true, "Refreshing...");
    try {
      await loadCampaign();
      await Promise.all([loadStats(), state.campaign ? loadRecipients() : Promise.resolve()]);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not refresh dashboard.", "error");
    } finally {
      setBusy(els.refreshButton, false);
    }
  }

  async function loadStats() {
    const { data, error } = await state.client.rpc("sms_dashboard_summary", {
      p_campaign_id: state.campaign?.id || null,
    });
    if (error) throw error;
    const summary = Array.isArray(data) ? data[0] : data;
    els.statTotalLeads.textContent = Number(summary?.total_leads || 0).toLocaleString();
    els.statEligible.textContent = Number(summary?.eligible_leads || 0).toLocaleString();
    els.statSelected.textContent = Number(summary?.selected_recipients || 0).toLocaleString();
    els.statClicked.textContent = Number(summary?.clicked_recipients || 0).toLocaleString();
    els.statClaimed.textContent = Number(summary?.claimed_recipients || 0).toLocaleString();
    els.statSuccess.textContent = `${Number(summary?.success_rate || 0).toFixed(1)}%`;
  }

  async function loadCampaign() {
    const key = sanitizeCampaignKey(els.campaignKey.value);
    if (!key) return;
    const { data, error } = await state.client
      .from("sms_campaigns")
      .select("*")
      .eq("campaign_key", key)
      .maybeSingle();
    if (error) throw error;
    state.campaign = data;

    if (data) {
      els.campaignName.value = data.name;
      els.smsTemplate.value = data.message_template;
      updateMessagePreview();
      els.campaignStatus.textContent = data.status;
      els.campaignStatus.className = `badge ${data.status === "active" ? "badge-active" : "badge-warning"}`;
      els.activateCampaignButton.disabled = data.status === "active";
      els.buildAudienceButton.disabled = false;
      els.exportCsvButton.disabled = false;
    } else {
      els.campaignStatus.textContent = "Not saved";
      els.campaignStatus.className = "badge badge-muted";
      els.activateCampaignButton.disabled = true;
      els.buildAudienceButton.disabled = true;
      els.exportCsvButton.disabled = true;
      state.recipients = [];
      renderRecipients();
    }
  }

  async function saveCampaign() {
    const campaignKey = sanitizeCampaignKey(els.campaignKey.value);
    const name = els.campaignName.value.trim();
    const template = els.smsTemplate.value.trim();
    if (!campaignKey || !name || !template) {
      showToast("Campaign name, key and message are required.", "error");
      return;
    }
    setBusy(els.saveCampaignButton, true, "Saving...");
    try {
      const payload = {
        campaign_key: campaignKey,
        name,
        message_template: template,
        whatsapp_number: config.whatsappNumber,
        whatsapp_message: config.whatsappClaimMessage,
        public_base_url: String(config.publicBaseUrl).replace(/\/$/, ""),
      };
      const { data, error } = await state.client
        .from("sms_campaigns")
        .upsert(payload, { onConflict: "campaign_key" })
        .select("*")
        .single();
      if (error) throw error;
      state.campaign = data;
      els.campaignKey.value = campaignKey;
      showToast("Campaign saved.");
      await refreshAll();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not save campaign.", "error");
    } finally {
      setBusy(els.saveCampaignButton, false);
    }
  }

  async function activateCampaign() {
    if (!state.campaign) return;
    setBusy(els.activateCampaignButton, true, "Activating...");
    try {
      const { error } = await state.client
        .from("sms_campaigns")
        .update({ status: "active", activated_at: new Date().toISOString() })
        .eq("id", state.campaign.id);
      if (error) throw error;
      showToast("Campaign activated.");
      await refreshAll();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not activate campaign.", "error");
    } finally {
      setBusy(els.activateCampaignButton, false);
    }
  }

  async function syncLeads() {
    setBusy(els.syncLeadsButton, true, "Syncing...");
    try {
      const { data, error } = await state.client.rpc("refresh_sms_leads_from_spin_players");
      if (error) throw error;
      showToast(`${Number(data || 0).toLocaleString()} Spin Wheel leads synced.`);
      await refreshAll();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not sync spin players.", "error");
    } finally {
      setBusy(els.syncLeadsButton, false);
    }
  }

  async function previewImportFile() {
    const file = els.oldLabelsFile.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const prepared = rows.map((row) => ({
        phone: findValue(row, ["phone_number", "phone", "number", "whatsapp", "whatsapp_number", "mobile"]),
        label: findValue(row, ["label", "status", "outreach_status", "message_status"]),
      })).filter((row) => row.phone);
      state.oldLabelRows = prepared;
      const counts = prepared.reduce((acc, row) => {
        const key = normalizeLabel(row.label);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      els.importPreview.textContent = [
        `${prepared.length.toLocaleString()} usable rows found`,
        `Not Messaged: ${(counts.not_messaged || 0).toLocaleString()}`,
        `Messaged: ${(counts.messaged || 0).toLocaleString()}`,
        `Messaged Us Before: ${(counts.messaged_us_before || 0).toLocaleString()}`,
      ].join("\n");
      els.runImportButton.disabled = !prepared.length;
    } catch (error) {
      console.error(error);
      state.oldLabelRows = [];
      els.importPreview.textContent = "Could not read this CSV file.";
      els.runImportButton.disabled = true;
    }
  }

  async function importOldLabels() {
    if (!state.oldLabelRows.length) return;
    setBusy(els.runImportButton, true, "Importing...");
    try {
      const payload = state.oldLabelRows.map((row) => ({
        phone_number: row.phone,
        outreach_status: normalizeLabel(row.label),
      }));
      const chunkSize = 250;
      let imported = 0;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { data, error } = await state.client.rpc("import_sms_outreach_labels", { p_rows: chunk });
        if (error) throw error;
        imported += Number(data || 0);
      }
      showToast(`${imported.toLocaleString()} outreach labels matched and imported.`);
      els.importDialog.close();
      els.oldLabelsFile.value = "";
      state.oldLabelRows = [];
      els.importPreview.textContent = "No file selected.";
      els.runImportButton.disabled = true;
      await refreshAll();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not import labels.", "error");
    } finally {
      setBusy(els.runImportButton, false);
    }
  }

  async function buildAudience() {
    if (!state.campaign) return;
    const limit = Math.max(1, Math.min(5000, Number(els.audienceLimit.value || 20)));
    setBusy(els.buildAudienceButton, true, "Preparing...");
    try {
      const { data, error } = await state.client.rpc("prepare_sms_campaign_recipients", {
        p_campaign_id: state.campaign.id,
        p_limit: limit,
      });
      if (error) throw error;
      showToast(`${Number(data || 0).toLocaleString()} new recipients prepared.`);
      await loadRecipients();
      await loadStats();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not prepare recipients.", "error");
    } finally {
      setBusy(els.buildAudienceButton, false);
    }
  }

  async function loadRecipients() {
    if (!state.campaign) return;
    const { data, error } = await state.client
      .from("sms_campaign_recipient_details")
      .select("*")
      .eq("campaign_id", state.campaign.id)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    state.recipients = data || [];
    renderRecipients();
  }

  function statusBadge(status) {
    const labels = {
      selected: ["Selected", "badge-muted"],
      exported: ["Exported", "badge-warning"],
      sent: ["SMS Sent", "badge-warning"],
      delivered: ["Delivered", "badge-active"],
      clicked: ["Link Clicked", "badge-clicked"],
      claimed: ["WhatsApp Claimed", "badge-active"],
      failed: ["Failed", "badge-danger"],
    };
    const [label, className] = labels[status] || [status || "Selected", "badge-muted"];
    return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
  }

  function renderRecipients() {
    const filter = els.statusFilter.value;
    const query = els.searchInput.value.trim().toLowerCase();
    const rows = state.recipients.filter((recipient) => {
      const effectiveStatus = recipient.whatsapp_claimed_at
        ? "claimed"
        : recipient.clicked_at
          ? "clicked"
          : recipient.sms_status;
      const matchesStatus = filter === "all" || filter === effectiveStatus;
      const haystack = `${recipient.first_name || ""} ${recipient.full_name || ""} ${recipient.phone_normalized || ""}`.toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });

    if (!rows.length) {
      els.recipientRows.innerHTML = '<tr><td colspan="6" class="empty-state">No recipients match this view.</td></tr>';
      return;
    }

    els.recipientRows.innerHTML = rows.map((recipient) => {
      const link = makeTrackingLink(recipient.tracking_token);
      const message = personaliseMessage(state.campaign.message_template, recipient.first_name, link);
      const effectiveStatus = recipient.whatsapp_claimed_at
        ? "claimed"
        : recipient.clicked_at
          ? "clicked"
          : recipient.sms_status;
      return `
        <tr>
          <td>
            <div class="lead-name">${escapeHtml(recipient.full_name || recipient.first_name || "Unnamed lead")}</div>
            <div class="lead-meta">Joined ${escapeHtml(formatDate(recipient.joined_at))}</div>
          </td>
          <td>${escapeHtml(recipient.phone_normalized)}</td>
          <td>${statusBadge(effectiveStatus)}</td>
          <td>${Number(recipient.click_count || 0).toLocaleString()}</td>
          <td class="message-cell">${escapeHtml(message)}</td>
          <td>
            <div class="action-stack">
              <button class="button button-small button-secondary" data-action="copy" data-id="${recipient.id}">Copy</button>
              <button class="button button-small button-secondary" data-action="sent" data-id="${recipient.id}">Sent</button>
              <button class="button button-small button-secondary" data-action="delivered" data-id="${recipient.id}">Delivered</button>
              <button class="button button-small button-primary" data-action="claimed" data-id="${recipient.id}">Claimed</button>
            </div>
          </td>
        </tr>`;
    }).join("");
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  async function handleRecipientAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const recipient = state.recipients.find((item) => item.id === button.dataset.id);
    if (!recipient) return;
    const action = button.dataset.action;

    if (action === "copy") {
      const link = makeTrackingLink(recipient.tracking_token);
      const message = personaliseMessage(state.campaign.message_template, recipient.first_name, link);
      await navigator.clipboard.writeText(message);
      showToast("Personalised SMS copied.");
      return;
    }

    const update = {};
    if (action === "sent") update.sms_status = "sent";
    if (action === "delivered") update.sms_status = "delivered";
    if (action === "claimed") {
      update.sms_status = "claimed";
      update.whatsapp_claimed_at = new Date().toISOString();
    }

    setBusy(button, true, "...");
    try {
      const { error } = await state.client.from("sms_campaign_recipients").update(update).eq("id", recipient.id);
      if (error) throw error;
      await Promise.all([loadRecipients(), loadStats()]);
      showToast(action === "claimed" ? "WhatsApp conversation confirmed." : `Recipient marked ${action}.`);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not update recipient.", "error");
    } finally {
      setBusy(button, false);
    }
  }

  async function exportCsv() {
    if (!state.campaign || !state.recipients.length) {
      showToast("Prepare recipients before exporting.", "error");
      return;
    }
    setBusy(els.exportCsvButton, true, "Exporting...");
    try {
      const exportable = state.recipients.filter((recipient) => recipient.sms_status === "selected");
      if (!exportable.length) {
        showToast("There are no unsent recipients to export.", "error");
        return;
      }

      const header = ["phone_number", "name", "amount"];
        const lines = [header.join(",")];

        for (const recipient of exportable) {
          const link = makeTrackingLink(recipient.tracking_token);
          lines.push([
            recipient.phone_normalized,
            link,
            "0.00",
          ].map(csvEscape).join(","));
        }

        const exportStamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .replace("T", "_")
          .slice(0, 19);
        const filename = `kudisms_${state.campaign.campaign_key}_${exportStamp}.csv`;
      downloadText(filename, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");

      const ids = exportable.map((recipient) => recipient.id);
      const { error } = await state.client
        .from("sms_campaign_recipients")
        .update({ sms_status: "exported", exported_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;

      showToast(`${exportable.length.toLocaleString()} KudiSMS records exported and marked Exported.`);
      await Promise.all([loadRecipients(), loadStats()]);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not export CSV.", "error");
    } finally {
      setBusy(els.exportCsvButton, false);
    }
  }

  init();
})();
