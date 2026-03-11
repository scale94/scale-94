// kernels/surveillance.rs — Surveillance Index v1.0 (grey-c0 / Navigators Guild)
//
// Panopticon Index = Σ(severity²) / (n × 25) × 100
// Source: https://github.com/grey-c0/legislation
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn run_surveillance_index(region_code: f64, category_code: f64, threshold: f64) -> String {
    // Map numeric region code → location string fragment
    let region_filter: &str = match region_code as u8 {
        1  => "United Kingdom",
        2  => "EU",
        3  => "United States",
        4  => "Australia",
        5  => "Canada",
        6  => "Germany",
        7  => "France",
        8  => "Sweden",
        9  => "Ireland",
        10 => "Netherlands",
        11 => "New Zealand",
        12 => "Belgium",
        _  => "",   // 0 = ALL
    };
    // Map numeric category code → category slug
    let category_filter: &str = match category_code as u8 {
        1 => "encryption_backdoor",
        2 => "digital_id",
        3 => "biometric_collection",
        4 => "data_retention",
        5 => "worker_surveillance",
        6 => "platform_mandated_scanning",
        7 => "traffic_retention",
        8 => "age_verification",
        _ => "",    // 0 = ALL
    };

    // LawEntry is private to this module — not exported to JS
    struct LawEntry {
        id:         &'static str,
        location:   &'static str,
        severity:   u8,
        status:     &'static str,
        categories: &'static str, // space-separated slugs
    }

    const LAWS: &[LawEntry] = &[
        // ── Australia ──────────────────────────────────────────────────────────
        LawEntry { id: "LAW-AU-2018-TOLA-001",       location: "Australia",      severity: 4, status: "ACTIVE",        categories: "encryption_backdoor data_retention" },
        LawEntry { id: "LAW-AU-2024-DIGID-001",       location: "Australia",      severity: 4, status: "IMPLEMENTING",  categories: "digital_id biometric_collection age_verification" },
        LawEntry { id: "LAW-AU-2024-SMMA-001",        location: "Australia",      severity: 4, status: "ACTIVE",        categories: "age_verification digital_id biometric_collection" },
        LawEntry { id: "LAW-AU-2025-NSW-DWC",         location: "Australia",      severity: 3, status: "ACTIVE",        categories: "digital_id worker_surveillance" },
        // ── Belgium ────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-BE-2024-DATA-RETENTION",  location: "Belgium",        severity: 4, status: "ACTIVE",        categories: "data_retention traffic_retention" },
        LawEntry { id: "LAW-BE-2024-ITSME",           location: "Belgium",        severity: 3, status: "ACTIVE",        categories: "digital_id biometric_collection" },
        LawEntry { id: "LAW-BE-2026-DIGITAL-ID",      location: "Belgium",        severity: 3, status: "IMPLEMENTING",  categories: "digital_id biometric_collection" },
        // ── Canada ─────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-CA-2025-C2-001",          location: "Canada",         severity: 4, status: "CHALLENGED",    categories: "data_retention encryption_backdoor worker_surveillance" },
        LawEntry { id: "LAW-CA-2025-C63-001",         location: "Canada",         severity: 3, status: "PROPOSED",      categories: "age_verification platform_mandated_scanning" },
        LawEntry { id: "LAW-CA-2025-C8-001",          location: "Canada",         severity: 5, status: "PROPOSED",      categories: "traffic_retention encryption_backdoor worker_surveillance data_retention" },
        LawEntry { id: "LAW-CA-2025-DIACC-001",       location: "Canada",         severity: 3, status: "IMPLEMENTING",  categories: "digital_id biometric_collection" },
        // ── Germany ────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-DE-2021-NETZDG-002",      location: "Germany",        severity: 4, status: "ACTIVE",        categories: "platform_mandated_scanning data_retention worker_surveillance" },
        LawEntry { id: "LAW-DE-2025-BND-001",         location: "Germany",        severity: 5, status: "PROPOSED",      categories: "traffic_retention data_retention encryption_backdoor" },
        LawEntry { id: "LAW-DE-2025-EUDI-001",        location: "Germany",        severity: 4, status: "IMPLEMENTING",  categories: "digital_id biometric_collection" },
        // ── EU ─────────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-EU-2024-DSA",             location: "EU",             severity: 3, status: "ACTIVE",        categories: "platform_mandated_scanning data_retention" },
        LawEntry { id: "LAW-EU-2024-EIDAS2",          location: "EU",             severity: 4, status: "IMPLEMENTING",  categories: "digital_id biometric_collection" },
        LawEntry { id: "LAW-EU-2024-PLATFORM-WORK",   location: "EU",             severity: 3, status: "PASSED",        categories: "worker_surveillance biometric_collection" },
        LawEntry { id: "LAW-EU-2025-CHAT-001",        location: "EU",             severity: 5, status: "CHALLENGED",    categories: "encryption_backdoor platform_mandated_scanning age_verification biometric_collection data_retention" },
        LawEntry { id: "LAW-EU-2025-DATA-RETENTION",  location: "EU",             severity: 4, status: "PROPOSED",      categories: "data_retention traffic_retention" },
        // ── France ─────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-FR-2023-JO2024",          location: "France",         severity: 4, status: "ACTIVE",        categories: "biometric_collection worker_surveillance" },
        LawEntry { id: "LAW-FR-2024-SREN",            location: "France",         severity: 4, status: "ACTIVE",        categories: "age_verification biometric_collection digital_id" },
        // ── Ireland ────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-IE-2011-DATA-RETENTION",  location: "Ireland",        severity: 4, status: "ACTIVE",        categories: "data_retention traffic_retention" },
        LawEntry { id: "LAW-IE-2011-PSC",             location: "Ireland",        severity: 4, status: "CHALLENGED",    categories: "digital_id biometric_collection" },
        LawEntry { id: "LAW-IE-2024-OSC",             location: "Ireland",        severity: 4, status: "IMPLEMENTING",  categories: "age_verification digital_id biometric_collection" },
        // ── Netherlands ────────────────────────────────────────────────────────
        LawEntry { id: "LAW-NL-2024-DATA-RETENTION",  location: "Netherlands",    severity: 3, status: "ACTIVE",        categories: "data_retention traffic_retention" },
        LawEntry { id: "LAW-NL-2024-WIV",             location: "Netherlands",    severity: 4, status: "ACTIVE",        categories: "traffic_retention data_retention" },
        LawEntry { id: "LAW-NL-2025-IDIN-ITSME",      location: "Netherlands",    severity: 3, status: "IMPLEMENTING",  categories: "digital_id biometric_collection" },
        // ── New Zealand ────────────────────────────────────────────────────────
        LawEntry { id: "LAW-NZ-2023-DIGID",           location: "New Zealand",    severity: 3, status: "ACTIVE",        categories: "digital_id biometric_collection" },
        LawEntry { id: "LAW-NZ-2025-BIOMETRIC",       location: "New Zealand",    severity: 3, status: "IMPLEMENTING",  categories: "biometric_collection worker_surveillance" },
        LawEntry { id: "LAW-NZ-2025-TERROR",          location: "New Zealand",    severity: 4, status: "PROPOSED",      categories: "worker_surveillance" },
        // ── Sweden ─────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-SE-2003-BANKID",          location: "Sweden",         severity: 3, status: "ACTIVE",        categories: "digital_id biometric_collection" },
        LawEntry { id: "LAW-SE-2024-FRA",             location: "Sweden",         severity: 5, status: "ACTIVE",        categories: "traffic_retention data_retention" },
        LawEntry { id: "LAW-SE-2025-CAMERA",          location: "Sweden",         severity: 3, status: "ACTIVE",        categories: "biometric_collection worker_surveillance" },
        LawEntry { id: "LAW-SE-2025-DATALAGRING",     location: "Sweden",         severity: 5, status: "PROPOSED",      categories: "encryption_backdoor data_retention" },
        // ── United Kingdom ─────────────────────────────────────────────────────
        LawEntry { id: "LAW-UK-2023-OSA-001",         location: "United Kingdom", severity: 5, status: "ACTIVE",        categories: "age_verification platform_mandated_scanning encryption_backdoor digital_id" },
        LawEntry { id: "LAW-UK-2024-IPA-001",         location: "United Kingdom", severity: 4, status: "IMPLEMENTING",  categories: "traffic_retention data_retention" },
        LawEntry { id: "LAW-UK-2025-DIGID-001",       location: "United Kingdom", severity: 5, status: "PROPOSED",      categories: "digital_id biometric_collection worker_surveillance" },
        LawEntry { id: "LAW-UK-2025-DUA-001",         location: "United Kingdom", severity: 4, status: "PASSED",        categories: "worker_surveillance digital_id" },
        // ── United States ──────────────────────────────────────────────────────
        LawEntry { id: "LAW-US-2025-AMZN-001",        location: "United States",  severity: 3, status: "ACTIVE",        categories: "worker_surveillance biometric_collection" },
        LawEntry { id: "LAW-US-2025-EARN-001",        location: "United States",  severity: 5, status: "PROPOSED",      categories: "encryption_backdoor platform_mandated_scanning" },
        LawEntry { id: "LAW-US-2025-ICE-001",         location: "United States",  severity: 4, status: "IMPLEMENTING",  categories: "worker_surveillance data_retention platform_mandated_scanning" },
        LawEntry { id: "LAW-US-2025-KOSA-001",        location: "United States",  severity: 4, status: "PROPOSED",      categories: "age_verification platform_mandated_scanning" },
        LawEntry { id: "LAW-US-2025-STATE-001",       location: "United States",  severity: 4, status: "CHALLENGED",    categories: "age_verification digital_id biometric_collection" },
        LawEntry { id: "LAW-US-2026-CA-947",          location: "United States",  severity: 2, status: "PROPOSED",      categories: "worker_surveillance" },
    ];

    let thresh = threshold.clamp(0.0, 5.0) as u8;

    // ── Filter ────────────────────────────────────────────────────────────────
    let filtered: Vec<&LawEntry> = LAWS.iter().filter(|law| {
        let region_ok = region_filter.is_empty()
            || law.location.contains(region_filter);
        let cat_ok = category_filter.is_empty()
            || law.categories.contains(category_filter);
        let thresh_ok = law.severity >= thresh;
        region_ok && cat_ok && thresh_ok
    }).collect();

    if filtered.is_empty() {
        return format!(
            "SURVEILLANCE_INDEX v1.0 // NO_MATCH\n\
             STATUS: ZERO_ENTRIES_IN_FILTER\n\
             REGION_FILTER:   {}\n\
             CATEGORY_FILTER: {}\n\
             THRESHOLD:       {}/5\n\
             SOURCE: grey-c0/legislation // Navigators Guild",
            if region_filter.is_empty()   { "ALL" } else { region_filter },
            if category_filter.is_empty() { "ALL" } else { category_filter },
            thresh,
        );
    }

    let total   = filtered.len();
    let avg_sev = filtered.iter().map(|l| l.severity as f64).sum::<f64>() / total as f64;

    // Panopticon Index: Σ(severity²) / (n × 25) × 100
    let raw_score: f64 = filtered.iter().map(|l| (l.severity as f64).powi(2)).sum();
    let panopticon     = (raw_score / (total as f64 * 25.0) * 100.0).min(100.0);

    // Severity tiers
    let critical = filtered.iter().filter(|l| l.severity == 5).count();
    let high     = filtered.iter().filter(|l| l.severity == 4).count();
    let elevated = filtered.iter().filter(|l| l.severity == 3).count();
    let moderate = filtered.iter().filter(|l| l.severity <= 2).count();

    // Legal status breakdown
    let s_active       = filtered.iter().filter(|l| l.status == "ACTIVE").count();
    let s_implementing = filtered.iter().filter(|l| matches!(l.status, "IMPLEMENTING" | "PASSED")).count();
    let s_proposed     = filtered.iter().filter(|l| l.status == "PROPOSED").count();
    let s_challenged   = filtered.iter().filter(|l| l.status == "CHALLENGED").count();

    // ── Per-jurisdiction aggregation ──────────────────────────────────────────
    let mut seen_locs: Vec<&str> = Vec::new();
    for law in &filtered {
        if !seen_locs.contains(&law.location) {
            seen_locs.push(law.location);
        }
    }
    let mut loc_stats: Vec<(&str, usize, u32)> = seen_locs.iter().map(|&loc| {
        let count   = filtered.iter().filter(|l| l.location == loc).count();
        let sev_sum = filtered.iter().filter(|l| l.location == loc)
                              .map(|l| l.severity as u32).sum::<u32>();
        (loc, count, sev_sum)
    }).collect();
    loc_stats.sort_by(|a, b| b.2.cmp(&a.2).then(b.1.cmp(&a.1)));

    // ── Category frequency ────────────────────────────────────────────────────
    const CAT_KEYS: &[&str] = &[
        "biometric_collection", "data_retention",           "digital_id",
        "encryption_backdoor",  "worker_surveillance",      "platform_mandated_scanning",
        "traffic_retention",    "age_verification",
    ];
    let mut cat_counts: Vec<(&str, usize)> = CAT_KEYS.iter()
        .map(|&cat| {
            let n = filtered.iter().filter(|l| l.categories.contains(cat)).count();
            (cat, n)
        })
        .filter(|(_, n)| *n > 0)
        .collect();
    cat_counts.sort_by(|a, b| b.1.cmp(&a.1));

    // ── Threat assessment ─────────────────────────────────────────────────────
    let threat_status = if panopticon >= 80.0      { "CRITICAL: PANOPTICON_IMMINENT" }
        else if panopticon >= 60.0 { "HIGH: SYSTEMIC_SURVEILLANCE_RISK" }
        else if panopticon >= 40.0 { "ELEVATED: COORDINATED_LEGISLATION_DETECTED" }
        else                       { "MODERATE: ISOLATED_VECTORS" };

    // ── Format output ─────────────────────────────────────────────────────────
    let mut out = String::new();
    out.push_str("SURVEILLANCE_INDEX v1.0 // BOOT_OK\n");
    out.push_str(&format!("STATUS: {}\n", threat_status));
    out.push_str(&format!("REGION_FILTER:   {}\n", if region_filter.is_empty()   { "ALL" } else { region_filter }));
    out.push_str(&format!("CATEGORY_FILTER: {}\n", if category_filter.is_empty() { "ALL" } else { category_filter }));
    out.push_str(&format!("THRESHOLD:       {}/5\n", thresh));
    out.push_str("────────────────────────────────────────────\n");
    out.push_str(&format!("ENTRIES_MATCHED:  {}\n",   total));
    out.push_str(&format!("AVG_SEVERITY:     {:.2}/5.00\n", avg_sev));
    out.push_str(&format!("PANOPTICON_INDEX: {:.1}/100.0\n", panopticon));
    out.push_str(&format!(
        "THREAT_TIERS:     CRITICAL={} HIGH={} ELEVATED={} MODERATE={}\n",
        critical, high, elevated, moderate
    ));
    out.push_str(&format!(
        "LEGAL_STATUS:     ACTIVE={} IMPLEMENTING/PASSED={} PROPOSED={} CHALLENGED={}\n",
        s_active, s_implementing, s_proposed, s_challenged
    ));
    out.push_str("────────────────────────────────────────────\n");
    out.push_str("JURISDICTION_THREAT_MAP:\n");
    for (loc, count, sev_sum) in &loc_stats {
        let avg     = *sev_sum as f64 / *count as f64;
        let bar_len = (avg / 5.0 * 14.0).round() as usize;
        let bar: String = "█".repeat(bar_len) + &"░".repeat(14usize.saturating_sub(bar_len));
        out.push_str(&format!("  {:<16} laws={:<3} avg={:.1}  {}\n", loc, count, avg, bar));
    }
    out.push_str("────────────────────────────────────────────\n");
    out.push_str("TOP_THREAT_CATEGORIES:\n");
    for (cat, n) in cat_counts.iter().take(8) {
        let bar_len = (*n * 14 / total).min(14);
        let bar: String = "█".repeat(bar_len) + &"░".repeat(14usize.saturating_sub(bar_len));
        out.push_str(&format!("  {:<30} n={:<3}  {}\n", cat, n, bar));
    }
    out.push_str("────────────────────────────────────────────\n");
    out.push_str("SOURCE:      grey-c0/legislation // Navigators Guild\n");
    out.push_str("ATTRIBUTION: @grey-c0 // integrated into scale_9.4 CAS\n");

    // suppress unused-variable warnings (id field used only for dataset integrity)
    let _ = filtered.iter().map(|l| l.id).count();
    out
}
